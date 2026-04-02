import { useState, useCallback, useEffect, useRef } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import Login from './Login'
import Register from './Register'
import './App.css'

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [screen, setScreen] = useState('login');
  const [linkToken, setLinkToken] = useState(null);
  const pendingOpen = useRef(false);

  const onSuccess = useCallback(async (public_token) => {
    const response = await fetch("/api/item/public_token/exchange", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "Authorization": `Bearer ${token}`,
      },
      body: `public_token=${public_token}`,
    });
    if (!response.ok) {
      console.error("Failed to exchange public token for access token");
      return;
    }
    const data = await response.json();
    if (data.error != null) {
      console.error("Error exchanging public token:", data.error);
      return;
    }
    console.log("Access token saved:", data);
    window.history.pushState("", "", "/");
  }, [token]);

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  useEffect(() => {
    if (ready && pendingOpen.current) {
      pendingOpen.current = false;
      open();
    }
  }, [ready, open]);

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

  const getTransactions = useCallback(async () => {
    const response = await fetch("/api/transactions", {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!response.ok) { console.error("Failed to fetch transactions"); return; }
    const data = await response.json();
    if (data.error != null) { console.error("Error fetching transactions:", data.error); return; }
    console.log("Fetched transactions:", data);
  }, [token]);

  if (!token) {
    if (screen === 'register') return <Register onRegister={() => setScreen('login')} />;
    return <Login onLogin={setToken} onShowRegister={() => setScreen('register')} />;
  }

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  return (
    <div className="app">
      <button onClick={linkBankAccount}>Link Bank Account</button>
      <button onClick={getTransactions}>Get Transactions</button>
      <button onClick={logout}>Log Out</button>
    </div>
  )
}