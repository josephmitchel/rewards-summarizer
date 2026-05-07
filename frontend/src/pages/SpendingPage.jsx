import { useEffect, useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import MonthSelector from '../components/ui/MonthSelector'
import BenefitsSection from '../components/ui/BenefitsSection'
import TransactionsTable from '../components/ui/TransactionsTable'
import { filterByPeriod, calculateCashbackValue, calculateNetRewards, calculateTotalSpend } from '../utils/rewards'
import { useAppData } from '../state/useAppData'
import { clampToBounds, periodToKey } from '../state/period'

export default function SpendingPage() {
  const { accountId } = useParams()
  const {
    accounts,
    accountCache,
    benefitsCache,
    accountBounds,
    txnRange,
    selectedPeriod,
    setSelectedPeriod,
    ensureAccountData,
    ensureBenefits,
    updateTransactionCategory,
    updateBenefitUsed,
  } = useAppData()

  const account = accountId ? accounts.find(a => a.accountId === accountId) ?? null : null
  const cachedData = accountId ? accountCache[accountId] ?? null : null
  const bounds = accountId ? (accountBounds[accountId] ?? txnRange) : txnRange

  const effectivePeriod = useMemo(
    () => clampToBounds(selectedPeriod, bounds),
    [selectedPeriod, bounds]
  )
  const periodKey = periodToKey(effectivePeriod)
  const benefits = accountId ? (benefitsCache[accountId]?.[periodKey] ?? []) : []

  useEffect(() => {
    if (accountId) ensureAccountData([accountId])
  }, [accountId, ensureAccountData])

  useEffect(() => {
    if (accountId) ensureBenefits([accountId], effectivePeriod)
  }, [accountId, effectivePeriod, ensureBenefits])

  const transactions = useMemo(() => cachedData?.transactions ?? [], [cachedData])
  const card = cachedData?.card ?? null

  const periodTransactions = useMemo(
    () => filterByPeriod(transactions, effectivePeriod),
    [transactions, effectivePeriod]
  )

  const cardByAccountId = useMemo(
    () => (account && card ? { [account.accountId]: card } : {}),
    [account, card]
  )

  const totalRewards = useMemo(
    () => calculateCashbackValue(transactions, card, effectivePeriod),
    [transactions, card, effectivePeriod]
  )

  const netRewards = useMemo(
    () => calculateNetRewards(transactions, card, effectivePeriod),
    [transactions, card, effectivePeriod]
  )

  const totalSpend = useMemo(
    () => calculateTotalSpend(transactions, effectivePeriod),
    [transactions, effectivePeriod]
  )

  if (!accountId) {
    if (accounts.length === 0) {
      return (
        <div>
          <h2>Spending</h2>
          <p>Link a bank account to get started.</p>
        </div>
      )
    }
    return <Navigate to={`/spending/${accounts[0].accountId}`} replace />
  }

  if (!account || !cachedData) return <p>Loading...</p>

  return (
    <div>
      <h2>{account.name}</h2>
      <p>Type: {account.type} / {account.subtype}</p>
      <p>Balance: {account.balances.current}</p>
      {account.mask && <p>Account ending in {account.mask}</p>}

      <MonthSelector selectedPeriod={effectivePeriod} onChange={setSelectedPeriod} bounds={bounds} />

      <BenefitsSection benefits={benefits} selectedPeriod={effectivePeriod} onUsedChange={updateBenefitUsed} />

      <h3>Transactions</h3>
      <p>Total Spend: ${totalSpend.toFixed(2)}</p>
      <p>Total Rewards: ${totalRewards.toFixed(2)}</p>
      <p>Net Rewards: ${netRewards.toFixed(2)}</p>
      <TransactionsTable
        transactions={periodTransactions}
        cardByAccountId={cardByAccountId}
        onCategoryChange={updateTransactionCategory}
      />
    </div>
  )
}
