import { useCallback, useEffect, useState } from 'react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import Modal from '../../components/ui/Modal'
import { PageSpinner } from '../../components/ui/Spinner'
import { useToast } from '../../context/ToastContext'
import { createPortalUser } from '../../lib/adminApi'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/format'

export default function Users() {
  const [users, setUsers] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersRes, companiesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, role, created_at, companies (id, name)')
          .order('created_at', { ascending: false }),
        supabase.from('companies').select('id, name').order('name'),
      ])
      const failed = [usersRes, companiesRes].find((r) => r.error)
      if (failed) throw failed.error
      setUsers(usersRes.data || [])
      setCompanies(companiesRes.data || [])
    } catch (err) {
      setError(err.message || 'Could not load users.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <div className="toolbar">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Users</h1>
          <p className="subhead">Everyone with access to the portal.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Icon name="plus" size={16} />
          Add User
        </Button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <PageSpinner label="Loading users" />
      ) : users.length === 0 ? (
        <EmptyState icon="users" title="No users yet" message="Add the first portal user." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Company</th>
                <th>Role</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td style={{ fontWeight: 600 }}>{user.full_name || '—'}</td>
                  <td className="muted">{user.email || '—'}</td>
                  <td>{user.companies?.name || <span className="muted">—</span>}</td>
                  <td>
                    <Badge color={user.role === 'admin' ? '#f9bf4b' : '#0c343d'}>
                      {user.role}
                    </Badge>
                  </td>
                  <td className="muted">{formatDate(user.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddUserModal
        open={modalOpen}
        companies={companies}
        onClose={() => setModalOpen(false)}
        onCreated={(name) => {
          setModalOpen(false)
          toast.success(`${name} can now sign in.`)
          load()
        }}
      />
    </>
  )
}

function AddUserModal({ open, companies, onClose, onCreated }) {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'client',
    companyId: '',
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setForm({ fullName: '', email: '', password: '', role: 'client', companyId: '' })
      setErrors({})
      setFormError('')
    }
  }, [open])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    const next = {}
    if (!form.fullName.trim()) next.fullName = 'Full name is required.'
    if (!form.email.trim()) next.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = 'Enter a valid email address.'
    if (form.password.length < 8) next.password = 'Use at least 8 characters.'
    if (form.role === 'client' && !form.companyId)
      next.companyId = 'Client accounts must belong to a company.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    try {
      await createPortalUser({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        role: form.role,
        companyId: form.companyId || null,
      })
      onCreated(form.fullName.trim())
    } catch (err) {
      setFormError(err.message || 'Could not create the user.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title="Add User" onClose={onClose}>
      {formError && <div className="form-error">{formError}</div>}
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="user-name">Full name</label>
          <input
            id="user-name"
            className="input"
            value={form.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            aria-invalid={Boolean(errors.fullName)}
          />
          {errors.fullName && <span className="field-error">{errors.fullName}</span>}
        </div>

        <div className="field">
          <label htmlFor="user-email">Email</label>
          <input
            id="user-email"
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>

        <div className="field">
          <label htmlFor="user-password">Temporary password</label>
          <input
            id="user-password"
            className="input"
            type="text"
            autoComplete="off"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            aria-invalid={Boolean(errors.password)}
          />
          <span className="small muted">
            Share this with the user and ask them to change it from their Profile page.
          </span>
          {errors.password && <span className="field-error">{errors.password}</span>}
        </div>

        <div className="field">
          <label htmlFor="user-role">Role</label>
          <select
            id="user-role"
            className="select"
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
          >
            <option value="client">Client</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="user-company">Company</label>
          <select
            id="user-company"
            className="select"
            value={form.companyId}
            onChange={(e) => set('companyId', e.target.value)}
            aria-invalid={Boolean(errors.companyId)}
          >
            <option value="">
              {form.role === 'admin' ? 'None (Region HR staff)' : 'Select a company…'}
            </option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          {errors.companyId && <span className="field-error">{errors.companyId}</span>}
        </div>

        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Create User
          </Button>
        </div>
      </form>
    </Modal>
  )
}
