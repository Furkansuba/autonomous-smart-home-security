// Lightweight client-side CSV export.
//
// Exports the rows currently held in a page's React state — i.e. the currently
// loaded / filtered table view — not a separate full-database dump. No backend
// call is made here. Callers decide which columns to include, so secrets/tokens
// are never exported unless explicitly listed.

// Escape a single CSV cell per RFC 4180: wrap in double quotes when the value
// contains a comma, double quote, or line break, and double any inner quotes.
// null / undefined become an empty cell.
function csvCell(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

// Build a safe, timestamped filename: "<base>_<YYYY-MM-DD_HHMM>.csv" in local time.
function buildFilename(base) {
  const safe = String(base || 'export')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp =
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}${pad(d.getMinutes())}`
  return `${safe || 'export'}_${stamp}.csv`
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// UTF-8 byte order mark so Excel opens accented/Unicode text correctly.
const BOM = String.fromCharCode(0xfeff)

/**
 * Export an array of row objects to a downloaded CSV file.
 *
 * @param {string} filenameBase  Page name used in the generated filename.
 * @param {Array<{header: string, value: (row: any) => any}>} columns
 * @param {Array<object>} rows   The currently loaded / filtered rows.
 * @returns {boolean} false when there is nothing to export.
 */
export function exportRowsToCsv(filenameBase, columns, rows) {
  if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(columns) || columns.length === 0) {
    return false
  }
  const headerLine = columns.map((c) => csvCell(c.header)).join(',')
  const dataLines = rows.map((row) =>
    columns.map((c) => csvCell(c.value(row))).join(',')
  )
  const content = BOM + [headerLine, ...dataLines].join('\r\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, buildFilename(filenameBase))
  return true
}
