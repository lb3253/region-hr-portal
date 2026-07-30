export default function Spinner({ size, label = 'Loading' }) {
  return (
    <span
      className={`spinner${size === 'sm' ? ' spinner-sm' : ''}`}
      role="status"
      aria-label={label}
    />
  )
}

export function PageSpinner({ label = 'Loading' }) {
  return (
    <div className="spinner-center">
      <Spinner label={label} />
    </div>
  )
}
