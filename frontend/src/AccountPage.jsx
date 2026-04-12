import { useState, useEffect } from 'react'

export default function AccountPage({ accountId }) {
  const [account, setAccount] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [rewardType, setRewardType] = useState(null)
  const [baseRedemptionValue, setBaseRedemptionValue] = useState(null)
  const [categoryOptions, setCategoryOptions] = useState([])
  const [creditCategories, setCreditCategories] = useState([])
  const [editingTxnId, setEditingTxnId] = useState(null)
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
        const benefitNames = data.card?.benefits?.map(b => b.name) ?? []
        setCreditCategories(['Card Payment', 'Refund', ...benefitNames])
      })
      .catch(() => console.error('Failed to fetch card'))
  }, [accountId, token])

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

  const calculateTotalRewards = () => {
    if (rewardType === 'cashback') {
      return transactions.reduce((sum, txn) => sum + (txn.cashback ?? 0), 0).toFixed(2)
    } else if (rewardType === 'points') {
      const totalPoints = transactions.reduce((sum, txn) => sum + (txn.points ?? 0), 0)
      return baseRedemptionValue ? (totalPoints * baseRedemptionValue).toFixed(2) : `${totalPoints} points`
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

      <h3>Transactions</h3>
      <p>Total Rewards: ${calculateTotalRewards()}</p>
      {transactions.length === 0 ? (
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
            {transactions.map(txn => (
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
