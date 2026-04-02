import dotenv from 'dotenv';
dotenv.config();

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Item from '../models/Item.js';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  LinkTokenCreateRequest,
  ItemGetRequest,
} from 'plaid';
import moment from 'moment';
import util from 'util';

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string };
    }
  }
}

const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';
const PLAID_PRODUCTS = (process.env.PLAID_PRODUCTS || Products.Transactions).split(',') as Products[];
const PLAID_COUNTRY_CODES = (process.env.PLAID_COUNTRY_CODES || 'US').split(',') as CountryCode[];
const PLAID_REDIRECT_URI = process.env.PLAID_REDIRECT_URI || '';
const PLAID_ANDROID_PACKAGE_NAME = process.env.PLAID_ANDROID_PACKAGE_NAME || '';

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
      'Plaid-Version': '2020-09-14',
    },
  },
});

const client = new PlaidApi(configuration);

const prettyPrintResponse = (response: { data: unknown }): void => {
  console.log(util.inspect(response.data, { colors: true, depth: 4 }));
};

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(data: string): string {
  const [ivHex, authTagHex, encryptedHex] = data.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    ENCRYPTION_KEY,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return decipher.update(Buffer.from(encryptedHex, 'hex')).toString() + decipher.final('utf8');
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
router.post('/link/token/create', requireAuth, function (req: Request, res: Response, next: NextFunction) {
  Promise.resolve()
    .then(async function () {

      // Request sent to Plaid Link to obtain a Link Token
      const configs: LinkTokenCreateRequest = {
        user: {
          client_user_id: req.user!.userId,
        },
        client_name: 'Plaid Quickstart',
        products: PLAID_PRODUCTS,
        country_codes: PLAID_COUNTRY_CODES,
        language: 'en',
      };

      if (PLAID_REDIRECT_URI !== '') configs.redirect_uri = PLAID_REDIRECT_URI;
      if (PLAID_ANDROID_PACKAGE_NAME !== '') configs.android_package_name = PLAID_ANDROID_PACKAGE_NAME;

      if (PLAID_PRODUCTS.includes(Products.Statements)) {
        configs.statements = {
          end_date: moment().format('YYYY-MM-DD'),
          start_date: moment().subtract(30, 'days').format('YYYY-MM-DD'),
        };
      }

      const createTokenResponse = await client.linkTokenCreate(configs);
      res.json(createTokenResponse.data);
    })
    .catch(next);
});

// Exchange a Link public_token for an API access_token, then fetch and store institution info
// https://plaid.com/docs/api/items/#itempublic_tokenexchange
router.post('/item/public_token/exchange', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { public_token } = req.body as { public_token: string };

    // Exchange the public_token for an access_token and item_id
    const tokenResponse = await client.itemPublicTokenExchange({ public_token });
    const accessToken = tokenResponse.data.access_token;
    const itemId = tokenResponse.data.item_id;
    const requestId = tokenResponse.data.request_id;

    // Fetch institution info from Plaid
    const itemGetResponse = await client.itemGet({ access_token: accessToken });
    const institutionId = itemGetResponse.data.item.institution_id;
    const institutionName = itemGetResponse.data.item.institution_name;

    const accountsGetResponse = await client.accountsGet({ access_token: accessToken });

    // Store the access token and institution info in the database, associated with the user
    const item = await Item.findOneAndUpdate(
      { itemId },
      {
        userId: req.user!.userId,
        itemId,
        accessToken: encrypt(accessToken),
        institutionId,
        institutionName,
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Upsert each account associated with this item
    await Promise.all(accountsGetResponse.data.accounts.map(account =>
      Account.findOneAndUpdate(
        { accountId: account.account_id },
        {
          userId: req.user!.userId,
          itemId,
          accountId: account.account_id,
          balances: {
            available: account.balances.available,
            current: account.balances.current,
            isoCurrencyCode: account.balances.iso_currency_code,
            limit: account.balances.limit,
            unofficialCurrencyCode: account.balances.unofficial_currency_code,
          },
          mask: account.mask,
          name: account.name,
          officialName: account.official_name,
          subtype: account.subtype,
          type: account.type,
        },
        { upsert: true, returnDocument: 'after' }
      )
    ));
    console.log(`item/public_token/exchange: upserted ${accountsGetResponse.data.accounts.length} accounts for item ${item!._id}`);

    // Fetch all transactions for this item and upsert into the database
    let cursor: string | null = null;
    let added: object[] = [];
    let hasMore = true;

    while (hasMore) {
      const syncResponse = await client.transactionsSync({
        access_token: accessToken,
        cursor: cursor ?? undefined,
      });
      const data = syncResponse.data;

      cursor = data.next_cursor;
      if (cursor === '') {
        await sleep(2000);
        continue;
      }

      added = added.concat(data.added);
      hasMore = data.has_more;
    }

    // Upsert each transaction linked to its account, item, and user
    await Promise.all(added.map((txn: any) =>
      Transaction.findOneAndUpdate(
        { transactionId: txn.transaction_id },
        {
          userId: req.user!.userId,
          itemId,
          accountId: txn.account_id,
          accountOwner: txn.account_owner,
          amount: txn.amount,
          authorizedDate: txn.authorized_date,
          authorizedDatetime: txn.authorized_datetime,
          category: txn.category,
          categoryId: txn.category_id,
          checkNumber: txn.check_number,
          counterparties: txn.counterparties?.map((c: any) => ({
            confidenceLevel: c.confidence_level,
            entityId: c.entity_id,
            logoUrl: c.logo_url,
            name: c.name,
            phoneNumber: c.phone_number,
            type: c.type,
            website: c.website,
          })),
          date: txn.date,
          datetime: txn.datetime,
          isoCurrencyCode: txn.iso_currency_code,
          location: txn.location ? {
            address: txn.location.address,
            city: txn.location.city,
            country: txn.location.country,
            lat: txn.location.lat,
            lon: txn.location.lon,
            postalCode: txn.location.postal_code,
            region: txn.location.region,
            storeNumber: txn.location.store_number,
          } : undefined,
          logoUrl: txn.logo_url,
          merchantIdentityId: txn.merchant_identity_id,
          merchantName: txn.merchant_name,
          name: txn.name,
          paymentChannel: txn.payment_channel,
          paymentMeta: txn.payment_meta ? {
            byOrderOf: txn.payment_meta.by_order_of,
            payee: txn.payment_meta.payee,
            payer: txn.payment_meta.payer,
            paymentMethod: txn.payment_meta.payment_method,
            paymentProcessor: txn.payment_meta.payment_processor,
            ppdId: txn.payment_meta.ppd_id,
            reason: txn.payment_meta.reason,
            referenceNumber: txn.payment_meta.reference_number,
          } : undefined,
          pending: txn.pending,
          pendingTransactionId: txn.pending_transaction_id,
          personalFinanceCategory: txn.personal_finance_category ? {
            confidenceLevel: txn.personal_finance_category.confidence_level,
            detailed: txn.personal_finance_category.detailed,
            primary: txn.personal_finance_category.primary,
            version: txn.personal_finance_category.version,
          } : undefined,
          personalFinanceCategoryIconUrl: txn.personal_finance_category_icon_url,
          transactionCode: txn.transaction_code,
          transactionId: txn.transaction_id,
          transactionType: txn.transaction_type,
          unofficialCurrencyCode: txn.unofficial_currency_code,
          website: txn.website,
        },
        { upsert: true, returnDocument: 'after' }
      )
    ));
    console.log(`item/public_token/exchange: upserted ${added.length} transactions for item ${item!._id}`);

    res.json({ item_id: itemId, request_id: requestId, error: null });
  } catch (err) {
    console.error('item/public_token/exchange error:', err);
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
