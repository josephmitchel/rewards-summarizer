import { NavLink, Link } from 'react-router-dom'
import {
  Bell,
  Settings,
  LayoutDashboard,
  CreditCard,
  LineChart,
  FileText,
  Search,
} from 'lucide-react'
import './Sidebar.css'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/spending', label: 'Spending', Icon: CreditCard },
  { to: '/optimize', label: 'Optimize', Icon: LineChart },
  { to: '/reports', label: 'Reports', Icon: FileText },
  { to: '/browse', label: 'Browse', Icon: Search },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <Link to="/dashboard" className="sidebar__logo">
          <span className="sidebar__logo-earn">Earn</span>
          <span className="sidebar__logo-right">Right</span>
        </Link>
        <div className="sidebar__top-icons">
          <button type="button" className="sidebar__icon-button" aria-label="Notifications">
            <Bell size={24} />
          </button>
          <Link to="/settings" className="sidebar__icon-button" aria-label="Settings">
            <Settings size={24} />
          </Link>
        </div>
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? 'sidebar__nav-item sidebar__nav-item--active' : 'sidebar__nav-item'
            }
          >
            <item.Icon size={24} className="sidebar__nav-icon" />
            <span className="sidebar__nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__profile">
        <div className="sidebar__avatar">J</div>
        <div className="sidebar__profile-text">
          <div className="sidebar__profile-name">Joseph Mitchell</div>
          <div className="sidebar__profile-plan">Free Plan</div>
        </div>
      </div>
    </aside>
  )
}
