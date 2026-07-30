import { useState } from 'react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import FileIcon from '../ui/FileIcon'
import Icon from '../ui/Icon'
import { formatDate, formatFileSize } from '../../lib/format'

export default function DocumentCard({ document: doc, acknowledged, onView, onAcknowledge }) {
  const [viewing, setViewing] = useState(false)
  const [acknowledging, setAcknowledging] = useState(false)
  const category = doc.document_categories

  async function handleView() {
    setViewing(true)
    try {
      await onView(doc)
    } finally {
      setViewing(false)
    }
  }

  async function handleAcknowledge() {
    setAcknowledging(true)
    try {
      await onAcknowledge(doc)
    } finally {
      setAcknowledging(false)
    }
  }

  return (
    <article className="card doc-card">
      <div className="doc-card-head">
        <FileIcon fileName={doc.file_name} />
        <div style={{ minWidth: 0 }}>
          <div className="doc-name">{doc.name}</div>
          {category && (
            <div style={{ marginTop: '0.35rem' }}>
              <Badge color={category.color}>{category.name}</Badge>
            </div>
          )}
        </div>
      </div>

      {doc.description && <p className="doc-desc" style={{ margin: 0 }}>{doc.description}</p>}

      <div className="doc-meta">
        <span>
          <Icon name="calendar" size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          {formatDate(doc.created_at)}
        </span>
        <span>{formatFileSize(doc.file_size)}</span>
      </div>

      <div className="doc-actions">
        <Button variant="primary" size="sm" onClick={handleView} loading={viewing}>
          {!viewing && <Icon name="external-link" size={15} />}
          View
        </Button>

        {acknowledged ? (
          <span className="acknowledged-pill">
            <Icon name="check" size={15} />
            Acknowledged
          </span>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAcknowledge}
            loading={acknowledging}
          >
            Acknowledge
          </Button>
        )}
      </div>
    </article>
  )
}
