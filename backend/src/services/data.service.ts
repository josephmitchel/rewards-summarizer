import mongoose from 'mongoose';
import { AccountBase, ItemWithConsentFields, Transaction as PlaidTransaction } from 'plaid';
import Item from '../models/Item.js';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import { encrypt } from './crypto.js';
import { resolveCardCategory, calculateRewards } from './rewards.service.js';

export async function upsertItem(
  userId: string,
  accessToken: string,
  plaidItem: ItemWithConsentFields,
) {
  return Item.findOneAndUpdate(
    { itemId: plaidItem.item_id },
    {
      userId: new mongoose.Types.ObjectId(userId),
      itemId: plaidItem.item_id,
      accessToken: encrypt(accessToken),
      institutionId: plaidItem.institution_id ?? null,
      institutionName: plaidItem.institution_name ?? null,
      webhook: plaidItem.webhook,
      error: plaidItem.error,
      availableProducts: plaidItem.available_products,
      billedProducts: plaidItem.billed_products,
      products: plaidItem.products ?? [],
      consentedProducts: plaidItem.consented_products ?? [],
      consentExpirationTime: plaidItem.consent_expiration_time ?? null,
      updateType: plaidItem.update_type ?? null,
      createdAt: (plaidItem as any).created_at ?? null,
      consentedUseCases: (plaidItem as any).consented_use_cases ?? [],
      consentedDataScopes: (plaidItem as any).consented_data_scopes ?? [],
    },
    { upsert: true, returnDocument: 'after' }
  );
}

export async function upsertAccount(userId: string, itemId: string, account: AccountBase) {
  return Account.findOneAndUpdate(
    { accountId: account.account_id },
    {
      userId: new mongoose.Types.ObjectId(userId),
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
  );
}

export async function upsertTransactions(userId: string, itemId: string, transactions: PlaidTransaction[]) {
  return Promise.all(transactions.map(async txn => {
    const category = await resolveCardCategory(txn.account_id, txn.personal_finance_category?.detailed, txn.amount);
    const rewards = await calculateRewards(txn.account_id, category, txn.amount);

    return Transaction.findOneAndUpdate(
      { transactionId: txn.transaction_id },
      {
        $set: {
          userId: new mongoose.Types.ObjectId(userId),
          itemId,
          accountId: txn.account_id,
          transactionId: txn.transaction_id,
          category,
          plaidTransaction: txn,
          cashback: rewards?.cashback ?? 0,
          points: rewards?.points ?? 0,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
  }));
}
