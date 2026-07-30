import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import FileIcon from '../../components/ui/FileIcon'
import Icon from '../../components/ui/Icon'
import { PageSpinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/format'

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

export default function AdminDashboard() {
  const [stats, setStats] = useState({ companies: 0, documents: 0, users: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [companies, documents, users, recentDocs] = await Promise.all([
          supabase.from('companies').select('id', { count: 'exact', head: true }),
          supabase.from('documents').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase
            .from('documents')
            .select('id, name, file_name, created_at, companies (id, name), document_categories (name, color)')
            .order('created_at', { ascending: false })
            .limit(10),
        ])

        const failed = [companies, documents, users, recentDocs].find((r) => r.error)
        if (failed) throw failed.error
        if (!active) return

        setStats({
          companies: companies.count ?? 0,
          documents: documents.count ?? 0,
          users: users.count ?? 0,
        })
        setRecent(recentDocs.data || [])
      } catch (err) {
        if (active) setError(err.message || 'Could not load admin statistics.')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <p className="subhead">Overview of every client company on the portal.</p>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="stats-row">
        <StatCard icon="building" value={loading ? '—' : stats.companies} label="Client Companies" />
        <StatCard icon="folder" value={loading ? '—' : stats.documents} label="Documents Uploaded" />
        <StatCard icon="users" value={loading ? '—' : stats.users} label="Portal Users" />
      </div>

      <div className="toolbar">
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          Recent Activity
        </h2>
        <Link to="/admin/upload" className="btn btn-primary btn-sm">
          <Icon name="upload" size={15} />
          Upload Document
        </Link>
      </div>

      {loading ? (
        <PageSpinner label="Loading activity" />
      ) : recent.length === 0 ? (
        <EmptyState
          icon="upload"
          title="No documents uploaded yet"
          message="Uploaded documents will show up here with their client company."
        />
      ) : (
        <div className="recent-list">
          {recent.map((doc) => (
            <div className="card recent-row" key={doc.id}>
              <FileIcon fileName={doc.file_name} />
              <div className="recent-main">
                <div className="doc-name">{doc.name}</div>
                <div className="doc-meta" style={{ marginTop: '0.3rem' }}>
                  <strong style={{ color: 'var(--color-primary)' }}>
                    {doc.companies?.name || 'Unknown company'}
                  </strong>
                  {doc.document_categories && (
                    <Badge color={doc.document_categories.color}>
                      {doc.document_categories.name}
                    </Badge>
                  )}
                  <span>{formatDate(doc.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
