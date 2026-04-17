import Account from '../models/Account.js';
import Card from '../models/Card.js';
import TransactionCategory from '../models/TransactionCategory.js';

// Encode a benefit's period window as "YYMM-YYMM" for the given calendar month (0-indexed).
export function computeBenefitPeriod(
  periodType: 'monthly' | 'annually' | 'semi-annually',
  year: number,
  month0: number,
): string {
  const yy = String(year % 100).padStart(2, '0');
  if (periodType === 'monthly') {
    const mm = String(month0 + 1).padStart(2, '0');
    return `${yy}${mm}-${yy}${mm}`;
  }
  if (periodType === 'annually') {
    return `${yy}01-${yy}12`;
  }
  // semi-annually
  const firstHalf = month0 < 6;
  return firstHalf ? `${yy}01-${yy}06` : `${yy}07-${yy}12`;
}

// Resolves a Plaid detailed category string to the user-facing category using
// the transactionCategories collection. Matching priority:
//   1. Exact match (e.g. "FOOD_AND_DRINK_GROCERIES")
//   2. Most-specific wildcard prefix (e.g. "FOOD_AND_DRINK*")
//   3. Catch-all "*"
export async function resolveDebitCategory(plaidDetailedCategory: string | null | undefined): Promise<string> {
  if (!plaidDetailedCategory) return 'Other';

  const allMappings = await TransactionCategory.find({});

  // Exact match
  const exact = allMappings.find(m => m.plaidCategory === plaidDetailedCategory);
  if (exact) return exact.userCategory;

  // Wildcard matches — find entries ending in "*", strip the "*", check prefix
  const wildcards = allMappings
    .filter(m => m.plaidCategory.endsWith('*') && m.plaidCategory !== '*')
    .map(m => ({ prefix: m.plaidCategory.slice(0, -1), userCategory: m.userCategory }))
    .filter(m => plaidDetailedCategory.startsWith(m.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length); // most specific first

  if (wildcards.length > 0) return wildcards[0].userCategory;

  // Catch-all
  const catchAll = allMappings.find(m => m.plaidCategory === '*');
  return catchAll?.userCategory ?? 'Other';
}

// Resolves a category for a negative (credit) transaction.
// Defaults to "Card Payment" — the user can override via the dropdown.
export function resolveCreditCategory(): string {
  return 'Card Payment';
}

// Resolves a category for a specific account's card, dispatching on the sign
// of the amount: negative → resolveCreditCategory, positive → resolveDebitCategory
// validated against the card's reward tiers.
export async function resolveCardCategory(accountId: string, plaidDetailedCategory: string | null | undefined, amount: number): Promise<string> {
  if (amount < 0) return resolveCreditCategory();

  const category = await resolveDebitCategory(plaidDetailedCategory);

  const account = await Account.findOne({ accountId });
  if (!account) return category;

  const card = await Card.findOne({ name: account.name, isActive: true });
  if (!card) return category;

  const isOnCard = card.rewards.some(r => r.category === category);
  return isOnCard ? category : 'Other';
}

// Calculates cashback or points for a transaction.
// Returns { cashback } for cashback cards and { points } for points cards.
// Returns null if the account or card can't be found, or if the transaction
// is not a purchase (negative amount = refund/credit).
export async function calculateRewards(
  accountId: string,
  category: string,
  amount: number,
): Promise<{ cashback: number; points: 0 } | { points: number; cashback: 0 } | null> {
  // Only calculate rewards for purchases (positive = money out)
  if (amount <= 0) return null;

  const account = await Account.findOne({ accountId });
  if (!account) return null;

  const card = await Card.findOne({ name: account.name, isActive: true });
  if (!card) return null;

  const rewardTier = card.rewards.find(r => r.category === category)
    ?? card.rewards.find(r => r.category === 'Other');
  if (!rewardTier) return null;

  const rate = rewardTier.rate;

  if (card.rewardType === 'cashback') {
    return { cashback: Math.round(amount * (rate / 100) * 100) / 100, points: 0 };
  } else {
    return { points: Math.round(amount * rate), cashback: 0 };
  }
}
