import { useState, useCallback, useEffect, useRef } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import Login from './Login'
import Register from './Register'
import AccountPage from './AccountPage'
import './App.css'

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [screen, setScreen] = useState('login');
  const [linkToken, setLinkToken] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const pendingOpen = useRef(false);

  // Exchange the public token for an access token and store it
  const onSuccess = useCallback(async (public_token) => {
    const response = await fetch("/api/item/public_token/exchange", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "Authorization": `Bearer ${token}`,
      },
      body: `public_token=${public_token}`,
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Failed to link account:", data.error);
      return;
    }
    console.log("Access token saved:", data);
    window.history.pushState("", "", "/");
  }, [token]);

  // Plaid API
  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  // Automatically open Plaid Link when the link token is ready
  useEffect(() => {
    if (ready && pendingOpen.current) {
      pendingOpen.current = false;
      open();
    }
  }, [ready, open]);


  useEffect(() => {

    // Fetch accounts whenever the token changes (i.e. on login)
    if (!token) return;
    fetch("/api/accounts", { headers: { "Authorization": `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setAccounts(data.accounts))
      .catch(() => console.error("Failed to fetch accounts"));
  }, [token]);

  // Create a link token and open Plaid Link when the user clicks "Link Bank Account"
  const linkBankAccount = async () => {
    const response = await fetch("/api/link/token/create", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!response.ok) { console.error("Failed to create link token"); return; }
    const data = await response.json();
    if (data.error != null) { console.error("Error creating link token:", data.error); return; }
    pendingOpen.current = true;
    setLinkToken(data.link_token);
  };

  // Sync transactions from a linked bank account
  const syncTransactions = useCallback(async () => {
    const response = await fetch("/api/transactions/sync", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!response.ok) { console.error("Failed to sync transactions"); return; }
    const data = await response.json();
    console.log(`Synced ${data.synced} transactions`);
  }, [token]);

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  if (!token) {
    if (screen === 'register') return <Register onRegister={() => setScreen('login')} />;
    return <Login onLogin={setToken} onShowRegister={() => setScreen('register')} />;
  }

  return (
    <div className="app">
      <button onClick={linkBankAccount}>Link Bank Account</button>

      <button onClick={syncTransactions}>Get Transactions</button>
      <button onClick={logout}>Log Out</button>
      <div>
        {accounts.map(account => (
          <button
            key={account.accountId}
            onClick={() => setSelectedAccountId(
              prev => prev === account.accountId ? null : account.accountId
            )}
          >
            {account.name} ({account.subtype})
          </button>
        ))}
      </div>
      {selectedAccountId && <AccountPage accountId={selectedAccountId} />}
    </div>
  )
}