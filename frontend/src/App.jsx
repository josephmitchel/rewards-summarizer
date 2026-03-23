import { useState, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import CardPage from './CardPage'
import CombinedPage from './CombinedPage'
import SavingsPage from './SavingsPage'
import CheckingPage from './CheckingPage'
import { parseCSV, parseSavingsCSV } from './utils/csvParser'
import { checkingTransactions } from './data/amex-checking/data'
import goldImg from './assets/gold.avif'
import blueImg from './assets/blue.avif'
import savingsImg from './assets/savings.avif'
import checkingImg from './assets/checking.avif'
import './App.css'

import goldFeb from './data/amex-gold/2026-02.csv?raw'
import goldMar from './data/amex-gold/2026-03.csv?raw'
import blueJan from './data/amex-blue/2026-01.csv?raw'
import blueFeb from './data/amex-blue/2026-02.csv?raw'
import blueMar from './data/amex-blue/2026-03.csv?raw'
import savingsJan from './data/amex-savings/2026-01.csv?raw'
import savingsFeb from './data/amex-savings/2026-02.csv?raw'
import savingsMar from './data/amex-savings/2026-03.csv?raw'

const goldTransactions    = [...parseCSV(goldFeb), ...parseCSV(goldMar)]
const blueTransactions    = [...parseCSV(blueJan), ...parseCSV(blueFeb), ...parseCSV(blueMar)]
const savingsTransactions = [
  ...parseSavingsCSV(savingsJan),
  ...parseSavingsCSV(savingsFeb),
  ...parseSavingsCSV(savingsMar),
]

export default function App() {
  const [activePage, setActivePage] = useState(null);
  const [linkToken, setLinkToken] = useState(null);

  const toggle = (page) => setActivePage(prev => prev === page ? null : page)

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

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  return (
    <div className="app">
      <button onClick={generateLinkToken}>Get Link Token</button>
      <button onClick={() => open()} disabled={!ready || !linkToken}>Connect Bank Account</button>
      <header className="app-header">
        <nav className="card-nav">
          {[
            { key: 'gold', img: goldImg, alt: 'Amex Gold' },
            { key: 'blue', img: blueImg, alt: 'Amex Blue Cash' },
            { key: 'savings', img: savingsImg, alt: 'Amex Savings' },
            { key: 'checking', img: checkingImg, alt: 'Amex Checking' },
          ].map(card => (
            <button
              key={card.key}
              className={`card-nav-btn ${activePage === card.key ? 'card-nav-active' : ''}`}
              onClick={() => toggle(card.key)}
            >
              <img src={card.img} alt={card.alt} className="card-nav-img" />
            </button>
          ))}
        </nav>
      </header>

      {activePage === null && (
        <CombinedPage
          goldTransactions={goldTransactions}
          blueTransactions={blueTransactions}
          savingsTransactions={savingsTransactions}
          checkingTransactions={checkingTransactions}
        />
      )}
      {activePage === 'gold' && (
        <CardPage
          transactions={goldTransactions}
          rewardKey="Points/Miles"
          rewardLabel="Points"
          isPoints={true}
          theme="gold"
        />
      )}
      {activePage === 'blue' && (
        <CardPage
          transactions={blueTransactions}
          rewardKey="Cash"
          rewardLabel="Cash Back"
          isPoints={false}
          theme="blue"
        />
      )}
      {activePage === 'savings' && (
        <SavingsPage transactions={savingsTransactions} />
      )}
      {activePage === 'checking' && (
        <CheckingPage />
      )}
    </div>
  )
}
