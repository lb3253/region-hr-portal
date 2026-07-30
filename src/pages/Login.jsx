import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import Button from '../components/ui/Button'
import { PageSpinner } from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { session, loading, isAdmin, profile, profileError, isConfigured, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const location = useLocation()

  useEffect(() => {
    document.title = 'Sign in — Region HR Portal'
  }, [])

  if (loading) {
    return (
      <div className="login-page">
        <PageSpinner label="Checking your session" />
      </div>
    )
  }

  // Already signed in — send them where they were headed, or to their home.
  // Admins land on the admin dashboard; the client dashboard is empty for them
  // because staff accounts have no company of their own.
  if (session && profile) {
    const from = location.state?.from
    return <Navigate to={from || (isAdmin ? '/admin' : '/dashboard')} replace />
  }

  // Signed in, but the profile row could not be read. Without a role there is
  // nowhere safe to send them, so say so rather than looping on the form.
  if (session && !profile) {
    return (
      <div className="login-page">
        <div className="login-shell">
          <div className="login-brand">
            <div className="logo">REGION HR</div>
            <div className="tagline">Workforce Forward.</div>
          </div>
          <div className="login-card">
            <div className="form-error" style={{ marginBottom: 0 }}>
              {profileError || 'Your account has no profile yet. Contact Region HR for access.'}
            </div>
          </div>
        </div>
      </div>
    )
  }

  function validate() {
    const next = {}
    if (!email.trim()) next.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = 'Enter a valid email address.'
    if (!password) next.password = 'Password is required.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!validate()) return

    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
      // No navigate() here on purpose — the role is not known until the profile
      // loads a moment later. The redirect above fires then and routes admins
      // and clients to their own landing pages.
    } catch (err) {
      setFormError(
        /invalid login credentials/i.test(err.message || '')
          ? 'That email and password combination did not match an account.'
          : err.message || 'Unable to sign in. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-shell">
        <div className="login-brand">
          <div className="logo">REGION HR</div>
          <div className="tagline">Workforce Forward.</div>
        </div>

        <div className="login-card">
          <h1>Client Portal</h1>
          <p className="login-sub">Sign in to access your HR and payroll documents.</p>

          {!isConfigured && (
            <div className="form-error">
              This portal is not connected to Supabase yet. Copy <code>.env.example</code> to{' '}
              <code>.env</code> and add your project URL and anon key.
            </div>
          )}

          {formError && (
            <div className="form-error" role="alert">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(errors.password)}
              />
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            <Button type="submit" block loading={submitting}>
              Sign In
            </Button>
          </form>
        </div>

        <p className="login-foot">
          Accounts are created by Region HR. Need access? Contact your Region HR representative.
        </p>
      </div>
    </div>
  )
}
