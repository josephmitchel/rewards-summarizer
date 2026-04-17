import { useMemo } from 'react'
import MonthSelector from './components/MonthSelector'
import BenefitsSection from './components/BenefitsSection'
import TransactionsTable from './components/TransactionsTable'
import { filterByPeriod, calculateCashbackValue, calculateTotalSpend, monthsWithData } from './utils/rewards'

export default function HomePage({ accounts, accountCache, benefitsByAccount, selectedPeriod, bounds, onPeriodChange, onCategoryChange, onBenefitUsedChange }) {
  const cardByAccountId = useMemo(() => {
    const map = {}
    for (const a of accounts) {
      const c = accountCache[a.accountId]?.card
      if (c) map[a.accountId] = c
    }
    return map
  }, [accounts, accountCache])

  const accountNameById = useMemo(() => {
    const map = {}
    for (const a of accounts) map[a.accountId] = a.name
    return map
  }, [accounts])

  const allTransactions = useMemo(
    () => accounts.flatMap(a => accountCache[a.accountId]?.transactions ?? []),
    [accounts, accountCache]
  )

  const periodTransactions = useMemo(
    () => filterByPeriod(allTransactions, selectedPeriod),
    [allTransactions, selectedPeriod]
  )

  const totalRewards = useMemo(() => {
    return accounts.reduce((sum, a) => {
      const cached = accountCache[a.accountId]
      if (!cached) return sum
      return sum + calculateCashbackValue(cached.transactions, cached.card, selectedPeriod)
    }, 0)
  }, [accounts, accountCache, selectedPeriod])

  const netRewards = useMemo(() => {
    return accounts.reduce((sum, a) => {
      const cached = accountCache[a.accountId]
      if (!cached) return sum
      const rewards = calculateCashbackValue(cached.transactions, cached.card, selectedPeriod)
      const feeCost = (cached.card?.annualFee ?? 0) / 12 * monthsWithData(cached.transactions, selectedPeriod)
      return sum + rewards - feeCost
    }, 0)
  }, [accounts, accountCache, selectedPeriod])

  const totalSpend = useMemo(
    () => calculateTotalSpend(allTransactions, selectedPeriod),
    [allTransactions, selectedPeriod]
  )

  const isLoading = accounts.some(a => !accountCache[a.accountId])

  return (
    <div>
      <h2>Home</h2>
      <MonthSelector selectedPeriod={selectedPeriod} onChange={onPeriodChange} bounds={bounds} />
      <p>Total Spend: ${totalSpend.toFixed(2)}</p>
      <p>Total Rewards: ${totalRewards.toFixed(2)}</p>
      <p>Net Rewards: ${netRewards.toFixed(2)}</p>
      {isLoading && <p>Loading account data...</p>}

      {accounts.map(a => {
        const benefits = benefitsByAccount?.[a.accountId] ?? []
        if (!benefits.length) return null
        return (
          <BenefitsSection
            key={a.accountId}
            benefits={benefits}
            selectedPeriod={selectedPeriod}
            onUsedChange={onBenefitUsedChange}
            title={`${a.name} Benefits`}
          />
        )
      })}

      <h3>Transactions</h3>
      <TransactionsTable
        transactions={periodTransactions}
        cardByAccountId={cardByAccountId}
        accountNameById={accountNameById}
        onCategoryChange={onCategoryChange}
        showAccountColumn
      />
    </div>
  )
}
