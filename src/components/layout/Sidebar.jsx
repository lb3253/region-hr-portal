import { NavLink } from 'react-router-dom'
import Icon from '../ui/Icon'
import { useAuth } from '../../hooks/useAuth'
import { useNotificationsContext } from '../../context/NotificationsContext'

const CLIENT_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/documents', label: 'Documents', icon: 'folder' },
  { to: '/notifications', label: 'Notifications', icon: 'bell', badge: 'unread' },
  { to: '/profile', label: 'Profile', icon: 'user' },
]

const ADMIN_LINKS = [
  { to: '/admin', label: 'Admin Dashboard', icon: 'home', end: true },
  { to: '/admin/companies', label: 'Companies', icon: 'building' },
  { to: '/admin/users', label: 'Users', icon: 'users' },
  { to: '/admin/categories', label: 'Categories', icon: 'check-square' },
  { to: '/admin/upload', label: 'Upload Documents', icon: 'upload' },
  { to: '/admin/documents', label: 'All Documents', icon: 'folder' },
]

export default function Sidebar({ open, onNavigate, onSignOut }) {
  const { profile, company, isAdmin, user } = useAuth()
  const { unreadCount } = useNotificationsContext()

  const displayName = profile?.full_name || user?.email || 'Signed in'
  const companyLabel = isAdmin ? 'Region HR — Administrator' : company?.name || 'No company assigned'

  function renderLink(link) {
    return (
      <NavLink
        key={link.to}
        to={link.to}
        end={link.end}
        className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        onClick={onNavigate}
      >
        <Icon name={link.icon} size={18} />
        <span>{link.label}</span>
        {link.badge === 'unread' && unreadCount > 0 && (
          <span className="nav-badge" aria-label={`${unreadCount} unread`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </NavLink>
    )
  }

  return (
    <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Main navigation">
      <div className="sidebar-brand">
        <div className="logo">REGION HR</div>
        <div className="tagline">Workforce Forward.</div>
      </div>

      <nav className="sidebar-nav">
        {CLIENT_LINKS.map(renderLink)}

        {isAdmin && (
          <>
            <div className="nav-group-label">Administration</div>
            {ADMIN_LINKS.map(renderLink)}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user-name">{displayName}</div>
        <div className="sidebar-user-company">{companyLabel}</div>
        <button type="button" className="sidebar-logout" onClick={onSignOut}>
          <Icon name="log-out" size={16} />
          Log out
        </button>
      </div>
    </aside>
  )
}
