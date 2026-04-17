import { useState } from 'react'
import { getTransactionValue } from '../utils/rewards'

export default function TransactionsTable({ transactions, cardByAccountId, accountNameById, onCategoryChange, showAccountColumn = false }) {
  const [editingTxnId, setEditingTxnId] = useState(null)

  if (transactions.length === 0) return <p>No transactions found.</p>

  const getDropdownOptions = (txn) => {
    const card = cardByAccountId[txn.accountId]
    if (!card) return []
    if (txn.plaidTransaction.amount < 0) {
      return ['Card Payment', 'Refund', ...(card.benefits?.map(b => b.name) ?? [])]
    }
    return card.rewards?.map(r => r.category) ?? []
  }

  const handleChange = async (txn, newCategory) => {
    setEditingTxnId(null)
    if (newCategory === txn.category) return
    await onCategoryChange(txn, newCategory)
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Name</th>
          {showAccountColumn && <th>Account</th>}
          <th>Amount</th>
          <th>Category</th>
          <th>Value ($)</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map(txn => {
          const card = cardByAccountId[txn.accountId]
          const value = getTransactionValue(txn, card)
          return (
            <tr key={txn.plaidTransaction.transaction_id}>
              <td>{txn.plaidTransaction.date ? new Date(txn.plaidTransaction.date).toLocaleDateString() : '—'}</td>
              <td>{txn.plaidTransaction.merchant_name || txn.plaidTransaction.name}</td>
              {showAccountColumn && <td>{accountNameById?.[txn.accountId] ?? '—'}</td>}
              <td>{txn.plaidTransaction.amount}</td>
              <td onClick={() => setEditingTxnId(txn.transactionId)} style={{ cursor: 'pointer' }}>
                {editingTxnId === txn.transactionId ? (
                  <select
                    autoFocus
                    defaultValue={txn.category}
                    onChange={e => handleChange(txn, e.target.value)}
                    onBlur={() => setEditingTxnId(null)}
                  >
                    {getDropdownOptions(txn).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                ) : (
                  txn.category || '—'
                )}
              </td>
              <td>{value ? `$${value.toFixed(2)}` : '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
