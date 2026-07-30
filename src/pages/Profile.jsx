import { useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'

export default function Profile() {
  const { profile, company, user, isAdmin, refreshProfile } = useAuth()
  const toast = useToast()

  const [fullName, setFullName] = useState('')
  const [savingName, setSavingName] = useState(false)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setFullName(profile?.full_name || '')
  }, [profile?.full_name])

  async function handleSaveName(e) {
    e.preventDefault()
    if (!fullName.trim()) {
      setErrors((prev) => ({ ...prev, fullName: 'Display name cannot be empty.' }))
      return
    }
    setErrors((prev) => ({ ...prev, fullName: undefined }))
    setSavingName(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      toast.success('Your profile has been updated.')
    } catch (err) {
      toast.error(err.message || 'Could not update your profile.')
    } finally {
      setSavingName(false)
    }
  }

  async function handleSavePassword(e) {
    e.preventDefault()
    const next = {}
    if (password.length < 8) next.password = 'Use at least 8 characters.'
    if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match.'
    setErrors((prev) => ({ ...prev, ...next, password: next.password, confirmPassword: next.confirmPassword }))
    if (Object.values(next).some(Boolean)) return

    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setPassword('')
      setConfirmPassword('')
      toast.success('Your password has been changed.')
    } catch (err) {
      toast.error(err.message || 'Could not change your password.')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Profile</h1>
        <p className="subhead">Manage your account details.</p>
      </div>

      <div className="stack" style={{ maxWidth: 620 }}>
        <section className="card">
          <h2 className="section-title">Account</h2>
          <dl style={{ margin: 0, display: 'grid', gap: '0.75rem' }}>
            <div>
              <dt className="small muted">Name</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{profile?.full_name || '—'}</dd>
            </div>
            <div>
              <dt className="small muted">Email</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{user?.email || '—'}</dd>
            </div>
            <div>
              <dt className="small muted">Company</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>
                {isAdmin ? 'Region HR (Administrator)' : company?.name || 'Not assigned'}
              </dd>
            </div>
            <div>
              <dt className="small muted">Member since</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{formatDate(profile?.created_at)}</dd>
            </div>
          </dl>
        </section>

        <section className="card">
          <h2 className="section-title">Display name</h2>
          <form onSubmit={handleSaveName} noValidate>
            <div className="field">
              <label htmlFor="full-name">Full name</label>
              <input
                id="full-name"
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={Boolean(errors.fullName)}
              />
              {errors.fullName && <span className="field-error">{errors.fullName}</span>}
            </div>
            <Button type="submit" loading={savingName}>
              Save Changes
            </Button>
          </form>
        </section>

        <section className="card">
          <h2 className="section-title">
            <Icon name="lock" size={16} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Change password
          </h2>
          <form onSubmit={handleSavePassword} noValidate>
            <div className="field">
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                className="input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(errors.password)}
              />
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>
            <div className="field">
              <label htmlFor="confirm-password">Confirm new password</label>
              <input
                id="confirm-password"
                className="input"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                aria-invalid={Boolean(errors.confirmPassword)}
              />
              {errors.confirmPassword && (
                <span className="field-error">{errors.confirmPassword}</span>
              )}
            </div>
            <Button type="submit" loading={savingPassword}>
              Save Changes
            </Button>
          </form>
        </section>
      </div>
    </>
  )
}
