import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, getSignedUrl } from '../lib/supabase'
import { useAuth } from './useAuth'

const DOCUMENT_SELECT =
  'id, company_id, category_id, name, description, file_path, file_name, file_size, file_type, created_at, document_categories (id, name, color, icon), companies (id, name, slug)'

export function useCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('document_categories')
      .select('id, name, icon, color, sort_order')
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (!error) setCategories(data || [])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return { categories, loading }
}

/**
 * Loads documents visible to the signed-in user. RLS already scopes clients to
 * their own company; `companyId` is an extra filter used by the admin views.
 */
export function useDocuments({ companyId = null, categoryId = null, limit = null } = {}) {
  const { user } = useAuth()
  const [documents, setDocuments] = useState([])
  const [acknowledgedIds, setAcknowledgedIds] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('documents')
        .select(DOCUMENT_SELECT)
        .order('created_at', { ascending: false })

      if (companyId) query = query.eq('company_id', companyId)
      if (categoryId) query = query.eq('category_id', categoryId)
      if (limit) query = query.limit(limit)

      const { data, error: queryError } = await query
      if (queryError) throw queryError
      setDocuments(data || [])

      if (user?.id) {
        const { data: acks, error: ackError } = await supabase
          .from('document_acknowledgments')
          .select('document_id')
          .eq('user_id', user.id)
        if (ackError) throw ackError
        setAcknowledgedIds(new Set((acks || []).map((a) => a.document_id)))
      } else {
        setAcknowledgedIds(new Set())
      }
    } catch (err) {
      setError(err.message || 'Could not load documents.')
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [companyId, categoryId, limit, user?.id])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const acknowledge = useCallback(
    async (documentId) => {
      if (!user?.id) throw new Error('You must be signed in to acknowledge a document.')
      const { error: ackError } = await supabase
        .from('document_acknowledgments')
        .upsert({ document_id: documentId, user_id: user.id }, { onConflict: 'document_id,user_id' })
      if (ackError) throw ackError
      setAcknowledgedIds((current) => new Set(current).add(documentId))
    },
    [user?.id]
  )

  const isAcknowledged = useCallback(
    (documentId) => acknowledgedIds.has(documentId),
    [acknowledgedIds]
  )

  return {
    documents,
    loading,
    error,
    refresh: fetchDocuments,
    acknowledge,
    isAcknowledged,
    acknowledgedIds,
  }
}

/**
 * Opens a document in a new tab through a 1-hour signed URL.
 *
 * The tab is opened synchronously before awaiting so the click is still
 * trusted; popup blockers reject a window.open() that lands after an await.
 */
export function useOpenDocument() {
  return useCallback(async (doc) => {
    const tab = window.open('', '_blank', 'noopener,noreferrer')
    try {
      const url = await getSignedUrl(doc.file_path, 3600)
      if (tab) {
        tab.location.href = url
      } else {
        window.location.href = url
      }
      return url
    } catch (err) {
      tab?.close()
      throw err
    }
  }, [])
}

/** Client-side search + category filtering for the documents grid. */
export function useFilteredDocuments(documents, { search = '', categoryId = null } = {}) {
  return useMemo(() => {
    const term = search.trim().toLowerCase()
    return documents.filter((doc) => {
      if (categoryId && doc.category_id !== categoryId) return false
      if (!term) return true
      return (
        doc.name?.toLowerCase().includes(term) ||
        doc.file_name?.toLowerCase().includes(term) ||
        doc.description?.toLowerCase().includes(term)
      )
    })
  }, [documents, search, categoryId])
}

export default useDocuments
