import mongoose from 'mongoose';
import { AccountBase, ItemWithConsentFields, Transaction as PlaidTransaction } from 'plaid';
import Item from '../models/Item.js';
import Account from '../models/Account.js';
import Transaction, { ITransaction } from '../models/Transaction.js';
import Card from '../models/Card.js';
import Benefit from '../models/Benefit.js';
import { encrypt } from './crypto.js';
import { resolveCardCategory, calculateRewards, computeBenefitPeriod } from './rewards.service.js';

// Sum |amount| across a set of transaction ObjectIds. Source of truth for Benefit.used.
async function sumBenefitUsed(txnIds: mongoose.Types.ObjectId[]): Promise<number> {
  if (!txnIds.length) return 0;
  const txns = await Transaction.find({ _id: { $in: txnIds } }, { 'plaidTransaction.amount': 1 });
  return txns.reduce((sum, t) => sum + Math.abs(t.plaidTransaction.amount), 0);
}

// Reconcile benefit membership for a transaction after upsert or category change.
// Detaches from any stale benefit, attaches to the matching one (creating the
// period doc if needed), and recomputes `used` from the linked transactions.
export async function reconcileBenefitsForTransaction(txn: ITransaction): Promise<void> {
  const account = await Account.findOne({ accountId: txn.accountId });
  if (!account) return;
  const card = await Card.findOne({ name: account.name, isActive: true });

  const cardBenefit = card?.benefits?.find(b => b.name === txn.category && b.trackingType !== 'manual');
  const txnDate = txn.plaidTransaction.authorized_date || txn.plaidTransaction.date;

  let targetBenefitId: mongoose.Types.ObjectId | null = null;
  if (cardBenefit && txnDate) {
    const [y, m] = txnDate.split('-').map(Number);
    const period = computeBenefitPeriod(cardBenefit.period, y, m - 1);
    const target = await Benefit.findOneAndUpdate(
      { userId: txn.userId, accountId: txn.accountId, benefitId: cardBenefit.id, period },
      {
        $setOnInsert: { used: 0, transactions: [] },
        $set: { total: cardBenefit.amount, lastModified: new Date() },
      },
      { upsert: true, returnDocument: 'after' }
    );
    targetBenefitId = target!._id as mongoose.Types.ObjectId;
  }

  // Detach from any benefit that currently holds this txn but isn't the target.
  const stale = await Benefit.find({
    userId: txn.userId,
    accountId: txn.accountId,
    transactions: txn._id,
    ...(targetBenefitId ? { _id: { $ne: targetBenefitId } } : {}),
  });
  for (const b of stale) {
    b.transactions = b.transactions.filter(id => !id.equals(txn._id as mongoose.Types.ObjectId));
    b.used = await sumBenefitUsed(b.transactions);
    b.lastModified = new Date();
    await b.save();
  }

  // Attach to target and recompute used (handles new link and amount changes).
  if (targetBenefitId) {
    const target = await Benefit.findById(targetBenefitId);
    if (target) {
      const txnObjectId = txn._id as mongoose.Types.ObjectId;
      if (!target.transactions.some(id => id.equals(txnObjectId))) {
        target.transactions.push(txnObjectId);
      }
      target.used = await sumBenefitUsed(target.transactions);
      target.lastModified = new Date();
      await target.save();
    }
  }
}

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

    const saved = await Transaction.findOneAndUpdate(
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
    if (saved) await reconcileBenefitsForTransaction(saved);
    return saved;
  }));
}
