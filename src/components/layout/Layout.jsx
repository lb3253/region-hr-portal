import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Icon from '../ui/Icon'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../context/ToastContext'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(err.message || 'Could not sign out.')
    }
  }

  return (
    <div className="layout">
      <button
        type="button"
        className={`sidebar-backdrop${sidebarOpen ? ' show' : ''}`}
        aria-label="Close navigation"
        tabIndex={sidebarOpen ? 0 : -1}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar
        open={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
        onSignOut={handleSignOut}
      />

      <div className="layout-main">
        <header className="topbar">
          <button
            type="button"
            className="hamburger"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={sidebarOpen}
          >
            <Icon name="menu" size={20} />
          </button>
          <span className="logo">REGION HR</span>
        </header>

        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
