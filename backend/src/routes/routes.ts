import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Item from '../models/Item.js';
import Account from '../models/Account.js';
import Card from '../models/Card.js';
import Benefit from '../models/Benefit.js';
import { createLinkToken, exchangePublicToken, getItem, getAccounts, syncTransactions, itemRemove } from '../services/plaid.service.js';
import { upsertItem, upsertAccount, upsertTransactions, reconcileBenefitsForTransaction } from '../services/data.service.js';
import { computeBenefitPeriod } from '../services/rewards.service.js';
import { decrypt } from '../services/crypto.js';

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string };
    }
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { userId: string };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }
  if (await User.findOne({ username })) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }
  const user = await User.create({ username, password });
  res.json({ id: user._id, username: user.username });
});

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };
  const user = await User.findOne({ username });
  if (!user || !(await user.comparePassword(password))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  res.json({ token });
});

// Create Link Token
// https://plaid.com/docs/api/link/#create-link-token
router.post('/link/token/create', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const linkToken = await createLinkToken(req.user!.userId);
    res.json({ link_token: linkToken });
  } catch (err) {
    next(err);
  }
});

// Exchange a Link public_token for an access_token, then store item, accounts, and transactions
// https://plaid.com/docs/api/items/#itempublic_tokenexchange
router.post('/item/public_token/exchange', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { public_token } = req.body as { public_token: string };
    const { accessToken, itemId, requestId } = await exchangePublicToken(public_token);

    const item = await getItem(accessToken);
    const accounts = await getAccounts(accessToken);
    const { transactions, cursor } = await syncTransactions(accessToken);
    const userId = req.user!.userId;

    // Add the item to database if it doesn't already exist
    const institutionId = item.institution_id;
    const existingItem = item.institution_id ? await Item.findOne({ userId, institutionId }) : null;
    const resolvedItemId = existingItem ? existingItem.itemId : itemId;
    if (!existingItem) {
      await upsertItem(userId, accessToken, item);
      await Item.updateOne({ itemId }, { cursor });
    }

    for (const account of accounts) {
      const existingAccount = await Account.findOne({ userId, itemId: resolvedItemId, name: account.name });
      if (!existingAccount) {
        await upsertAccount(userId, resolvedItemId, account);
      }
    }

    await upsertTransactions(userId, itemId, transactions);

    res.json({ item_id: itemId, request_id: requestId, error: null });
  } catch (err) {
    console.error('item/public_token/exchange error:', err);
    next(err);
  }
});

// Sync transactions for all of the user's linked items and upsert into the database
router.post('/transactions/sync', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const items = await Item.find({ userId });
    if (!items.length) {
      res.status(404).json({ error: 'No linked items found for this user' });
      return;
    }

    let total = 0;
    for (const item of items) {
      if (!item.accessToken) continue;
      const accessToken = decrypt(item.accessToken);
      try {
        const { transactions, cursor } = await syncTransactions(accessToken, item.cursor);
        await upsertTransactions(userId, item.itemId, transactions);
        await Item.updateOne({ _id: item._id }, { cursor });
        total += transactions.length;
      } catch (err) {
        console.error(`Skipping item ${item.itemId}:`, err);
      }
    }

    res.json({ synced: total });
  } catch (err) {
    next(err);
  }
});

// Retrieve all items for the logged-in user
router.get('/items', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await Item.find({ userId: req.user!.userId }, { itemId: 1, institutionName: 1, institutionId: 1 });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// Remove an item from Plaid using its stored access token
router.delete('/items/:itemId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await Item.findOne({ userId: req.user!.userId, itemId: req.params.itemId });
    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    if (!item.accessToken) {
      res.status(400).json({ error: 'No access token stored for this item' });
      return;
    }
    const requestId = await itemRemove(decrypt(item.accessToken));
    res.json({ removed: true, request_id: requestId });
  } catch (err) {
    next(err);
  }
});

// Retrieve all accounts for the logged-in user
router.get('/accounts', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accounts = await Account.find({ userId: req.user!.userId });
    res.json({ accounts });
  } catch (err) {
    next(err);
  }
});

// Retrieve the card associated with an account
router.get('/accounts/:accountId/card', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await Account.findOne({ userId: req.user!.userId, accountId: req.params.accountId });
    if (!account) { res.status(404).json({ error: 'Account not found' }); return; }
    const card = await Card.findOne({ name: account.name, isActive: true });
    res.json({ card });
  } catch (err) {
    next(err);
  }
});

