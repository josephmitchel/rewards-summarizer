import dotenv from 'dotenv';
dotenv.config();

import { Router } from 'express';
import PlaidTransaction from '../models/PlaidTransaction.js';
import plaidPkg from 'plaid';
import moment from 'moment';
import util from 'util';
const { Configuration, PlaidApi, PlaidEnvironments, Products } = plaidPkg;

const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';
const PLAID_PRODUCTS = (process.env.PLAID_PRODUCTS || Products.Transactions).split(',');
const PLAID_COUNTRY_CODES = (process.env.PLAID_COUNTRY_CODES || 'US').split(',');
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

let ACCESS_TOKEN = null;
let PUBLIC_TOKEN = null;
let REQUEST_TOKEN = null;
let ITEM_ID = null;

const prettyPrintResponse = (response) => {
  console.log(util.inspect(response.data, { colors: true, depth: 4 }));
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


const router = Router();

router.post('/create_link_token', function (req, res, next) {
  Promise.resolve()
    .then(async function () {
      const configs = {
        user: { client_user_id: 'user-id' },
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

router.post('/set_access_token', function (request, response, next) {
  console.log('POST /api/set_access_token', request.body);
  PUBLIC_TOKEN = request.body.public_token;
  Promise.resolve()
    .then(async function () {
      const tokenResponse = await client.itemPublicTokenExchange({
        public_token: PUBLIC_TOKEN,
      });
      prettyPrintResponse(tokenResponse);
      ACCESS_TOKEN = tokenResponse.data.access_token;
      ITEM_ID = tokenResponse.data.item_id;
      REQUEST_TOKEN = tokenResponse.data.request_id;
      response.json({
        access_token: ACCESS_TOKEN,
        item_id: ITEM_ID,
        request_id: REQUEST_TOKEN,
        error: null,
      });
    })
    .catch(next);
});

// Retrieve Transactions for an Item
// https://plaid.com/docs/#transactions
router.get('/transactions', function (request, response, next) {
  Promise.resolve()
    .then(async function () {
      // Set cursor to empty to receive all historical updates
      let cursor = null;

      // New transaction updates since "cursor"
      let added = [];
      let modified = [];
      // Removed transaction ids
      let removed = [];
      let hasMore = true;
      // Iterate through each page of new transaction updates for item
      while (hasMore) {
        const request = {
          access_token: ACCESS_TOKEN,
          cursor: cursor,
        };
        const response = await client.transactionsSync(request)
        const data = response.data;

        // If no transactions are available yet, wait and poll the endpoint.
        // Normally, we would listen for a webhook, but the Quickstart doesn't
        // support webhooks. For a webhook example, see
        // https://github.com/plaid/tutorial-resources or
        // https://github.com/plaid/pattern
        cursor = data.next_cursor;
        if (cursor === "") {
          await sleep(2000);
          continue;
        }

        // Add this page of results
        added = added.concat(data.added);
        modified = modified.concat(data.modified);
        removed = removed.concat(data.removed);
        hasMore = data.has_more;

        // prettyPrintResponse(response);
      }

      await Promise.all(added.map(txn => {
        console.log('transaction', txn.transaction_id);
        console.log('counterparty', txn.counterparties);
        console.log('');
        const plainTxn = JSON.parse(JSON.stringify(txn));
        // return PlaidTransaction.updateOne(
        //   { transaction_id: plainTxn.transaction_id },
        //   { $set: plainTxn },
        //   { upsert: true }
        // );
      }));

      const compareTxnsByDateAscending = (a, b) => (a.date > b.date) - (a.date < b.date);
      const recently_added = [...added].sort(compareTxnsByDateAscending);
      response.json({
        latest_transactions: recently_added,
        cursor: cursor,
      });
    })
    .catch(next);
});

export default router;