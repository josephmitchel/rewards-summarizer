import { useEffect } from 'react'
import { useAppData } from '../../state/useAppData'
import './DashboardPage.css'

export default function DashboardPage() {
  const { accounts, ensureAccountData } = useAppData()

  useEffect(() => {
    ensureAccountData(accounts.map(a => a.accountId))
  }, [accounts, ensureAccountData])

  return (
    <div className="dashboard">
      <div className="dashboard__placeholder dashboard__placeholder--rewards">
        <h2 className="dashboard__placeholder-title">Rewards Earned</h2>
      </div>
      <div className="dashboard__right-column">
        <div className="dashboard__placeholder dashboard__placeholder--accounts">
          <h2 className="dashboard__placeholder-title">Accounts</h2>
        </div>
        <div className="dashboard__placeholder dashboard__placeholder--upcoming">
          <h2 className="dashboard__placeholder-title">Upcoming</h2>
        </div>
      </div>
    </div>
  )
}
