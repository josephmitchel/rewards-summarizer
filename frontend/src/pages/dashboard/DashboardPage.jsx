import { useEffect } from 'react'
import { useAppData } from '../../state/useAppData'
import Card from '../../components/ui/Card'
import UpcomingCard from './UpcomingCard'
import './DashboardPage.css'

export default function DashboardPage() {
  const { accounts, ensureAccountData } = useAppData()

  useEffect(() => {
    ensureAccountData(accounts.map(a => a.accountId))
  }, [accounts, ensureAccountData])

  return (
    <div className="dashboard">
      <Card title="Rewards Earned" className="dashboard__card--rewards" />
      <div className="dashboard__right-column">
        <Card title="Accounts" className="dashboard__card--accounts" />
        <UpcomingCard />
      </div>
    </div>
  )
}
