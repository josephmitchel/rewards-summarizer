import { useState } from 'react'
import CardPage from './CardPage'
import { parseCSV } from './utils/csvParser'
import './App.css'

import goldFeb from './data/amex-gold/transactions-2026-02.csv?raw'
import goldMar from './data/amex-gold/transactions-2026-03.csv?raw'
import blueJan from './data/amex-blue/2026-01.csv?raw'
import blueFeb from './data/amex-blue/2026-02.csv?raw'
import blueMar from './data/amex-blue/2026-03.csv?raw'

const goldTransactions = [...parseCSV(goldFeb), ...parseCSV(goldMar)]
const blueTransactions = [...parseCSV(blueJan), ...parseCSV(blueFeb), ...parseCSV(blueMar)]

export default function App() {
  const [activePage, setActivePage] = useState('gold')

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-inner">
          <span className="nav-brand">Rewards Summarizer</span>
          <div className="nav-tabs">
            <button
              className={`nav-tab ${activePage === 'gold' ? 'nav-tab-gold-active' : ''}`}
              onClick={() => setActivePage('gold')}
            >
              <span className="tab-dot tab-dot-gold" />
              Amex Gold
            </button>
            <button
              className={`nav-tab ${activePage === 'blue' ? 'nav-tab-blue-active' : ''}`}
              onClick={() => setActivePage('blue')}
            >
              <span className="tab-dot tab-dot-blue" />
              Amex Blue Cash
            </button>
          </div>
        </div>
      </nav>

      {activePage === 'gold' ? (
        <CardPage
          cardName="American Express Gold"
          cardNumber="-01008"
          transactions={goldTransactions}
          rewardKey="Points/Miles"
          rewardLabel="Points"
          isPoints={true}
          theme="gold"
        />
      ) : (
        <CardPage
          cardName="American Express Blue Cash"
          cardNumber="-41003"
          transactions={blueTransactions}
          rewardKey="Cash"
          rewardLabel="Cash Back"
          isPoints={false}
          theme="blue"
        />
      )}
    </div>
  )
}
