// selectedPeriod: { mode: 'month' | 'year', year: number, month: number }
// In year mode, `month` is ignored.

export function filterByPeriod(transactions, selectedPeriod) {
  return transactions.filter(txn => {
    const date = txn.plaidTransaction.authorized_date
    if (!date) return false
    const [y, m] = date.split('-').map(Number)
    if (y !== selectedPeriod.year) return false
    if (selectedPeriod.mode === 'year') return true
    return m - 1 === selectedPeriod.month
  })
}

export function getResetDate(periodType, selectedPeriod) {
  // Reset dates only make sense in month mode — year mode aggregates across periods.
  if (selectedPeriod.mode === 'year') return null
  const { year, month } = selectedPeriod
  if (periodType === 'monthly') {
    const next = new Date(year, month + 1, 1)
    return `1st of ${next.toLocaleString('default', { month: 'long', year: 'numeric' })}`
  } else if (periodType === 'annually') {
    return `January 1st, ${year + 1}`
  } else if (periodType === 'semi-annually') {
    const half = Math.floor(month / 6)
    const next = half === 0 ? new Date(year, 6, 1) : new Date(year + 1, 0, 1)
    return `${next.toLocaleString('default', { month: 'long' })} 1st, ${next.getFullYear()}`
  }
  return null
}

// Dollar value of a single transaction's rewards.
// Cashback cards return the cashback field; points cards return points × baseRedemptionValue.
export function getTransactionValue(txn, card) {
  if (!card) return 0
  if (card.rewardType === 'cashback') return txn.cashback ?? 0
  if (card.rewardType === 'points') return (txn.points ?? 0) * (card.baseRedemptionValue ?? 0)
  return 0
}

export function calculateTotalSpend(transactions, selectedPeriod) {
  return filterByPeriod(transactions, selectedPeriod).reduce((sum, txn) => {
    const amount = txn.plaidTransaction.amount
    if (amount > 0) return sum + amount
    if (txn.category === 'Refund') return sum + amount
    return sum
  }, 0)
}

// Count of distinct months (0-11) within the selected period for which the
// transaction set has any data. Used to prorate annual fees by actual coverage.
export function monthsWithData(transactions, selectedPeriod) {
  const months = new Set()
  for (const txn of transactions) {
    const date = txn.plaidTransaction.authorized_date
    if (!date) continue
    const [y, m] = date.split('-').map(Number)
    if (y !== selectedPeriod.year) continue
    if (selectedPeriod.mode === 'month' && m - 1 !== selectedPeriod.month) continue
    months.add(m - 1)
  }
  return months.size
}

// Rewards minus the prorated annual fee for the selected period.
// In month mode the fee is divided by 12; in year mode the full fee is subtracted.
export function calculateNetRewards(transactions, card, selectedPeriod) {
  if (!card) return 0
  const divisor = selectedPeriod.mode === 'year' ? 1 : 12
  return calculateCashbackValue(transactions, card, selectedPeriod) - (card.annualFee ?? 0) / divisor
}

// Total rewards in dollars for a card's transactions in the selected period.
// Includes card rewards on purchases plus benefit credits (negative transactions
// whose category matches one of the card's benefit names).
export function calculateCashbackValue(transactions, card, selectedPeriod) {
  if (!card) return 0
  const benefitNames = new Set(card.benefits?.map(b => b.name) ?? [])
  const filtered = filterByPeriod(transactions, selectedPeriod)
  const benefitCredits = filtered
    .filter(txn => txn.plaidTransaction.amount < 0 && benefitNames.has(txn.category))
    .reduce((sum, txn) => sum + Math.abs(txn.plaidTransaction.amount), 0)
  const rewardValue = filtered.reduce((sum, txn) => sum + getTransactionValue(txn, card), 0)
  return rewardValue + benefitCredits
}
