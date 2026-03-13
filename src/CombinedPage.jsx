import { useState, useMemo } from 'react'
import { parseAmount, formatMonth, formatMultiplier } from './utils/csvParser'

const POINTS_TO_DOLLARS = 0.006

const STATUS_CONFIG = {
  PENDING:  { label: 'Pending',  className: 'status-pending' },
  EARNED:   { label: 'Earned',   className: 'status-earned' },
  ADJUSTED: { label: 'Adjusted', className: 'status-adjusted' },
  REDEEMED: { label: 'Redeemed', className: 'status-redeemed' },
}

const SOURCE_CONFIG = {
  gold:     { label: 'Gold',     className: 'card-badge-gold' },
  blue:     { label: 'Blue',     className: 'card-badge-blue' },
  savings:  { label: 'HYSA',     className: 'card-badge-savings' },
  checking: { label: 'Checking', className: 'card-badge-checking' },
}

export default function CombinedPage({ goldTransactions, blueTransactions, savingsTransactions, checkingTransactions }) {
  const [selectedPeriod, setSelectedPeriod] = useState('all')

  const allRows = useMemo(() => {
    const gold = goldTransactions.map(t => ({
      ...t,
      _source: 'gold',
      _income: Math.max(0, parseAmount(t['Points/Miles'])) * POINTS_TO_DOLLARS,
      _isInterest: false,
    }))
    const blue = blueTransactions.map(t => ({
      ...t,
      _source: 'blue',
      _income: Math.max(0, parseAmount(t['Cash'])),
      _isInterest: false,
    }))
    const savings = savingsTransactions
      .filter(t => t.Description.toLowerCase().includes('interest'))
      .map(t => ({
        Date: t.Date,
        Description: t.Description,
        _source: 'savings',
        _income: t.Amount,
        _isInterest: true,
      }))
    const checking = checkingTransactions.map(t => ({
      Date: t.Date,
      Description: t.Description,
      _source: 'checking',
      _income: t.Amount,
      _isInterest: true,
    }))
    return [...gold, ...blue, ...savings, ...checking]
  }, [goldTransactions, blueTransactions, savingsTransactions, checkingTransactions])

  const months = useMemo(() => {
    const monthSet = new Set(allRows.map(t => t.Date.substring(0, 7)))
    return Array.from(monthSet).sort()
  }, [allRows])

  const periods = useMemo(() => ['all', ...months], [months])

  const currentIndex = periods.indexOf(selectedPeriod)
  const goBack    = () => { if (currentIndex > 0)                  setSelectedPeriod(periods[currentIndex - 1]) }
  const goForward = () => { if (currentIndex < periods.length - 1) setSelectedPeriod(periods[currentIndex + 1]) }

  const filtered = useMemo(() => {
    const base = selectedPeriod === 'all'
      ? allRows
      : allRows.filter(t => t.Date.startsWith(selectedPeriod))
    return [...base].sort((a, b) => b.Date.localeCompare(a.Date))
  }, [allRows, selectedPeriod])

  const summary = useMemo(() => {
    const cardRows     = filtered.filter(t => !t._isInterest)
    const interestRows = filtered.filter(t => t._isInterest)

    const totalSpent = cardRows.reduce((sum, t) => {
      const amt = parseAmount(t.Amount)
      return sum + (amt > 0 ? amt : 0)
    }, 0)
    const cardRewards      = cardRows.reduce((sum, t) => sum + t._income, 0)
    const savingsInterest  = interestRows.filter(t => t._source === 'savings').reduce((sum, t) => sum + t._income, 0)
    const checkingInterest = interestRows.filter(t => t._source === 'checking').reduce((sum, t) => sum + t._income, 0)
    const totalInterest    = savingsInterest + checkingInterest
    const totalIncome      = cardRewards + totalInterest
    const incomeRate       = totalSpent > 0 ? (totalIncome / totalSpent) * 100 : 0

    return {
      totalSpent,
      cardRewards,
      savingsInterest,
      checkingInterest,
      totalInterest,
      totalIncome,
      incomeRate,
      count: filtered.length,
    }
  }, [filtered])

  const periodLabel = (period) => {
    if (period === 'all') return 'All months'
    return formatMonth(period)
  }

  const amountDisplay = (raw) => {
    const val = parseAmount(raw)
    if (val === 0) return '$0.00'
    const abs = Math.abs(val)
    return val < 0 ? `-$${abs.toFixed(2)}` : `$${abs.toFixed(2)}`
  }

  return (
    <div className="card-page combined-page">
      <div className="page-body">
        <div className="summary-row summary-row-combined">
          <div className="summary-card">
            <div className="summary-label">Total Spent</div>
            <div className="summary-value">${summary.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="summary-sub">{periodLabel(selectedPeriod)}</div>
          </div>
          <div className="summary-card summary-card-accent combined-accent-card">
            <div className="summary-label">Total Income</div>
            <div className="summary-value combined-accent-value">${summary.totalIncome.toFixed(2)}</div>
            <div className="summary-sub">rewards + interest</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Card Rewards</div>
            <div className="summary-value">${summary.cardRewards.toFixed(2)}</div>
            <div className="summary-sub">Gold + Blue</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Interest Income</div>
            <div className="summary-value">${summary.totalInterest.toFixed(2)}</div>
            <div className="summary-sub">HYSA + Checking</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Income Rate</div>
            <div className="summary-value rate-value">{summary.incomeRate.toFixed(2)}%</div>
            <div className="summary-sub">per $ spent (all)</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Transactions</div>
            <div className="summary-value">{summary.count}</div>
            <div className="summary-sub">{periodLabel(selectedPeriod)}</div>
          </div>
        </div>

        <div className="filter-section">
          <div className="filter-controls">
            <div className="period-nav">
              <button className="nav-arrow" onClick={goBack} disabled={currentIndex === 0} aria-label="Previous period">‹</button>
              <span className="period-nav-label">{periodLabel(selectedPeriod)}</span>
              <button className="nav-arrow" onClick={goForward} disabled={currentIndex === periods.length - 1} aria-label="Next period">›</button>
            </div>
          </div>
        </div>

        <div className="table-container">
          <table className="tx-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th>Description</th>
                <th>Bonus</th>
                <th className="col-right">Spend</th>
                <th className="col-right">Income</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx, i) => {
                const srcCfg    = SOURCE_CONFIG[tx._source]
                const statusCfg = STATUS_CONFIG[tx.Status] || STATUS_CONFIG.PENDING
                const mult      = !tx._isInterest ? formatMultiplier(tx.Multiplier) : null
                const amt       = !tx._isInterest ? parseAmount(tx.Amount) : null
                const isInterestSrc = tx._source === 'savings' || tx._source === 'checking'
                return (
                  <tr key={i} className={amt !== null && amt < 0 ? 'row-negative' : ''}>
                    <td className="col-date">{tx.Date}</td>
                    <td>
                      <span className={`card-badge ${srcCfg.className}`}>
                        {srcCfg.label}
                      </span>
                    </td>
                    <td className="col-desc">{tx.Description}</td>
                    <td className="col-mult">
                      {mult ? (
                        <span className={`mult-badge ${tx._source}-mult`}>{mult}</span>
                      ) : (
                        <span className="mult-base">—</span>
                      )}
                    </td>
                    <td className={`col-right col-amount ${amt !== null && amt < 0 ? 'neg-amount' : ''}`}>
                      {amt !== null ? amountDisplay(tx.Amount) : <span className="mult-base">—</span>}
                    </td>
                    <td className={`col-right col-reward ${isInterestSrc ? `${tx._source}-interest-value` : `${tx._source}-reward`}`}>
                      {tx._income > 0 ? `$${tx._income.toFixed(2)}` : '—'}
                    </td>
                    <td>
                      {!tx._isInterest ? (
                        <span className={`status-badge ${statusCfg.className}`}>
                          {statusCfg.label}
                        </span>
                      ) : (
                        <span className="mult-base">—</span>
                      )}
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
