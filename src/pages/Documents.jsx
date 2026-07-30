import { useMemo, useState } from 'react'
import CategoryTabs from '../components/documents/CategoryTabs'
import DocumentCard from '../components/documents/DocumentCard'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import { PageSpinner } from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import {
  useCategories,
  useDocuments,
  useFilteredDocuments,
  useOpenDocument,
} from '../hooks/useDocuments'
import { useToast } from '../context/ToastContext'

export default function Documents() {
  const { companyId, company } = useAuth()
  const { categories } = useCategories()
  const { documents, loading, error, acknowledge, isAcknowledged } = useDocuments({ companyId })
  const openDocument = useOpenDocument()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState(null)

  const filtered = useFilteredDocuments(documents, { search, categoryId })

  const counts = useMemo(() => {
    const next = { all: documents.length }
    for (const doc of documents) {
      if (!doc.category_id) continue
      next[doc.category_id] = (next[doc.category_id] || 0) + 1
    }
    return next
  }, [documents])

  async function handleView(doc) {
    try {
      await openDocument(doc)
    } catch (err) {
      toast.error(err.message || 'Could not open that document.')
    }
  }

  async function handleAcknowledge(doc) {
    try {
      await acknowledge(doc.id)
      toast.success(`Acknowledged “${doc.name}”.`)
    } catch (err) {
      toast.error(err.message || 'Could not record your acknowledgment.')
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Documents</h1>
        <p className="subhead">{company?.name || 'Your documents'}</p>
      </div>

      <div className="filter-bar">
        <CategoryTabs
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
          counts={counts}
        />

        <div className="search-input-wrap">
          <Icon name="search" size={16} />
          <label className="sr-only" htmlFor="doc-search">
            Search documents
          </label>
          <input
            id="doc-search"
            className="input"
            type="search"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <PageSpinner label="Loading documents" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="folder"
          title={documents.length === 0 ? 'No documents yet' : 'Nothing matches this filter'}
          message={
            documents.length === 0
              ? 'When Region HR shares documents with your company, they will appear here.'
              : 'Try a different category or clear your search.'
          }
        />
      ) : (
        <div className="doc-grid">
          {filtered.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              acknowledged={isAcknowledged(doc.id)}
              onView={handleView}
              onAcknowledge={handleAcknowledge}
            />
          ))}
        </div>
      )}
    </>
  )
}
