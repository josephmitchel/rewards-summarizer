import { useState, useMemo } from 'react'
import { parseAmount, formatMonth, formatMultiplier } from './utils/csvParser'
import SpendingChart from './SpendingChart'

const POINTS_TO_DOLLARS = 0.008

const STATUS_CONFIG = {
  PENDING:  { label: 'Pending',  className: 'status-pending' },
  EARNED:   { label: 'Earned',   className: 'status-earned' },
  ADJUSTED: { label: 'Adjusted', className: 'status-adjusted' },
  REDEEMED: { label: 'Redeemed', className: 'status-redeemed' },
}

export default function CardPage({ transactions, rewardKey, rewardLabel, isPoints, theme }) {
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const yrs = [...new Set(transactions.map(t => t.Date.substring(0, 4)))].sort()
    return yrs.at(-1) || String(new Date().getFullYear())
  })

  const months = useMemo(() => {
    const s = new Set(transactions.map(t => t.Date.substring(0, 7)))
    return Array.from(s).sort()
  }, [transactions])

  const years = useMemo(() => {
    const s = new Set(transactions.map(t => t.Date.substring(0, 4)))
    return Array.from(s).sort()
  }, [transactions])

  // periods: ['2025', '2025-01', '2025-02', ..., '2026', '2026-01', ...]
  const periods = useMemo(
    () => years.flatMap(y => [y, ...months.filter(m => m.startsWith(y))]),
    [years, months]
  )

  const currentIndex = periods.indexOf(selectedPeriod)
  const goBack    = () => { if (currentIndex > 0)                    setSelectedPeriod(periods[currentIndex - 1]) }
  const goForward = () => { if (currentIndex < periods.length - 1)   setSelectedPeriod(periods[currentIndex + 1]) }

  const filtered = useMemo(() => {
    const base = transactions.filter(t => t.Date.startsWith(selectedPeriod))
    return [...base].sort((a, b) => b.Date.localeCompare(a.Date))
  }, [transactions, selectedPeriod])

  const summary = useMemo(() => {
    const totalSpent = filtered.reduce((sum, t) => {
      const amt = parseAmount(t.Amount)
      return sum + (amt > 0 ? amt : 0)
    }, 0)
    const totalRewards = filtered.reduce((sum, t) => {
      const val = parseAmount(t[rewardKey])
      return sum + (val > 0 ? val : 0)
    }, 0)
    const rewardDollars = isPoints ? totalRewards * POINTS_TO_DOLLARS : totalRewards
    const rewardRate = totalSpent > 0 ? rewardDollars / totalSpent : 0

    let numDays = 1
    if (selectedPeriod.length === 4) {
      // Year selected — use actual date range of filtered transactions
      if (filtered.length > 1) {
        const dates = filtered.map(t => t.Date).sort()
        const start = new Date(dates[0] + 'T00:00:00')
        const end   = new Date(dates[dates.length - 1] + 'T00:00:00')
        numDays = Math.max(1, Math.round((end - start) / 86400000) + 1)
      }
    } else {
      const [y, m] = selectedPeriod.split('-').map(Number)
      numDays = new Date(y, m, 0).getDate()
    }

    const rewardPerDay = rewardDollars / numDays

    const eligible = filtered.filter(t => t.Status === 'EARNED' || t.Status === 'PENDING')
    const avgMultiplier = eligible.length > 0
      ? eligible.reduce((sum, t) => {
          const parsed = parseFloat(t.Multiplier)
          return sum + (isNaN(parsed) ? 1 : parsed)
        }, 0) / eligible.length
      : 0

    return { totalSpent, totalRewards, rewardDollars, rewardRate, rewardPerDay, avgMultiplier, count: filtered.length }
  }, [filtered, rewardKey, isPoints, selectedPeriod])

  const rewardDisplay = (raw) => {
    const val = parseAmount(raw)
    if (val === 0) return '—'
    const abs = Math.abs(val)
    const sign = val < 0 ? '-' : ''
    if (isPoints) return `${sign}${Math.round(abs).toLocaleString()}`
    return `${sign}$${abs.toFixed(2)}`
  }

  const periodLabel = (period) => period.length === 4 ? period : formatMonth(period)

  const amountDisplay = (raw) => {
    const val = parseAmount(raw)
    if (val === 0) return '$0.00'
    const abs = Math.abs(val)
    return val < 0 ? `-$${abs.toFixed(2)}` : `$${abs.toFixed(2)}`
  }

  return (
    <div className={`card-page ${theme}-page`}>
      <div className="page-body">
        <div className={`summary-row ${isPoints ? 'summary-row-7' : 'summary-row-6'}`}>
          <div className="summary-card">
            <div className="summary-label">Total Spent</div>
            <div className="summary-value">${summary.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="summary-sub">{periodLabel(selectedPeriod)}</div>
          </div>
          <div className={`summary-card summary-card-accent ${theme}-accent-card`}>
            <div className="summary-label">Total {rewardLabel}</div>
            <div className="summary-value accent-value">
              {isPoints
                ? `${Math.round(summary.totalRewards).toLocaleString()} pts`
                : `$${summary.totalRewards.toFixed(2)}`}
            </div>
            <div className="summary-sub">{periodLabel(selectedPeriod)}</div>
          </div>
          {isPoints && (
            <div className={`summary-card summary-card-accent ${theme}-accent-card`}>
              <div className="summary-label">Est. Dollar Value</div>
              <div className="summary-value accent-value">
                ${(summary.totalRewards * POINTS_TO_DOLLARS).toFixed(2)}
              </div>
            </div>
          )}
          <div className="summary-card">
            <div className="summary-label">Earned per $1</div>
            <div className="summary-value rate-value">${summary.rewardRate.toFixed(3)}</div>
            <div className="summary-sub">avg return</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Avg Bonus Rate</div>
            <div className="summary-value rate-value">{summary.avgMultiplier.toFixed(1)}{isPoints ? 'x' : '%'}</div>
            <div className="summary-sub">per transaction</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Transactions</div>
            <div className="summary-value">{summary.count}</div>
            <div className="summary-sub">{periodLabel(selectedPeriod)}</div>
          </div>
        </div>

        <SpendingChart
          transactions={transactions}
          selectedPeriod={selectedPeriod}
          valueKey={rewardKey}
          valueLabel={rewardLabel}
          color={theme === 'gold' ? '#b8892a' : '#006fcf'}
          isPoints={isPoints}
          dailyYear
          yMax={{ year: 1000, month: 100 }}
        />

        <div className="filter-section">
          <div className="filter-controls">
            <div className="period-nav">
              <button
                className="nav-arrow"
                onClick={goBack}
                disabled={currentIndex === 0}
                aria-label="Previous period"
              >
                ‹
              </button>
              <span className="period-nav-label">
                {periodLabel(selectedPeriod)}
              </span>
              <button
                className="nav-arrow"
                onClick={goForward}
                disabled={currentIndex === periods.length - 1}
                aria-label="Next period"
              >
                ›
              </button>
            </div>
          </div>
        </div>

        <div className="table-container">
          <table className="tx-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Bonus</th>
                <th className="col-right">Amount</th>
                <th className="col-right">{rewardLabel}</th>
                {isPoints && <th className="col-right">Est. Value</th>}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx, i) => {
                const mult = formatMultiplier(tx.Multiplier)
                const statusCfg = STATUS_CONFIG[tx.Status] || STATUS_CONFIG.PENDING
                const amt = parseAmount(tx.Amount)
                return (
                  <tr key={i} className={amt < 0 ? 'row-negative' : ''}>
                    <td className="col-date">{tx.Date}</td>
                    <td className="col-desc">{tx.Description}</td>
                    <td className="col-mult">
                      <span className={`mult-badge ${theme}-mult`}>{mult || (isPoints ? '1x' : '1%')}</span>
                    </td>
                    <td className={`col-right col-amount ${amt < 0 ? 'neg-amount' : ''}`}>
                      {amountDisplay(tx.Amount)}
                    </td>
                    <td className={`col-right col-reward ${theme}-reward`}>
                      {rewardDisplay(tx[rewardKey])}
                    </td>
                    {isPoints && (() => {
                      const pts = parseAmount(tx[rewardKey])
                      const dollarVal = pts * POINTS_TO_DOLLARS
                      return (
                        <td className="col-right col-est-value">
                          {pts > 0 ? `$${dollarVal.toFixed(2)}` : '—'}
                        </td>
                      )
                    })()}
                    <td>
                      <span className={`status-badge ${statusCfg.className}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
