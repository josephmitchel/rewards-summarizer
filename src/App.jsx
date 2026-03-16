import { useState } from 'react'
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
  const [activePage, setActivePage] = useState(null)

  const toggle = (page) => setActivePage(prev => prev === page ? null : page)

  return (
    <div className="app">
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
