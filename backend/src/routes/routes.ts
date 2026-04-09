import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Item from '../models/Item.js';
import Account from '../models/Account.js';
import { createLinkToken, exchangePublicToken, getItem, getAccounts, syncTransactions, itemRemove } from '../services/plaid.service.js';
import { upsertItem, upsertAccount, upsertTransactions } from '../services/data.service.js';
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
        const { transactions/*, cursor*/ } = await syncTransactions(accessToken/*, item.cursor*/);
        await upsertTransactions(userId, item.itemId, transactions);
        // await Item.updateOne({ _id: item._id }, { cursor });
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

// Retrieve all stored transactions for the logged-in user
router.get('/transactions', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transactions = await Transaction.find({ userId: req.user!.userId }).sort({ 'plaidTransaction.date': -1 });
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
});

export default router;
