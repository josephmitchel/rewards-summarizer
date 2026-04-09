import { useState, useEffect } from 'react'

export default function AccountPage({ accountId }) {
  const [account, setAccount] = useState(null)
  const [transactions, setTransactions] = useState([])
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
  }, [accountId, token])

  if (!account) return <p>Loading...</p>

  return (
    <div>
      <h2>{account.name}</h2>
      <p>Type: {account.type} / {account.subtype}</p>
      <p>Balance: {account.balances.current}</p>
      {account.mask && <p>Account ending in {account.mask}</p>}

      <h3>Transactions</h3>
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
            </tr>
          </thead>
          <tbody>
            {transactions.map(txn => (
              <tr key={txn.plaidTransaction.transaction_id}>
                <td>{txn.plaidTransaction.date ? new Date(txn.plaidTransaction.date).toLocaleDateString() : '—'}</td>
                <td>{txn.plaidTransaction.merchant_name || txn.plaidTransaction.name}</td>
                <td>{txn.plaidTransaction.amount}</td>
                <td>{txn.plaidTransaction.personal_finance_category?.detailed || txn.plaidTransaction.category || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
