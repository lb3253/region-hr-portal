import { createContext, useContext } from 'react'
import { useNotifications } from '../hooks/useNotifications'

const NotificationsContext = createContext(null)

/**
 * One shared notifications store so the sidebar badge and the notifications
 * page stay in sync — marking one read updates both immediately.
 */
export function NotificationsProvider({ children }) {
  const value = useNotifications()
  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  )
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotificationsContext must be used inside a NotificationsProvider')
  return ctx
}