// Retrieve a single account by accountId
router.get('/accounts/:accountId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await Account.findOne({ userId: req.user!.userId, accountId: req.params.accountId });
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json({ account });
  } catch (err) {
    next(err);
  }
});

// Retrieve benefit usage records for an account.
// Month mode (?mode=month&year=Y&month=M): one doc per card benefit for the
// period containing that month; lazy-creates docs on first access.
// Year mode (?mode=year&year=Y): one aggregated row per card benefit, summing
// `used` and `total` across every Benefit doc whose period falls within Y.
// Year mode does not lazy-create — it only surfaces existing data.
router.get('/accounts/:accountId/benefits', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const account = await Account.findOne({ userId, accountId: req.params.accountId });
    if (!account) { res.status(404).json({ error: 'Account not found' }); return; }

    const card = await Card.findOne({ name: account.name, isActive: true });
    if (!card?.benefits?.length) { res.json({ benefits: [] }); return; }

    const mode = (req.query.mode as string) ?? 'month';
    const year = Number(req.query.year);
    if (!Number.isInteger(year)) {
      res.status(400).json({ error: 'year query param required' });
      return;
    }

    // Earliest transaction date for this account — treated as the "activation"
    // month. Any period ending before this is considered outside the card's lifetime.
    const firstTxn = await Transaction.findOne(
      { userId, accountId: req.params.accountId },
      { 'plaidTransaction.authorized_date': 1 }
    ).sort({ 'plaidTransaction.authorized_date': 1 });
    const firstDate = firstTxn?.plaidTransaction?.authorized_date;
    const first = firstDate ? { year: Number(firstDate.slice(0, 4)), month: Number(firstDate.slice(5, 7)) } : null;

    if (mode === 'year') {
      if (first && first.year > year) { res.json({ benefits: [] }); return; }
      const yy = String(year % 100).padStart(2, '0');
      const docs = await Benefit.find({
        userId,
        accountId: req.params.accountId,
        period: { $regex: `^${yy}\\d{2}-${yy}\\d{2}$` },
      });
      const firstValidMonth = first && first.year === year ? first.month : 1;
      const byBenefitId = new Map<string, { used: number; total: number; docIds: mongoose.Types.ObjectId[] }>();
      for (const d of docs) {
        const endMonth = Number(d.period.split('-')[1].slice(2));
        if (endMonth < firstValidMonth) continue;
        const agg = byBenefitId.get(d.benefitId) ?? { used: 0, total: 0, docIds: [] };
        agg.used += d.used;
        agg.total += d.total;
        agg.docIds.push(d._id as mongoose.Types.ObjectId);
        byBenefitId.set(d.benefitId, agg);
      }
      const benefits = card.benefits.map(cb => {
        const agg = byBenefitId.get(cb.id) ?? { used: 0, total: 0, docIds: [] };
        return {
          accountId: req.params.accountId,
          benefitId: cb.id,
          name: cb.name,
          description: cb.description,
          periodType: cb.period,
          trackingType: cb.trackingType ?? 'automatic',
          period: `${yy}01-${yy}12`,
          used: agg.used,
          total: agg.total,
          aggregatedDocIds: agg.docIds,
        };
      });
      res.json({ benefits });
      return;
    }

    const month = Number(req.query.month);
    if (!Number.isInteger(month) || month < 0 || month > 11) {
      res.status(400).json({ error: 'month query param required in month mode (0-indexed)' });
      return;
    }

    // Reject requests for months before the card's first transaction — don't
    // render benefits and don't lazy-create docs the user never earned.
    if (first && (year < first.year || (year === first.year && month + 1 < first.month))) {
      res.json({ benefits: [] });
      return;
    }

    const benefits = await Promise.all(card.benefits.map(async cb => {
      const period = computeBenefitPeriod(cb.period, year, month);
      const doc = await Benefit.findOneAndUpdate(
        { userId, accountId: req.params.accountId, benefitId: cb.id, period },
        {
          $setOnInsert: { used: 0, transactions: [], lastModified: new Date() },
          $set: { total: cb.amount },
        },
        { upsert: true, returnDocument: 'after' }
      );
      return {
        _id: doc!._id,
        accountId: req.params.accountId,
        benefitId: cb.id,
        name: cb.name,
        description: cb.description,
        periodType: cb.period,
        trackingType: cb.trackingType ?? 'automatic',
        period: doc!.period,
        used: doc!.used,
        total: doc!.total,
        transactions: doc!.transactions,
      };
    }));

    res.json({ benefits });
  } catch (err) {
    next(err);
  }
});

