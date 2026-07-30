import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import Modal from '../../components/ui/Modal'
import { PageSpinner } from '../../components/ui/Spinner'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { formatDate, slugify } from '../../lib/format'

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [companiesRes, profilesRes, documentsRes] = await Promise.all([
        supabase.from('companies').select('id, name, slug, created_at').order('name'),
        supabase.from('profiles').select('company_id'),
        supabase.from('documents').select('company_id'),
      ])

      const failed = [companiesRes, profilesRes, documentsRes].find((r) => r.error)
      if (failed) throw failed.error

      const userCounts = {}
      for (const p of profilesRes.data || []) {
        if (p.company_id) userCounts[p.company_id] = (userCounts[p.company_id] || 0) + 1
      }
      const docCounts = {}
      for (const d of documentsRes.data || []) {
        if (d.company_id) docCounts[d.company_id] = (docCounts[d.company_id] || 0) + 1
      }

      setCompanies(
        (companiesRes.data || []).map((c) => ({
          ...c,
          userCount: userCounts[c.id] || 0,
          documentCount: docCounts[c.id] || 0,
        }))
      )
    } catch (err) {
      setError(err.message || 'Could not load companies.')
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
          <h1>Companies</h1>
          <p className="subhead">Region HR client companies.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Icon name="plus" size={16} />
          Add Company
        </Button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <PageSpinner label="Loading companies" />
      ) : companies.length === 0 ? (
        <EmptyState
          icon="building"
          title="No companies yet"
          message="Add your first client company to start sharing documents."
          action={<Button onClick={() => setModalOpen(true)}>Add Company</Button>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Users</th>
                <th>Documents</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr
                  key={company.id}
                  className="clickable"
                  onClick={() => navigate(`/admin/documents?company=${company.id}`)}
                  title="View this company's documents"
                >
                  <td style={{ fontWeight: 600 }}>{company.name}</td>
                  <td className="muted">{company.slug}</td>
                  <td>{company.userCount}</td>
                  <td>{company.documentCount}</td>
                  <td className="muted">{formatDate(company.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddCompanyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(name) => {
          setModalOpen(false)
          toast.success(`${name} has been added.`)
          load()
        }}
      />
    </>
  )
}

function AddCompanyModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setName('')
      setSlug('')
      setSlugTouched(false)
      setErrors({})
      setFormError('')
    }
  }, [open])

  function handleNameChange(value) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    const next = {}
    if (!name.trim()) next.name = 'Company name is required.'
    if (!slug.trim()) next.slug = 'Slug is required.'
    else if (!/^[a-z0-9-]+$/.test(slug.trim()))
      next.slug = 'Use lowercase letters, numbers and hyphens only.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('companies')
        .insert({ name: name.trim(), slug: slug.trim() })
      if (error) throw error
      onCreated(name.trim())
    } catch (err) {
      setFormError(
        err.code === '23505'
          ? 'That slug is already in use. Pick a different one.'
          : err.message || 'Could not create the company.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title="Add Company" onClose={onClose}>
      {formError && <div className="form-error">{formError}</div>}
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="company-name">Company name</label>
          <input
            id="company-name"
            className="input"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>

        <div className="field">
          <label htmlFor="company-slug">Slug</label>
          <input
            id="company-slug"
            className="input"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value)
            }}
            aria-invalid={Boolean(errors.slug)}
          />
          <span className="small muted">Auto-generated from the name; edit if you need to.</span>
          {errors.slug && <span className="field-error">{errors.slug}</span>}
        </div>

        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Add Company
          </Button>
        </div>
      </form>
    </Modal>
  )
}
