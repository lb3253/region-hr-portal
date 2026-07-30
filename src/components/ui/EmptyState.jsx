import Icon from './Icon'

export default function EmptyState({ icon = 'inbox', title, message, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name={icon} size={34} strokeWidth={1.6} />
      </div>
      {title && <h3>{title}</h3>}
      {message && <p style={{ margin: '0 0 0.5rem' }}>{message}</p>}
      {action}
    </div>
  )
}
