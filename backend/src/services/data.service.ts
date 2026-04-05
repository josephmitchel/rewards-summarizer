import mongoose from 'mongoose';
import { AccountBase, ItemWithConsentFields, Transaction as PlaidTransaction } from 'plaid';
import Item from '../models/Item.js';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import { encrypt } from './crypto.js';

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
  return Promise.all(transactions.map(txn =>
    Transaction.findOneAndUpdate(
      { transactionId: txn.transaction_id },
      {
        userId: new mongoose.Types.ObjectId(userId),
        itemId,
        accountId: txn.account_id,
        accountOwner: txn.account_owner,
        amount: txn.amount,
        authorizedDate: txn.authorized_date,
        authorizedDatetime: txn.authorized_datetime,
        category: txn.category,
        categoryId: txn.category_id,
        checkNumber: txn.check_number,
        counterparties: txn.counterparties?.map(c => ({
          confidenceLevel: c.confidence_level,
          entityId: c.entity_id,
          logoUrl: c.logo_url,
          name: c.name,
          phoneNumber: (c as any).phone_number,
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
        merchantIdentityId: txn.merchant_entity_id,
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
}
