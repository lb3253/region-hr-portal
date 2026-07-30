/**
 * Pill badge tinted from an arbitrary hex color (category colors come from the
 * database, so the tint is derived at runtime rather than from a fixed class).
 */
function hexToRgb(hex) {
  const clean = (hex || '').replace('#', '')
  if (clean.length !== 6) return null
  const int = Number.parseInt(clean, 16)
  if (Number.isNaN(int)) return null
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

export default function Badge({ children, color, className = '', ...rest }) {
  const rgb = hexToRgb(color)
  const style = rgb
    ? {
        background: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`,
        color,
        border: `1px solid rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`,
      }
    : {
        background: 'rgba(12, 52, 61, 0.08)',
        color: 'var(--color-primary)',
        border: '1px solid var(--color-border)',
      }

  return (
    <span className={`badge ${className}`} style={style} {...rest}>
      {children}
    </span>
  )
}
