import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  LinkTokenCreateRequest,
  AccountBase,
  Transaction as PlaidTransaction,
  ItemWithConsentFields,
} from 'plaid';
import moment from 'moment';

function getClient(): PlaidApi {
  const configuration = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
        'Plaid-Version': '2020-09-14',
      },
    },
  });
  return new PlaidApi(configuration);
}

function getProducts(): Products[] {
  return (process.env.PLAID_PRODUCTS || Products.Transactions).split(',') as Products[];
}

function getCountryCodes(): CountryCode[] {
  return (process.env.PLAID_COUNTRY_CODES || 'US').split(',') as CountryCode[];
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Create Link Token
// https://plaid.com/docs/api/link/#create-link-token
export async function createLinkToken(userId: string): Promise<string> {
  const products = getProducts();
  const countryCodes = getCountryCodes();
  const redirectUri = process.env.PLAID_REDIRECT_URI || '';
  const androidPackageName = process.env.PLAID_ANDROID_PACKAGE_NAME || '';

  const configs: LinkTokenCreateRequest = {
    user: { client_user_id: userId },
    client_name: 'Plaid Quickstart',
    products,
    country_codes: countryCodes,
    language: 'en',
  };

  if (redirectUri !== '') configs.redirect_uri = redirectUri;
  if (androidPackageName !== '') configs.android_package_name = androidPackageName;

  if (products.includes(Products.Statements)) {
    configs.statements = {
      end_date: moment().format('YYYY-MM-DD'),
      start_date: moment().subtract(30, 'days').format('YYYY-MM-DD'),
    };
  }

  const response = await getClient().linkTokenCreate(configs);
  return response.data.link_token;
}

// Exchange a Link public_token for an access_token and item_id
// https://plaid.com/docs/api/items/#itempublic_tokenexchange
export async function exchangePublicToken(publicToken: string): Promise<{ accessToken: string; itemId: string; requestId: string }> {
  const response = await getClient().itemPublicTokenExchange({ public_token: publicToken });
  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
    requestId: response.data.request_id,
  };
}

// Retrieve institution info for an item
// https://plaid.com/docs/api/items/#itemget
export async function getItem(accessToken: string): Promise<ItemWithConsentFields> {
  const response = await getClient().itemGet({ access_token: accessToken });
  return response.data.item;
}

// Retrieve all accounts for an item
// https://plaid.com/docs/api/accounts/#accountsget
export async function getAccounts(accessToken: string): Promise<AccountBase[]> {
  const response = await getClient().accountsGet({ access_token: accessToken });
  return response.data.accounts;
}

// Remove an item from Plaid
// https://plaid.com/docs/api/items/#itemremove
export async function itemRemove(accessToken: string): Promise<string> {
  const response = await getClient().itemRemove({ access_token: accessToken });
  return response.data.request_id;
}

// Fetch all transactions for an item using the sync endpoint
// https://plaid.com/docs/api/products/transactions/#transactionssync
export async function syncTransactions(accessToken: string, initialCursor?: string | null): Promise<{ transactions: PlaidTransaction[]; cursor: string | null }> {
  const client = getClient();
  let cursor: string | null = initialCursor ?? null;
  let added: PlaidTransaction[] = [];
  let hasMore = true;

  while (hasMore) {
    const response = await client.transactionsSync({
      access_token: accessToken,
      cursor: cursor ?? undefined,
    });
    const data = response.data;

    if (data.next_cursor === '') {
      await sleep(2000);
      continue;
    }

    cursor = data.next_cursor;
    added = added.concat(data.added);
    hasMore = data.has_more;
  }

  return { transactions: added, cursor };
}