// Manually update the `used` amount on a benefit doc (only allowed for
// benefits whose card template is trackingType: 'manual').
router.patch('/benefits/:benefitDocId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { used } = req.body as { used: number };
    if (typeof used !== 'number' || !Number.isFinite(used) || used < 0) {
      res.status(400).json({ error: 'used must be a non-negative number' });
      return;
    }

    const benefit = await Benefit.findOne({ _id: req.params.benefitDocId, userId });
    if (!benefit) { res.status(404).json({ error: 'Benefit not found' }); return; }

    const account = await Account.findOne({ userId, accountId: benefit.accountId });
    const card = account ? await Card.findOne({ name: account.name, isActive: true }) : null;
    const cardBenefit = card?.benefits?.find(b => b.id === benefit.benefitId);
    if (cardBenefit?.trackingType !== 'manual') {
      res.status(400).json({ error: 'Benefit is not manually tracked' });
      return;
    }

    benefit.used = used;
    benefit.lastModified = new Date();
    await benefit.save();
    res.json({ benefit });
  } catch (err) {
    next(err);
  }
});

// Retrieve all transactions for a specific account
router.get('/accounts/:accountId/transactions', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transactions = await Transaction.find({
      userId: req.user!.userId,
      accountId: req.params.accountId,
    }).sort({ 'plaidTransaction.date': -1 });
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
});

// Re-process all stored transactions through the categorization/rewards pipeline
router.post('/transactions/reprocess', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const existing = await Transaction.find({ userId });
    if (!existing.length) {
      res.json({ reprocessed: 0 });
      return;
    }

    // Snapshot the raw Plaid data and the itemId each transaction belongs to
    const snapshot = existing.map(t => ({ itemId: t.itemId, plaidTransaction: t.plaidTransaction }));

    await Transaction.deleteMany({ userId });
    await Benefit.deleteMany({ userId });

    // Group by itemId and re-run through upsertTransactions
    const byItem = new Map<string, typeof snapshot>();
    for (const entry of snapshot) {
      if (!byItem.has(entry.itemId)) byItem.set(entry.itemId, []);
      byItem.get(entry.itemId)!.push(entry);
    }

    let total = 0;
    for (const [itemId, entries] of byItem) {
      await upsertTransactions(userId, itemId, entries.map(e => e.plaidTransaction));
      total += entries.length;
    }

    res.json({ reprocessed: total });
  } catch (err) {
    next(err);
  }
});

// Update a transaction's category and recalculate rewards
router.patch('/transactions/:transactionId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category } = req.body as { category: string };
    const txn = await Transaction.findOne({ userId: req.user!.userId, transactionId: req.params.transactionId });
    if (!txn) { res.status(404).json({ error: 'Transaction not found' }); return; }

    const { calculateRewards } = await import('../services/rewards.service.js');
    const rewards = await calculateRewards(txn.accountId, category, txn.plaidTransaction.amount);

    txn.category = category;
    txn.cashback = rewards?.cashback ?? 0;
    txn.points = rewards?.points ?? 0;
    await txn.save();
    await reconcileBenefitsForTransaction(txn);

    res.json({ transaction: txn });
  } catch (err) {
    next(err);
  }
});

// Retrieve all stored transactions for the logged-in user
router.get('/transactions', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transactions = await Transaction.find({ userId: req.user!.userId }).sort({ 'plaidTransaction.date': -1 });
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
});

// Earliest and latest authorized_date across the user's transactions (YYYY-MM-DD).
// Returns { earliest: null, latest: null } if the user has no transactions.
router.get('/transactions/range', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);
    const [range] = await Transaction.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          earliest: { $min: '$plaidTransaction.authorized_date' },
          latest: { $max: '$plaidTransaction.authorized_date' },
        },
      },
    ]);
    res.json({ earliest: range?.earliest ?? null, latest: range?.latest ?? null });
  } catch (err) {
    next(err);
  }
});

export default router;
