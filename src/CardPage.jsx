import { useState, useMemo } from 'react'
import { parseAmount, formatMonth, formatMultiplier, getWeekStart, formatWeek } from './utils/csvParser'

const POINTS_TO_DOLLARS = 0.008

const STATUS_CONFIG = {
  PENDING:  { label: 'Pending',  className: 'status-pending' },
  EARNED:   { label: 'Earned',   className: 'status-earned' },
  ADJUSTED: { label: 'Adjusted', className: 'status-adjusted' },
  REDEEMED: { label: 'Redeemed', className: 'status-redeemed' },
}

export default function CardPage({ cardName, cardNumber, transactions, rewardKey, rewardLabel, isPoints, theme }) {
  const [viewBy, setViewBy] = useState('month')
  const [selectedPeriod, setSelectedPeriod] = useState('all')

  const months = useMemo(() => {
    const monthSet = new Set(transactions.map(t => t.Date.substring(0, 7)))
    return Array.from(monthSet).sort() // ascending
  }, [transactions])

  const weeks = useMemo(() => {
    const weekSet = new Set(transactions.map(t => getWeekStart(t.Date)))
    return Array.from(weekSet).sort() // ascending
  }, [transactions])

  // ['all', oldest…newest]
  const periods = useMemo(
    () => ['all', ...(viewBy === 'month' ? months : weeks)],
    [viewBy, months, weeks]
  )

  const currentIndex = periods.indexOf(selectedPeriod === 'all' ? 'all' : selectedPeriod)

  const goBack    = () => { if (currentIndex > 0)                    setSelectedPeriod(periods[currentIndex - 1]) }
  const goForward = () => { if (currentIndex < periods.length - 1)   setSelectedPeriod(periods[currentIndex + 1]) }

  const filtered = useMemo(() => {
    let base = transactions
    if (selectedPeriod !== 'all') {
      if (viewBy === 'month') {
        base = transactions.filter(t => t.Date.startsWith(selectedPeriod))
      } else {
        base = transactions.filter(t => getWeekStart(t.Date) === selectedPeriod)
      }
    }
    return [...base].sort((a, b) => b.Date.localeCompare(a.Date))
  }, [transactions, selectedPeriod, viewBy])

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
    const rewardRate = totalSpent > 0 ? (rewardDollars / totalSpent) * 100 : 0

    let numDays = 1
    if (selectedPeriod === 'all') {
      if (filtered.length > 1) {
        const dates = filtered.map(t => t.Date).sort()
        const start = new Date(dates[0] + 'T00:00:00')
        const end   = new Date(dates[dates.length - 1] + 'T00:00:00')
        numDays = Math.max(1, Math.round((end - start) / 86400000) + 1)
      }
    } else if (viewBy === 'week') {
      numDays = 7
    } else {
      const [y, m] = selectedPeriod.split('-').map(Number)
      numDays = new Date(y, m, 0).getDate()
    }

    const rewardPerDay = rewardDollars / numDays
    return { totalSpent, totalRewards, rewardDollars, rewardRate, rewardPerDay, count: filtered.length }
  }, [filtered, rewardKey, isPoints, selectedPeriod, viewBy])

  const rewardDisplay = (raw) => {
    const val = parseAmount(raw)
    if (val === 0) return '—'
    const abs = Math.abs(val)
    const sign = val < 0 ? '-' : ''
    if (isPoints) return `${sign}${Math.round(abs).toLocaleString()}`
    return `${sign}$${abs.toFixed(2)}`
  }

  const periodLabel = (period, view) => {
    if (period === 'all') return view === 'month' ? 'All months' : 'All weeks'
    return view === 'month' ? formatMonth(period) : formatWeek(period)
  }

  const amountDisplay = (raw) => {
    const val = parseAmount(raw)
    if (val === 0) return '$0.00'
    const abs = Math.abs(val)
    return val < 0 ? `-$${abs.toFixed(2)}` : `$${abs.toFixed(2)}`
  }

  return (
    <div className={`card-page ${theme}-page`}>
      <div className={`card-hero ${theme}-hero`}>
        <div className="card-hero-inner">
          <div className="card-visual">
            <div className="card-chip-row">
              <div className="card-chip" />
            </div>
            <div className="card-info-row">
              <div>
                <div className="card-name-text">{cardName}</div>
                <div className="card-num-text">···· {cardNumber.replace('-', '')}</div>
              </div>
              <div className={`card-logo-text ${theme}-logo`}>AMEX</div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className={`summary-row ${isPoints ? 'summary-row-6' : 'summary-row-5'}`}>
          <div className="summary-card">
            <div className="summary-label">Total Spent</div>
            <div className="summary-value">${summary.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="summary-sub">{periodLabel(selectedPeriod, viewBy)}</div>
          </div>
          <div className={`summary-card summary-card-accent ${theme}-accent-card`}>
            <div className="summary-label">Total {rewardLabel}</div>
            <div className="summary-value accent-value">
              {isPoints
                ? `${Math.round(summary.totalRewards).toLocaleString()} pts`
                : `$${summary.totalRewards.toFixed(2)}`}
            </div>
            <div className="summary-sub">{periodLabel(selectedPeriod, viewBy)}</div>
          </div>
          {isPoints && (
            <div className={`summary-card summary-card-accent ${theme}-accent-card`}>
              <div className="summary-label">Est. Dollar Value</div>
              <div className="summary-value accent-value">
                ${(summary.totalRewards * POINTS_TO_DOLLARS).toFixed(2)}
              </div>
              <div className="summary-sub">@ $0.008 / pt</div>
            </div>
          )}
          <div className="summary-card">
            <div className="summary-label">Reward Rate</div>
            <div className="summary-value rate-value">{summary.rewardRate.toFixed(2)}%</div>
            <div className="summary-sub">per $ spent</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Transactions</div>
            <div className="summary-value">{summary.count}</div>
            <div className="summary-sub">{periodLabel(selectedPeriod, viewBy)}</div>
          </div>
        </div>

        <div className="filter-section">
          <div className="filter-controls">
            <div className="view-toggle">
              <button
                className={`view-btn ${viewBy === 'month' ? `view-btn-active ${theme}-view-active` : ''}`}
                onClick={() => { setViewBy('month'); setSelectedPeriod('all') }}
              >
                Month
              </button>
              <button
                className={`view-btn ${viewBy === 'week' ? `view-btn-active ${theme}-view-active` : ''}`}
                onClick={() => { setViewBy('week'); setSelectedPeriod('all') }}
              >
                Week
              </button>
            </div>

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
                {periodLabel(selectedPeriod, viewBy)}
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
                      {mult ? (
                        <span className={`mult-badge ${theme}-mult`}>{mult}</span>
                      ) : (
                        <span className="mult-base">—</span>
                      )}
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
