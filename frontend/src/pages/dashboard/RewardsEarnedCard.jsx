import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import TrendChart from '../../components/charts/TrendChart'
import { useAppData } from '../../state/useAppData'
import { currentMonthPeriod, getPriorMonth } from '../../state/period'
import { calculateCashbackValue, getMonthlyTrendData } from '../../utils/rewards'
import './RewardsEarnedCard.css'

const formatDollars = (n) => `$${Math.round(n).toLocaleString()}`
const monthName = (p) => new Date(p.year, p.month).toLocaleString('default', { month: 'long' })
const ordinal = (n) => {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

export default function RewardsEarnedCard() {
  const { accounts, accountCache } = useAppData()

  const isLoading = accounts.length > 0 && accounts.some(a => !accountCache[a.accountId])

  const period = useMemo(() => currentMonthPeriod(), [])
  const priorPeriod = useMemo(() => getPriorMonth(period), [period])

  const totalCurrent = useMemo(() => {
    return accounts.reduce((sum, a) => {
      const cached = accountCache[a.accountId]
      if (!cached) return sum
      return sum + calculateCashbackValue(cached.transactions, cached.card, period)
    }, 0)
  }, [accounts, accountCache, period])

  const totalPrior = useMemo(() => {
    return accounts.reduce((sum, a) => {
      const cached = accountCache[a.accountId]
      if (!cached) return sum
      return sum + calculateCashbackValue(cached.transactions, cached.card, priorPeriod)
    }, 0)
  }, [accounts, accountCache, priorPeriod])

  const delta = totalCurrent - totalPrior
  const deltaIsPositive = delta > 0
  const deltaIsNegative = delta < 0

  const trendData = useMemo(
    () => getMonthlyTrendData(accounts, accountCache, period, priorPeriod),
    [accounts, accountCache, period, priorPeriod]
  )

  const tooltipContent = (point) => {
    const { x: day, current, prior } = point
    if (typeof current === 'number') {
      const priorAtDay = typeof prior === 'number' ? prior : 0
      const diff = current - priorAtDay
      const direction = diff >= 0 ? 'more' : 'less'
      return `By ${monthName(period)} ${ordinal(day)}, you earned ${formatDollars(Math.abs(diff))} ${direction} than last month`
    }
    if (typeof prior === 'number') {
      return `Last month, by ${monthName(priorPeriod)} ${ordinal(day)}, you earned ${formatDollars(prior)}`
    }
    return null
  }

  const hasData = totalCurrent > 0 || totalPrior > 0

  const deltaBadge = !isLoading && (deltaIsPositive || deltaIsNegative) ? (
    <div className="rewards-card__delta">
      {deltaIsPositive
        ? <ArrowUpCircle size={24} className="rewards-card__delta-icon rewards-card__delta-icon--up" />
        : <ArrowDownCircle size={24} className="rewards-card__delta-icon rewards-card__delta-icon--down" />}
      <span className="rewards-card__delta-text">
        You&rsquo;ve earned {formatDollars(Math.abs(delta))} {deltaIsPositive ? 'more' : 'less'} than last month
      </span>
    </div>
  ) : null

  return (
    <Card title="Rewards Earned" action={deltaBadge} className="rewards-card">
      <div className="rewards-card__big-number">
        {isLoading ? '—' : formatDollars(totalCurrent)}
      </div>
      <div className="rewards-card__chart">
        {isLoading && <div className="rewards-card__placeholder">Loading…</div>}
        {!isLoading && !hasData && (
          <div className="rewards-card__placeholder">No rewards yet this month.</div>
        )}
        {!isLoading && hasData && (
          <TrendChart
            data={trendData}
            yFormatter={formatDollars}
            xFormatter={ordinal}
            tooltipContent={tooltipContent}
            legend={{ current: 'This Month', prior: 'Last Month' }}
          />
        )}
      </div>
      <Button as={Link} to="/spending" variant="secondary" className="rewards-card__action">
        See All Spending Insights
      </Button>
    </Card>
  )
}
