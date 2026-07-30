import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { PageSpinner } from '../ui/Spinner'
import { useAuth } from '../../hooks/useAuth'

/**
 * Gate for every authenticated route. `requireAdmin` additionally restricts to
 * role = 'admin'; clients who wander into /admin/* land back on /dashboard.
 */
export default function ProtectedRoute({ requireAdmin = false }) {
  const { session, profile, loading, isAdmin, profileError } = useAuth()
  const location = useLocation()

  if (loading) return <PageSpinner label="Loading your account" />

  if (!session) {
    return <Navigate to="/" replace state={{ from: location.pathname + location.search }} />
  }

  // Signed in but the profile row is missing or unreadable — without it there
  // is no role or company, so nothing on the portal can render safely.
  if (!profile) {
    return (
      <div className="layout-content">
        <div className="form-error" style={{ maxWidth: 520 }}>
          {profileError || 'Your account has no profile yet. Contact Region HR for access.'}
        </div>
      </div>
    )
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
