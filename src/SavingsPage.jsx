import { useState, useMemo } from 'react'
import { formatMonth } from './utils/csvParser'
import savingsImg from './assets/savings.avif'

const interestOnly = t => t.Description.toLowerCase().includes('interest')

export default function SavingsPage({ transactions }) {
  const [selectedPeriod, setSelectedPeriod] = useState('all')

  const interestTransactions = useMemo(
    () => transactions.filter(interestOnly),
    [transactions]
  )

  const months = useMemo(() => {
    const s = new Set(interestTransactions.map(t => t.Date.substring(0, 7)))
    return Array.from(s).sort()
  }, [interestTransactions])

  const periods = useMemo(() => ['all', ...months], [months])

  const currentIndex = periods.indexOf(selectedPeriod)
  const goBack    = () => { if (currentIndex > 0)                  setSelectedPeriod(periods[currentIndex - 1]) }
  const goForward = () => { if (currentIndex < periods.length - 1) setSelectedPeriod(periods[currentIndex + 1]) }

  const filtered = useMemo(() => {
    const base = selectedPeriod === 'all'
      ? interestTransactions
      : interestTransactions.filter(t => t.Date.startsWith(selectedPeriod))
    return [...base].sort((a, b) => b.Date.localeCompare(a.Date))
  }, [interestTransactions, selectedPeriod])

  const summary = useMemo(() => {
    const totalInterest = filtered.reduce((s, t) => s + t.Amount, 0)

    let numDays = 1
    if (selectedPeriod === 'all') {
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

    return {
      totalInterest,
      interestPerDay: totalInterest / numDays,
      count: filtered.length,
    }
  }, [filtered, selectedPeriod])

  const periodLabel = (period) => {
    if (period === 'all') return 'All months'
    return formatMonth(period)
  }

  return (
    <div className="card-page savings-page">
      <div className="savings-hero">
        <div className="card-hero-inner">
          <img src={savingsImg} alt="Amex High Yield Savings" className="card-image" />
        </div>
      </div>

      <div className="page-body">
        <div className="summary-row">
          <div className="summary-card summary-card-accent savings-accent-card">
            <div className="summary-label">Interest Earned</div>
            <div className="summary-value savings-accent-value">${summary.totalInterest.toFixed(2)}</div>
            <div className="summary-sub">{periodLabel(selectedPeriod)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Interest / Day</div>
            <div className="summary-value rate-value">${summary.interestPerDay.toFixed(2)}</div>
            <div className="summary-sub">avg. per day</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Payments</div>
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
                <th>Description</th>
                <th className="col-right">Interest</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx, i) => (
                <tr key={i}>
                  <td className="col-date">{tx.Date}</td>
                  <td className="col-desc">{tx.Description}</td>
                  <td className="col-right col-reward savings-interest-value">
                    ${tx.Amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
