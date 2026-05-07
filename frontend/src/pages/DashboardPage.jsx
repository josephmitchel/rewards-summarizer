import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import MonthSelector from '../components/ui/MonthSelector'
import BenefitsSection from '../components/ui/BenefitsSection'
import TransactionsTable from '../components/ui/TransactionsTable'
import { filterByPeriod, calculateCashbackValue, calculateTotalSpend, monthsWithData } from '../utils/rewards'
import { useAppData } from '../state/useAppData'
import { clampToBounds, periodToKey } from '../state/period'

export default function DashboardPage() {
  const {
    accounts,
    accountCache,
    benefitsCache,
    txnRange,
    selectedPeriod,
    setSelectedPeriod,
    ensureAccountData,
    ensureBenefits,
    updateTransactionCategory,
    updateBenefitUsed,
  } = useAppData()

  const effectivePeriod = useMemo(
    () => clampToBounds(selectedPeriod, txnRange),
    [selectedPeriod, txnRange]
  )
  const periodKey = periodToKey(effectivePeriod)

  useEffect(() => {
    ensureAccountData(accounts.map(a => a.accountId))
  }, [accounts, ensureAccountData])

  useEffect(() => {
    ensureBenefits(accounts.map(a => a.accountId), effectivePeriod)
  }, [accounts, effectivePeriod, ensureBenefits])

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
    () => filterByPeriod(allTransactions, effectivePeriod),
    [allTransactions, effectivePeriod]
  )

  const totalRewards = useMemo(() => {
    return accounts.reduce((sum, a) => {
      const cached = accountCache[a.accountId]
      if (!cached) return sum
      return sum + calculateCashbackValue(cached.transactions, cached.card, effectivePeriod)
    }, 0)
  }, [accounts, accountCache, effectivePeriod])

  const netRewards = useMemo(() => {
    return accounts.reduce((sum, a) => {
      const cached = accountCache[a.accountId]
      if (!cached) return sum
      const rewards = calculateCashbackValue(cached.transactions, cached.card, effectivePeriod)
      const feeCost = (cached.card?.annualFee ?? 0) / 12 * monthsWithData(cached.transactions, effectivePeriod)
      return sum + rewards - feeCost
    }, 0)
  }, [accounts, accountCache, effectivePeriod])

  const totalSpend = useMemo(
    () => calculateTotalSpend(allTransactions, effectivePeriod),
    [allTransactions, effectivePeriod]
  )

  const isLoading = accounts.some(a => !accountCache[a.accountId])

  return (
    <div>
      <h2>Dashboard</h2>
      <MonthSelector selectedPeriod={effectivePeriod} onChange={setSelectedPeriod} bounds={txnRange} />
      <p>Total Spend: ${totalSpend.toFixed(2)}</p>
      <p>Total Rewards: ${totalRewards.toFixed(2)}</p>
      <p>Net Rewards: ${netRewards.toFixed(2)}</p>
      {isLoading && <p>Loading account data...</p>}

      <h3>Accounts</h3>
      <ul>
        {accounts.map(a => (
          <li key={a.accountId}>
            <Link to={`/spending/${a.accountId}`}>{a.name} ({a.subtype})</Link>
          </li>
        ))}
      </ul>

      {accounts.map(a => {
        const benefits = benefitsCache[a.accountId]?.[periodKey] ?? []
        if (!benefits.length) return null
        return (
          <BenefitsSection
            key={a.accountId}
            benefits={benefits}
            selectedPeriod={effectivePeriod}
            onUsedChange={updateBenefitUsed}
            title={`${a.name} Benefits`}
          />
        )
      })}

      <h3>Transactions</h3>
      <TransactionsTable
        transactions={periodTransactions}
        cardByAccountId={cardByAccountId}
        accountNameById={accountNameById}
        onCategoryChange={updateTransactionCategory}
        showAccountColumn
      />
    </div>
  )
}
