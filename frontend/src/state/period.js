export function clampToBounds(period, bounds) {
  if (!bounds) return period
  const { earliest, latest } = bounds
  if (period.mode === 'year') {
    if (period.year < earliest.year) return { ...period, year: earliest.year }
    if (period.year > latest.year) return { ...period, year: latest.year }
    return period
  }
  if (period.year < earliest.year || (period.year === earliest.year && period.month < earliest.month)) {
    return { ...period, year: earliest.year, month: earliest.month }
  }
  if (period.year > latest.year || (period.year === latest.year && period.month > latest.month)) {
    return { ...period, year: latest.year, month: latest.month }
  }
  return period
}

export function periodToKey(period) {
  return period.mode === 'year' ? `y:${period.year}` : `m:${period.year}-${period.month}`
}

export function periodToQuery(period) {
  return period.mode === 'year'
    ? `mode=year&year=${period.year}`
    : `mode=month&year=${period.year}&month=${period.month}`
}

export function periodKeyToPeriod(key) {
  const [mode, rest] = key.split(':')
  if (mode === 'y') return { mode: 'year', year: Number(rest) }
  const [year, month] = rest.split('-').map(Number)
  return { mode: 'month', year, month }
}
