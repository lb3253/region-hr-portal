import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

/**
 * Notifications for the signed-in user's company. Admins have no company of
 * their own, so their list stays empty unless they are attached to one.
 */
export function useNotifications() {
  const { companyId, session } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchNotifications = useCallback(async () => {
    if (!session || !companyId) {
      setNotifications([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: queryError } = await supabase
        .from('notifications')
        .select('id, title, message, is_read, created_at, document_id, company_id, documents (id, name, file_path)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
      if (queryError) throw queryError
      setNotifications(data || [])
    } catch (err) {
      setError(err.message || 'Could not load notifications.')
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [companyId, session])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  )

  const markAsRead = useCallback(async (id) => {
    setNotifications((current) =>
      current.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
    if (updateError) throw updateError
  }, [])

  const markAllAsRead = useCallback(async () => {
    if (!companyId) return
    const unread = notifications.filter((n) => !n.is_read)
    if (unread.length === 0) return
    setNotifications((current) => current.map((n) => ({ ...n, is_read: true })))
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('company_id', companyId)
      .eq('is_read', false)
    if (updateError) throw updateError
  }, [companyId, notifications])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh: fetchNotifications,
    markAsRead,
    markAllAsRead,
  }
}

export default useNotifications
