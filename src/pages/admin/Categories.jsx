import { useCallback, useEffect, useState } from 'react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Icon, { ICON_NAMES } from '../../components/ui/Icon'
import Modal, { ConfirmDialog } from '../../components/ui/Modal'
import { PageSpinner } from '../../components/ui/Spinner'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'

const PRESET_COLORS = [
  '#0c343d',
  '#f9bf4b',
  '#3b82f6',
  '#8b5cf6',
  '#10b981',
  '#ef4444',
  '#ec4899',
  '#f97316',
  '#14b8a6',
  '#6b7280',
]

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // category object, or 'new'
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [catsRes, docsRes] = await Promise.all([
        supabase
          .from('document_categories')
          .select('id, name, icon, color, sort_order')
          .order('sort_order', { ascending: true }),
        supabase.from('documents').select('category_id'),
      ])
      const failed = [catsRes, docsRes].find((r) => r.error)
      if (failed) throw failed.error

      const counts = {}
      for (const d of docsRes.data || []) {
        if (d.category_id) counts[d.category_id] = (counts[d.category_id] || 0) + 1
      }
      setCategories((catsRes.data || []).map((c) => ({ ...c, documentCount: counts[c.id] || 0 })))
    } catch (err) {
      setError(err.message || 'Could not load categories.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const { error: deleteError } = await supabase
        .from('document_categories')
        .delete()
        .eq('id', pendingDelete.id)
      if (deleteError) throw deleteError
      toast.success(`“${pendingDelete.name}” deleted.`)
      setPendingDelete(null)
      load()
    } catch (err) {
      toast.error(err.message || 'Could not delete that category.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="toolbar">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Categories</h1>
          <p className="subhead">The categories documents can be filed under.</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} />
          Add Category
        </Button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <PageSpinner label="Loading categories" />
      ) : categories.length === 0 ? (
        <EmptyState
          icon="folder"
          title="No categories yet"
          message="Add a category so uploads can be filed under it."
          action={<Button onClick={() => setEditing('new')}>Add Category</Button>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Icon</th>
                <th>Colour</th>
                <th>Order</th>
                <th>Documents</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <Badge color={category.color}>
                      <Icon name={category.icon} size={13} />
                      {category.name}
                    </Badge>
                  </td>
                  <td className="muted">{category.icon}</td>
                  <td>
                    <span className="row-gap" style={{ flexWrap: 'nowrap' }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          background: category.color,
                          border: '1px solid var(--color-border)',
                          display: 'inline-block',
                        }}
                      />
                      <span className="muted">{category.color}</span>
                    </span>
                  </td>
                  <td className="muted">{category.sort_order}</td>
                  <td>{category.documentCount}</td>
                  <td>
                    <div
                      className="row-gap"
                      style={{ flexWrap: 'nowrap', justifyContent: 'flex-end' }}
                    >
                      <Button variant="secondary" size="sm" onClick={() => setEditing(category)}>
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setPendingDelete(category)}
                      >
                        <Icon name="trash" size={14} />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CategoryModal
        open={Boolean(editing)}
        category={editing === 'new' ? null : editing}
        nextSortOrder={categories.length ? Math.max(...categories.map((c) => c.sort_order || 0)) + 1 : 1}
        onClose={() => setEditing(null)}
        onSaved={(name, isNew) => {
          setEditing(null)
          toast.success(isNew ? `“${name}” added.` : `“${name}” updated.`)
          load()
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete category"
        message={
          pendingDelete
            ? pendingDelete.documentCount > 0
              ? `Delete “${pendingDelete.name}”? ${pendingDelete.documentCount} document${
                  pendingDelete.documentCount === 1 ? '' : 's'
                } filed under it will become Uncategorized. The files themselves are not deleted.`
              : `Delete “${pendingDelete.name}”? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  )
}

function CategoryModal({ open, category, nextSortOrder, onClose, onSaved }) {
  const isNew = !category
  const [form, setForm] = useState({ name: '', icon: 'file-text', color: '#0c343d', sortOrder: 1 })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setFormError('')
    setForm(
      category
        ? {
            name: category.name,
            icon: category.icon,
            color: category.color,
            sortOrder: category.sort_order ?? 0,
          }
        : { name: '', icon: 'file-text', color: '#0c343d', sortOrder: nextSortOrder }
    )
  }, [open, category, nextSortOrder])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    const next = {}
    if (!form.name.trim()) next.name = 'Category name is required.'
    if (!/^#[0-9a-fA-F]{6}$/.test(form.color)) next.color = 'Use a 6-digit hex colour, e.g. #0c343d.'
    if (!Number.isFinite(Number(form.sortOrder))) next.sortOrder = 'Sort order must be a number.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        icon: form.icon,
        color: form.color.toLowerCase(),
        sort_order: Number(form.sortOrder),
      }

      const { error } = isNew
        ? await supabase.from('document_categories').insert(payload)
        : await supabase.from('document_categories').update(payload).eq('id', category.id)

      if (error) throw error
      onSaved(payload.name, isNew)
    } catch (err) {
      setFormError(
        /row-level security/i.test(err.message || '')
          ? 'The database is rejecting category changes. Run migration 002 in the Supabase SQL editor, then try again.'
          : err.message || 'Could not save the category.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title={isNew ? 'Add Category' : 'Edit Category'} onClose={onClose} maxWidth={520}>
      {formError && <div className="form-error">{formError}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="category-name">Name</label>
          <input
            id="category-name"
            className="input"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>

        <div className="field">
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Icon</span>
          <div className="icon-picker">
            {ICON_NAMES.map((iconName) => (
              <button
                key={iconName}
                type="button"
                title={iconName}
                aria-label={iconName}
                aria-pressed={form.icon === iconName}
                className={`icon-swatch${form.icon === iconName ? ' selected' : ''}`}
                onClick={() => set('icon', iconName)}
              >
                <Icon name={iconName} size={18} />
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="category-color">Colour</label>
          <div className="color-picker">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset}
                type="button"
                title={preset}
                aria-label={`Use ${preset}`}
                aria-pressed={form.color.toLowerCase() === preset}
                className={`color-swatch${form.color.toLowerCase() === preset ? ' selected' : ''}`}
                style={{ background: preset }}
                onClick={() => set('color', preset)}
              />
            ))}
          </div>
          <div className="row-gap" style={{ marginTop: '0.5rem' }}>
            <input
              type="color"
              className="color-input"
              value={/^#[0-9a-fA-F]{6}$/.test(form.color) ? form.color : '#0c343d'}
              onChange={(e) => set('color', e.target.value)}
              aria-label="Pick a custom colour"
            />
            <input
              id="category-color"
              className="input"
              style={{ width: 130 }}
              value={form.color}
              onChange={(e) => set('color', e.target.value)}
              aria-invalid={Boolean(errors.color)}
            />
          </div>
          {errors.color && <span className="field-error">{errors.color}</span>}
        </div>

        <div className="field">
          <label htmlFor="category-order">Sort order</label>
          <input
            id="category-order"
            className="input"
            type="number"
            style={{ width: 130 }}
            value={form.sortOrder}
            onChange={(e) => set('sortOrder', e.target.value)}
            aria-invalid={Boolean(errors.sortOrder)}
          />
          <span className="small muted">Lower numbers appear first in the category tabs.</span>
          {errors.sortOrder && <span className="field-error">{errors.sortOrder}</span>}
        </div>

        <div className="field">
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Preview</span>
          <div>
            <Badge color={/^#[0-9a-fA-F]{6}$/.test(form.color) ? form.color : '#0c343d'}>
              <Icon name={form.icon} size={13} />
              {form.name.trim() || 'Category name'}
            </Badge>
          </div>
        </div>

        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {isNew ? 'Add Category' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
