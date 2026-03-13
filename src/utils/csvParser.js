export function parseCSV(csvString) {
  const lines = csvString.trim().split('\n')
  const headers = parseLine(lines[0])
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseLine(line)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = values[i] ?? '' })
    return obj
  })
}

function parseLine(line) {
  return line.split('","').map(v => v.replace(/^"|"$/g, ''))
}

export function parseAmount(str) {
  if (!str) return 0
  return parseFloat(str.replace(/[$,]/g, '')) || 0
}

export function formatMonth(yearMonth) {
  const [year, month] = yearMonth.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// Returns the Monday of the week containing dateStr (YYYY-MM-DD)
export function getWeekStart(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  const day = date.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date.toISOString().slice(0, 10)
}

export function formatWeek(weekStart) {
  const start = new Date(weekStart + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const opts = { month: 'short', day: 'numeric' }
  const startStr = start.toLocaleDateString('en-US', opts)
  const endStr = end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  return `${startStr} – ${endStr}`
}

export function formatMultiplier(raw) {
  if (!raw || !raw.trim()) return null
  return raw.trim().replace('.0x', 'x').replace('.0%', '%')
}
