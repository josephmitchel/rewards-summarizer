import { useAppData } from '../state/useAppData'

export default function SettingsPage() {
  const {
    items,
    accounts,
    removeStatus,
    linkBankAccount,
    syncTransactions,
    reprocessTransactions,
    removeItem,
    logout,
  } = useAppData()

  return (
    <div>
      <h2>Settings</h2>

      <section style={{ marginBottom: 24 }}>
        <h3>Account Management</h3>
        <button onClick={linkBankAccount}>Link Bank Account</button>{' '}
        <button onClick={syncTransactions}>Sync Transactions</button>{' '}
        <button onClick={reprocessTransactions}>Reprocess Transactions</button>{' '}
        <button onClick={logout}>Log Out</button>
      </section>

      <section>
        <h3>Linked Institutions</h3>
        {items.length === 0 && <p>No institutions linked yet.</p>}
        {items.map(item => (
          <div key={item.itemId} style={{ marginBottom: 12 }}>
            <strong>{item.institutionName || item.itemId}</strong>{' '}
            <button onClick={() => removeItem(item.itemId)}>Remove from Plaid</button>
            {removeStatus[item.itemId]?.ok && (
              <span> Removed. request_id: {removeStatus[item.itemId].requestId}</span>
            )}
            {removeStatus[item.itemId]?.ok === false && (
              <span> Failed to remove item.</span>
            )}
            <ul>
              {accounts.filter(a => a.itemId === item.itemId).map(account => (
                <li key={account.accountId}>{account.name} ({account.subtype})</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  )
}
