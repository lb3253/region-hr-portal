import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import FileIcon from '../../components/ui/FileIcon'
import Icon from '../../components/ui/Icon'
import { ConfirmDialog } from '../../components/ui/Modal'
import { PageSpinner } from '../../components/ui/Spinner'
import { useToast } from '../../context/ToastContext'
import { useCategories, useOpenDocument } from '../../hooks/useDocuments'
import { supabase, DOCUMENTS_BUCKET } from '../../lib/supabase'
import { formatDate, formatFileSize } from '../../lib/format'

export default function DocumentManager() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { categories } = useCategories()
  const openDocument = useOpenDocument()
  const toast = useToast()

  const companyFilter = searchParams.get('company') || ''
  const categoryFilter = searchParams.get('category') || ''
  const search = searchParams.get('q') || ''

  const [documents, setDocuments] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [docsRes, companiesRes] = await Promise.all([
        supabase
          .from('documents')
          .select(
            'id, name, file_name, file_path, file_size, created_at, company_id, category_id, companies (id, name), document_categories (id, name, color)'
          )
          .order('created_at', { ascending: false }),
        supabase.from('companies').select('id, name').order('name'),
      ])
      const failed = [docsRes, companiesRes].find((r) => r.error)
      if (failed) throw failed.error
      setDocuments(docsRes.data || [])
      setCompanies(companiesRes.data || [])
    } catch (err) {
      setError(err.message || 'Could not load documents.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return documents.filter((doc) => {
      if (companyFilter && doc.company_id !== companyFilter) return false
      if (categoryFilter && doc.category_id !== categoryFilter) return false
      if (!term) return true
      return (
        doc.name?.toLowerCase().includes(term) || doc.file_name?.toLowerCase().includes(term)
      )
    })
  }, [documents, companyFilter, categoryFilter, search])

  async function handleView(doc) {
    try {
      await openDocument(doc)
    } catch (err) {
      toast.error(err.message || 'Could not open that document.')
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      // Remove the row first: notifications and acknowledgments cascade from it,
      // and a leftover storage object is harmless compared with a row that
      // points at a file that no longer exists.
      const { error: rowError } = await supabase
        .from('documents')
        .delete()
        .eq('id', pendingDelete.id)
      if (rowError) throw rowError

      const { error: storageError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .remove([pendingDelete.file_path])
      if (storageError) {
        toast.info('Document removed, but its stored file could not be deleted.')
      } else {
        toast.success('Document deleted.')
      }

      setDocuments((current) => current.filter((d) => d.id !== pendingDelete.id))
      setPendingDelete(null)
    } catch (err) {
      toast.error(err.message || 'Could not delete that document.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>All Documents</h1>
        <p className="subhead">Every document across all client companies.</p>
      </div>

      <div className="toolbar">
        <div className="row-gap">
          <select
            className="select"
            style={{ width: 'auto' }}
            value={companyFilter}
            onChange={(e) => updateFilter('company', e.target.value)}
            aria-label="Filter by company"
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            className="select"
            style={{ width: 'auto' }}
            value={categoryFilter}
            onChange={(e) => updateFilter('category', e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="search-input-wrap">
          <Icon name="search" size={16} />
          <label className="sr-only" htmlFor="admin-doc-search">
            Search documents
          </label>
          <input
            id="admin-doc-search"
            className="input"
            type="search"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => updateFilter('q', e.target.value)}
          />
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <PageSpinner label="Loading documents" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="folder"
          title={documents.length === 0 ? 'No documents uploaded yet' : 'Nothing matches these filters'}
          message={
            documents.length === 0
              ? 'Upload a document to share it with a client company.'
              : 'Try clearing the company, category or search filters.'
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Category</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div className="row-gap" style={{ flexWrap: 'nowrap' }}>
                      <FileIcon fileName={doc.file_name} size={16} />
                      <span style={{ fontWeight: 600 }}>{doc.name}</span>
                    </div>
                  </td>
                  <td>{doc.companies?.name || <span className="muted">—</span>}</td>
                  <td>
                    {doc.document_categories ? (
                      <Badge color={doc.document_categories.color}>
                        {doc.document_categories.name}
                      </Badge>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="muted">{formatFileSize(doc.file_size)}</td>
                  <td className="muted">{formatDate(doc.created_at)}</td>
                  <td>
                    <div className="row-gap" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                      <Button variant="secondary" size="sm" onClick={() => handleView(doc)}>
                        View
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setPendingDelete(doc)}>
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

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete document"
        message={
          pendingDelete
            ? `Delete “${pendingDelete.name}”? This removes the file for ${
                pendingDelete.companies?.name || 'the client'
              } and cannot be undone.`
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
