function FilterBar({ options, activeValue, onChange }) {
  return (
    <>
      {options.map((f) => (
        <button
          key={f}
          className={`filter-btn${activeValue === f ? ' filter-btn--active' : ''}`}
          onClick={() => onChange(f)}
        >
          {f === 'all' ? 'All' : f}
        </button>
      ))}
    </>
  )
}

export default FilterBar
