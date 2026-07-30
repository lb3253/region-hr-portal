/**
 * Category filter pills. `value` is a category id, or null for "All".
 * Counts are optional and rendered inline when supplied.
 */
export default function CategoryTabs({ categories, value, onChange, counts }) {
  function label(name, id) {
    if (!counts) return name
    const count = counts[id ?? 'all'] ?? 0
    return `${name} (${count})`
  }

  return (
    <div className="category-tabs" role="tablist" aria-label="Filter documents by category">
      <button
        type="button"
        role="tab"
        aria-selected={value === null}
        className={`category-tab${value === null ? ' active' : ''}`}
        onClick={() => onChange(null)}
      >
        {label('All', null)}
      </button>

      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          role="tab"
          aria-selected={value === category.id}
          className={`category-tab${value === category.id ? ' active' : ''}`}
          onClick={() => onChange(category.id)}
        >
          {label(category.name, category.id)}
        </button>
      ))}
    </div>
  )
}
