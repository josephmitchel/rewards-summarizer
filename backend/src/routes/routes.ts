import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Item from '../models/Item.js';
import Account from '../models/Account.js';
import { createLinkToken, exchangePublicToken, getItemInstitution, getAccounts, syncTransactions } from '../services/plaid.service.js';
import { upsertItem, upsertAccounts, upsertTransactions } from '../services/data.service.js';
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
    const userId = req.user!.userId;

    const { accessToken, itemId, requestId } = await exchangePublicToken(public_token);
    const { institutionId, institutionName } = await getItemInstitution(accessToken);

    const accounts = await getAccounts(accessToken);
    const transactions = await syncTransactions(accessToken);

    const existingItem = institutionId ? await Item.findOne({ userId, institutionId }) : null;
    const item = existingItem ? existingItem : await upsertItem(userId, itemId, accessToken, institutionId, institutionName);
    await upsertAccounts(userId, itemId, accounts);
    await upsertTransactions(userId, itemId, transactions);

    console.log(`item/public_token/exchange: item ${item!._id}, ${accounts.length} accounts, ${transactions.length} transactions`);
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
      const transactions = await syncTransactions(accessToken);
      console.log('transactions', transactions);
      await upsertTransactions(userId, item.itemId, transactions);
      total += transactions.length;
    }

    console.log(`transactions/sync: upserted ${total} transactions for user ${userId}`);
    res.json({ synced: total });
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
    }).sort({ date: -1 });
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
});

// Retrieve all stored transactions for the logged-in user
router.get('/transactions', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transactions = await Transaction.find({ userId: req.user!.userId }).sort({ date: -1 });
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
});

export default router;
