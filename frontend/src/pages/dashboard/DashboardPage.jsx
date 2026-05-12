import { useEffect } from 'react'
import { useAppData } from '../../state/useAppData'
import RewardsEarnedCard from './RewardsEarnedCard'
import AccountsCard from './AccountsCard'
import UpcomingCard from './UpcomingCard'
import './DashboardPage.css'

export default function DashboardPage() {
  const { accounts, ensureAccountData } = useAppData()

  useEffect(() => {
    ensureAccountData(accounts.map(a => a.accountId))
  }, [accounts, ensureAccountData])

  return (
    <div className="dashboard">
      <RewardsEarnedCard />
      <div className="dashboard__right-column">
        <AccountsCard />
        <UpcomingCard />
      </div>
    </div>
  )
}
