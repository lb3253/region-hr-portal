import { Link } from 'react-router-dom'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import FileIcon from '../components/ui/FileIcon'
import Icon from '../components/ui/Icon'
import { PageSpinner } from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { useDocuments, useOpenDocument } from '../hooks/useDocuments'
import { useNotificationsContext } from '../context/NotificationsContext'
import { useToast } from '../context/ToastContext'
import { firstName, formatDate, isSameMonth } from '../lib/format'

function StatCard({ icon, value, label }) {
  return (
    <div className="card stat-card">
      <span className="stat-icon">
        <Icon name={icon} size={21} />
      </span>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { profile, company, user, companyId, isAdmin } = useAuth()
  const { documents, loading, error } = useDocuments({ companyId })
  const { unreadCount } = useNotificationsContext()
  const openDocument = useOpenDocument()
  const toast = useToast()

  const newThisMonth = documents.filter((d) => isSameMonth(d.created_at)).length
  const recent = documents.slice(0, 5)

  async function handleView(doc) {
    try {
      await openDocument(doc)
    } catch (err) {
      toast.error(err.message || 'Could not open that document.')
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Welcome back, {firstName(profile?.full_name, user?.email)}</h1>
        <p className="subhead">
          {company?.name || (isAdmin ? 'Region HR — Administrator' : 'No company assigned yet')}
        </p>
      </div>

      {!companyId && !isAdmin && (
        <div className="form-error">
          Your account is not linked to a company yet, so no documents will appear. Please
          contact your Region HR representative.
        </div>
      )}

      <div className="stats-row">
        <StatCard icon="folder" value={loading ? '—' : documents.length} label="Total Documents" />
        <StatCard icon="calendar" value={loading ? '—' : newThisMonth} label="New This Month" />
        <StatCard icon="bell" value={unreadCount} label="Unread Notifications" />
      </div>

      <h2 className="section-title">Recent Documents</h2>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <PageSpinner label="Loading your documents" />
      ) : recent.length === 0 ? (
        <EmptyState
          icon="folder"
          title="No documents yet"
          message="When Region HR shares documents with your company, they will appear here."
        />
      ) : (
        <div className="recent-list">
          {recent.map((doc) => (
            <div className="card recent-row" key={doc.id}>
              <FileIcon fileName={doc.file_name} />
              <div className="recent-main">
                <div className="doc-name">{doc.name}</div>
                <div className="doc-meta" style={{ marginTop: '0.3rem' }}>
                  {doc.document_categories && (
                    <Badge color={doc.document_categories.color}>
                      {doc.document_categories.name}
                    </Badge>
                  )}
                  <span>{formatDate(doc.created_at)}</span>
                </div>
              </div>
              <Button variant="primary" size="sm" onClick={() => handleView(doc)}>
                <Icon name="external-link" size={15} />
                View
              </Button>
            </div>
          ))}
        </div>
      )}

      <h2 className="section-title">Quick Actions</h2>
      <div className="row-gap">
        <Link to="/documents" className="btn btn-primary">
          <Icon name="folder" size={16} />
          View All Documents
        </Link>
        <Link to="/notifications" className="btn btn-secondary">
          <Icon name="bell" size={16} />
          Notifications
        </Link>
      </div>
    </>
  )
}
