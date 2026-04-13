import { useState, useEffect } from 'react'

export default function AccountPage({ accountId }) {
  const [account, setAccount] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [rewardType, setRewardType] = useState(null)
  const [baseRedemptionValue, setBaseRedemptionValue] = useState(null)
  const [categoryOptions, setCategoryOptions] = useState([])
  const [creditCategories, setCreditCategories] = useState([])
  const [cardBenefits, setCardBenefits] = useState([])
  const [editingTxnId, setEditingTxnId] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const token = localStorage.getItem('token')

  useEffect(() => {
    const headers = { 'Authorization': `Bearer ${token}` }

    fetch(`/api/accounts/${accountId}`, { headers })
      .then(res => res.json())
      .then(data => setAccount(data.account))
      .catch(() => console.error('Failed to fetch account'))

    fetch(`/api/accounts/${accountId}/transactions`, { headers })
      .then(res => res.json())
      .then(data => setTransactions(data.transactions))
      .catch(() => console.error('Failed to fetch transactions'))

    fetch(`/api/accounts/${accountId}/card`, { headers })
      .then(res => res.json())
      .then(data => {
        setRewardType(data.card?.rewardType ?? null)
        setBaseRedemptionValue(data.card?.baseRedemptionValue ?? null)
        setCategoryOptions(data.card?.rewards?.map(r => r.category) ?? [])
        const benefits = data.card?.benefits ?? []
        setCardBenefits(benefits)
        setCreditCategories(['Card Payment', 'Refund', ...benefits.map(b => b.name)])
      })
      .catch(() => console.error('Failed to fetch card'))
  }, [accountId, token])

  const prevMonth = () => setSelectedMonth(({ year, month }) =>
    month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
  )
  const nextMonth = () => setSelectedMonth(({ year, month }) =>
    month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
  )

  const monthLabel = new Date(selectedMonth.year, selectedMonth.month)
    .toLocaleString('default', { month: 'long', year: 'numeric' })

  // Filter transactions into the window relevant to a benefit's period
  const getBenefitTransactions = (benefit) => {
    return transactions.filter(txn => {
      if (txn.category !== benefit.name) return false
      const date = txn.plaidTransaction.authorized_date
      if (!date) return false
      const [y, m] = date.split('-').map(Number)
      const txYear = y
      const txMonth = m - 1 // 0-indexed

      if (benefit.period === 'monthly') {
        return txYear === selectedMonth.year && txMonth === selectedMonth.month
      } else if (benefit.period === 'annually') {
        return txYear === selectedMonth.year
      } else if (benefit.period === 'semi-annually') {
        const selectedHalf = Math.floor(selectedMonth.month / 6)
        const txHalf = Math.floor(txMonth / 6)
        return txYear === selectedMonth.year && txHalf === selectedHalf
      }
      return false
    })
  }

  const getBenefitUsed = (benefit) =>
    getBenefitTransactions(benefit)
      .reduce((sum, txn) => sum + Math.abs(txn.plaidTransaction.amount), 0)

  const getResetDate = (benefit) => {
    const { year, month } = selectedMonth
    if (benefit.period === 'monthly') {
      const next = new Date(year, month + 1, 1)
      return `1st of ${next.toLocaleString('default', { month: 'long', year: 'numeric' })}`
    } else if (benefit.period === 'annually') {
      return `January 1st, ${year + 1}`
    } else if (benefit.period === 'semi-annually') {
      const half = Math.floor(month / 6)
      const next = half === 0 ? new Date(year, 6, 1) : new Date(year + 1, 0, 1)
      return `${next.toLocaleString('default', { month: 'long' })} 1st, ${next.getFullYear()}`
    }
    return 'N/A'
  }

  const monthlyTransactions = transactions.filter(txn => {
    const date = txn.plaidTransaction.authorized_date
    if (!date) return false
    const [y, m] = date.split('-').map(Number)
    return y === selectedMonth.year && m - 1 === selectedMonth.month
  })

  const handleCategoryChange = async (txn, newCategory) => {
    setEditingTxnId(null)
    if (newCategory === txn.category) return
    const response = await fetch(`/api/transactions/${txn.transactionId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: newCategory }),
    })
    if (!response.ok) { console.error('Failed to update category'); return; }
    const data = await response.json()
    setTransactions(prev => prev.map(t => t.transactionId === txn.transactionId ? data.transaction : t))
  }

  const benefitCredits = monthlyTransactions
    .filter(txn => txn.plaidTransaction.amount < 0 && txn.category !== 'Card Payment' && txn.category !== 'Refund')
    .reduce((sum, txn) => sum + Math.abs(txn.plaidTransaction.amount), 0)

  const calculateTotalRewards = () => {
    if (rewardType === 'cashback') {
      const purchaseCashback = monthlyTransactions.reduce((sum, txn) => sum + (txn.cashback ?? 0), 0)
      return (purchaseCashback + benefitCredits).toFixed(2)
    } else if (rewardType === 'points') {
      const totalPoints = monthlyTransactions.reduce((sum, txn) => sum + (txn.points ?? 0), 0)
      const pointsCashback = baseRedemptionValue ? totalPoints * baseRedemptionValue : 0
      return (pointsCashback + benefitCredits).toFixed(2)
    }
    return 'N/A'
  }

  if (!account) return <p>Loading...</p>

  return (
    <div>
      <h2>{account.name}</h2>
      <p>Type: {account.type} / {account.subtype}</p>
      <p>Balance: {account.balances.current}</p>
      {account.mask && <p>Account ending in {account.mask}</p>}

      <div>
        <button onClick={prevMonth}>&#8592;</button>
        <strong>{monthLabel}</strong>
        <button onClick={nextMonth}>&#8594;</button>
      </div>

      {cardBenefits.length > 0 && (
        <>
          <h3>Benefits</h3>
          {cardBenefits.map(benefit => {
            const used = getBenefitUsed(benefit)
            const resetDate = getResetDate(benefit)
            return (
              <p key={benefit.id}>
                <strong>{benefit.name}</strong>: ${used.toFixed(2)} / ${benefit.amount} — resets {resetDate}
              </p>
            )
          })}
        </>
      )}

      <h3>Transactions</h3>
      <p>Total Rewards: ${calculateTotalRewards()}</p>
      {monthlyTransactions.length === 0 ? (
        <p>No transactions found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Amount</th>
              <th>Category</th>
              {rewardType === 'cashback' && <th>Cashback</th>}
              {rewardType === 'points' && <th>Points</th>}
            </tr>
          </thead>
          <tbody>
            {monthlyTransactions.map(txn => (
              <tr key={txn.plaidTransaction.transaction_id}>
                <td>{txn.plaidTransaction.date ? new Date(txn.plaidTransaction.date).toLocaleDateString() : '—'}</td>
                <td>{txn.plaidTransaction.merchant_name || txn.plaidTransaction.name}</td>
                <td>{txn.plaidTransaction.amount}</td>
                <td onClick={() => setEditingTxnId(txn.transactionId)}
                    style={{ cursor: 'pointer' }}>
                  {editingTxnId === txn.transactionId ? (
                    <select
                      autoFocus
                      defaultValue={txn.category}
                      onChange={e => handleCategoryChange(txn, e.target.value)}
                      onBlur={() => setEditingTxnId(null)}
                    >
                      {(txn.plaidTransaction.amount < 0 ? creditCategories : categoryOptions).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  ) : (
                    txn.category || '—'
                  )}
                </td>
                {rewardType === 'cashback' && <td>{txn.cashback ? `$${txn.cashback.toFixed(2)}` : '—'}</td>}
                {rewardType === 'points' && <td>{txn.points || '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
