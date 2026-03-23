import dotenv from 'dotenv';
dotenv.config();

import { Router } from 'express';
import Transaction from '../models/Transaction.js';
import plaidPkg from 'plaid';
import moment from 'moment';
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

const router = Router();

router.get('/transactions', async (req, res) => {
  console.log('GET /api/transactions', req.query);
  const { Date: date } = req.query;
  console.log(date);
  const filter = {};

  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    filter.Date = { $gte: start, $lt: end };
  }

  const transactions = await Transaction.find(filter).sort({ Date: -1 });
  res.json(transactions);
});

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
  PUBLIC_TOKEN = request.body.public_token;
  Promise.resolve()
    .then(async function () {
      const tokenResponse = await client.itemPublicTokenExchange({
        public_token: PUBLIC_TOKEN,
      });
      prettyPrintResponse(tokenResponse);
      ACCESS_TOKEN = tokenResponse.data.access_token;
      ITEM_ID = tokenResponse.data.item_id;
      response.json({
        // the 'access_token' is a private token, DO NOT pass this token to the frontend in your production environment
        access_token: ACCESS_TOKEN,
        item_id: ITEM_ID,
        error: null,
      });
    })
    .catch(next);
});

export default router;