export function formatDateTime(raw) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (isNaN(d)) return '—'
  return d.toLocaleString()
}
