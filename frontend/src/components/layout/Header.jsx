import { formatHeaderDate } from '../../utils/formatDate'
import './Header.css'

export default function Header() {
  return (
    <header className="header">
      <div className="header__inner">
        <div className="header__date">{formatHeaderDate()}</div>
        <h1 className="header__greeting">Welcome Back, Joseph</h1>
      </div>
    </header>
  )
}
