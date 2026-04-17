import { useMemo } from 'react'
import MonthSelector from './components/MonthSelector'
import BenefitsSection from './components/BenefitsSection'
import TransactionsTable from './components/TransactionsTable'
import { filterByPeriod, calculateCashbackValue, calculateNetRewards, calculateTotalSpend } from './utils/rewards'

export default function AccountPage({ account, cachedData, benefits, selectedPeriod, bounds, onPeriodChange, onCategoryChange, onBenefitUsedChange }) {
  const transactions = useMemo(() => cachedData?.transactions ?? [], [cachedData])
  const card = cachedData?.card ?? null

  const periodTransactions = useMemo(
    () => filterByPeriod(transactions, selectedPeriod),
    [transactions, selectedPeriod]
  )

  const cardByAccountId = useMemo(
    () => (account && card ? { [account.accountId]: card } : {}),
    [account, card]
  )

  const totalRewards = useMemo(
    () => calculateCashbackValue(transactions, card, selectedPeriod),
    [transactions, card, selectedPeriod]
  )

  const netRewards = useMemo(
    () => calculateNetRewards(transactions, card, selectedPeriod),
    [transactions, card, selectedPeriod]
  )

  const totalSpend = useMemo(
    () => calculateTotalSpend(transactions, selectedPeriod),
    [transactions, selectedPeriod]
  )

  if (!account || !cachedData) return <p>Loading...</p>

  return (
    <div>
      <h2>{account.name}</h2>
      <p>Type: {account.type} / {account.subtype}</p>
      <p>Balance: {account.balances.current}</p>
      {account.mask && <p>Account ending in {account.mask}</p>}

      <MonthSelector selectedPeriod={selectedPeriod} onChange={onPeriodChange} bounds={bounds} />

      <BenefitsSection benefits={benefits} selectedPeriod={selectedPeriod} onUsedChange={onBenefitUsedChange} />

      <h3>Transactions</h3>
      <p>Total Spend: ${totalSpend.toFixed(2)}</p>
      <p>Total Rewards: ${totalRewards.toFixed(2)}</p>
      <p>Net Rewards: ${netRewards.toFixed(2)}</p>
      <TransactionsTable
        transactions={periodTransactions}
        cardByAccountId={cardByAccountId}
        onCategoryChange={onCategoryChange}
      />
    </div>
  )
}
