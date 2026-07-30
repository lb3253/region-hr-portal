import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import { PageSpinner } from '../components/ui/Spinner'
import { useNotificationsContext } from '../context/NotificationsContext'
import { useToast } from '../context/ToastContext'
import { useOpenDocument } from '../hooks/useDocuments'
import { formatDateTime } from '../lib/format'

export default function Notifications() {
  const { notifications, unreadCount, loading, error, markAsRead, markAllAsRead } =
    useNotificationsContext()
  const openDocument = useOpenDocument()
  const toast = useToast()

  async function handleClick(notification) {
    if (!notification.is_read) {
      try {
        await markAsRead(notification.id)
      } catch (err) {
        toast.error(err.message || 'Could not mark that notification as read.')
      }
    }
  }

  async function handleOpenDocument(e, doc) {
    e.stopPropagation()
    try {
      await openDocument(doc)
    } catch (err) {
      toast.error(err.message || 'Could not open that document.')
    }
  }

  async function handleMarkAll() {
    try {
      await markAllAsRead()
      toast.success('All notifications marked as read.')
    } catch (err) {
      toast.error(err.message || 'Could not mark notifications as read.')
    }
  }

  return (
    <>
      <div className="toolbar">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Notifications</h1>
          <p className="subhead">
            {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
          </p>
        </div>
        <Button variant="secondary" onClick={handleMarkAll} disabled={unreadCount === 0}>
          <Icon name="check" size={16} />
          Mark all as read
        </Button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <PageSpinner label="Loading notifications" />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No notifications"
          message="You will be notified here whenever Region HR shares a new document."
        />
      ) : (
        <div className="notif-list">
          {notifications.map((n) => (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              className={`card notif-item${n.is_read ? '' : ' unread'}`}
              onClick={() => handleClick(n)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleClick(n)
                }
              }}
            >
              <div className="notif-title">{n.title}</div>
              {n.message && <div className="notif-message">{n.message}</div>}
              {n.documents && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ paddingLeft: 0, color: 'var(--color-primary)' }}
                  onClick={(e) => handleOpenDocument(e, n.documents)}
                >
                  <Icon name="external-link" size={14} />
                  {n.documents.name}
                </button>
              )}
              <div className="notif-date">{formatDateTime(n.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
