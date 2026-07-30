import Icon from './Icon'
import { fileExtension } from '../../lib/format'

const BY_EXTENSION = {
  pdf: { icon: 'file-text', color: '#ef4444', label: 'PDF' },
  doc: { icon: 'file-text', color: '#2563eb', label: 'DOC' },
  docx: { icon: 'file-text', color: '#2563eb', label: 'DOCX' },
  xls: { icon: 'table', color: '#10b981', label: 'XLS' },
  xlsx: { icon: 'table', color: '#10b981', label: 'XLSX' },
  csv: { icon: 'table', color: '#10b981', label: 'CSV' },
  png: { icon: 'image', color: '#8b5cf6', label: 'PNG' },
  jpg: { icon: 'image', color: '#8b5cf6', label: 'JPG' },
  jpeg: { icon: 'image', color: '#8b5cf6', label: 'JPEG' },
  txt: { icon: 'file-text', color: '#6b7280', label: 'TXT' },
}

export function fileMeta(fileName) {
  const ext = fileExtension(fileName)
  return BY_EXTENSION[ext] || { icon: 'file', color: '#6b7280', label: ext.toUpperCase() || 'FILE' }
}

export default function FileIcon({ fileName, size = 20, boxed = true }) {
  const meta = fileMeta(fileName)

  if (!boxed) {
    return <Icon name={meta.icon} size={size} style={{ color: meta.color }} />
  }

  return (
    <span
      title={meta.label}
      style={{
        width: size + 20,
        height: size + 20,
        borderRadius: 8,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: `${meta.color}1f`,
        color: meta.color,
      }}
    >
      <Icon name={meta.icon} size={size} />
    </span>
  )
}
