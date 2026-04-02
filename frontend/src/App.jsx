import { useState, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import './App.css'

export default function App() {
  const [linkToken, setLinkToken] = useState(null);

  const generateLinkToken = useCallback(async () => {
    const response = await fetch("/api/create_link_token", { method: "POST" });

    if (!response.ok) {
      console.error("Failed to create link token");
      return;
    }

    const data = await response.json();
    if (data.error != null) {
      console.error("Error creating link token:", data.error);
      return;
    }
    setLinkToken(data.link_token);
  }, []);

  const onSuccess = useCallback(async (public_token) => {
    const response = await fetch("/api/set_access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
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
    console.log("Exchanged public token for access token:", data);
    window.history.pushState("", "", "/");
  }, []);

  const getTransactions = useCallback(async () => {
    const response = await fetch("/api/transactions");
    if (!response.ok) {
      console.error("Failed to fetch transactions");
      return;
    }
    const data = await response.json();
    if (data.error != null) {
      console.error("Error fetching transactions:", data.error);
      return;
    }
    console.log("Fetched transactions:", data);
  }, []);

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  return (
    <div className="app">
      <button onClick={generateLinkToken}>Get Link Token</button>
      <button onClick={() => open()} disabled={!ready || !linkToken}>Connect Bank Account</button>
      <button onClick={getTransactions}>Get Transactions</button>
    </div>
  )
}
