import { useState } from 'react'
import CardPage from './CardPage'
import CombinedPage from './CombinedPage'
import SavingsPage from './SavingsPage'
import CheckingPage from './CheckingPage'
import { parseCSV, parseSavingsCSV } from './utils/csvParser'
import { checkingTransactions } from './data/amex-checking/data'
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
        <div className="app-header-inner">
          <div className="app-header-left">
            {/* <h1 className="app-title">Combined Overview</h1> */}
            {/* <p className="app-subtitle">Amex Gold · Amex Blue Cash · Amex Savings · Amex Checking</p> */}
          </div>
          <nav className="app-nav-chips">
            <button
              className={`nav-chip ${activePage === 'gold' ? 'nav-chip-gold-active' : ''}`}
              onClick={() => toggle('gold')}
            >
              Gold ···· 01008
            </button>
            <button
              className={`nav-chip ${activePage === 'blue' ? 'nav-chip-blue-active' : ''}`}
              onClick={() => toggle('blue')}
            >
              Blue ···· 41003
            </button>
            <button
              className={`nav-chip ${activePage === 'savings' ? 'nav-chip-savings-active' : ''}`}
              onClick={() => toggle('savings')}
            >
              Savings
            </button>
            <button
              className={`nav-chip ${activePage === 'checking' ? 'nav-chip-checking-active' : ''}`}
              onClick={() => toggle('checking')}
            >
              Checking
            </button>
          </nav>
        </div>
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
          cardName="Amex Gold"
          cardNumber="-01008"
          transactions={goldTransactions}
          rewardKey="Points/Miles"
          rewardLabel="Points"
          isPoints={true}
          theme="gold"
        />
      )}
      {activePage === 'blue' && (
        <CardPage
          cardName="Amex Blue Cash Preferred"
          cardNumber="-41003"
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
