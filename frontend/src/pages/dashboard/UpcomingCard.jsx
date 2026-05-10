import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import './UpcomingCard.css'

export default function UpcomingCard() {
  return (
    <Card title="Upcoming" className="upcoming-card">
      <p className="upcoming-card__subtitle">
        You have 2 minimum payments due within the next week totaling $400.
      </p>
      <div className="upcoming-card__placeholder">Coming soon</div>
      <Button variant="secondary" className="upcoming-card__action">
        See All Upcoming
      </Button>
    </Card>
  )
}
