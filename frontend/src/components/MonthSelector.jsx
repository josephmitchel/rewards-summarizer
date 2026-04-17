// Period navigator. `bounds` is { earliest: {year, month}, latest: {year, month} } or null.
// When null, navigation is unconstrained. `month` is 0-indexed.
export default function MonthSelector({ selectedPeriod, onChange, bounds }) {
  const { mode, year, month } = selectedPeriod

  const atEarliest = bounds
    ? (mode === 'year'
        ? year <= bounds.earliest.year
        : year < bounds.earliest.year || (year === bounds.earliest.year && month <= bounds.earliest.month))
    : false
  const atLatest = bounds
    ? (mode === 'year'
        ? year >= bounds.latest.year
        : year > bounds.latest.year || (year === bounds.latest.year && month >= bounds.latest.month))
    : false

  const prev = () => {
    if (atEarliest) return
    if (mode === 'year') onChange({ ...selectedPeriod, year: year - 1 })
    else if (month === 0) onChange({ ...selectedPeriod, year: year - 1, month: 11 })
    else onChange({ ...selectedPeriod, month: month - 1 })
  }
  const next = () => {
    if (atLatest) return
    if (mode === 'year') onChange({ ...selectedPeriod, year: year + 1 })
    else if (month === 11) onChange({ ...selectedPeriod, year: year + 1, month: 0 })
    else onChange({ ...selectedPeriod, month: month + 1 })
  }

  const toggleMode = () => {
    const nextMode = mode === 'month' ? 'year' : 'month'
    let nextPeriod = { ...selectedPeriod, mode: nextMode }
    // Clamp to bounds after mode switch.
    if (bounds) {
      if (nextMode === 'year') {
        if (nextPeriod.year < bounds.earliest.year) nextPeriod.year = bounds.earliest.year
        if (nextPeriod.year > bounds.latest.year) nextPeriod.year = bounds.latest.year
      } else {
        if (nextPeriod.year < bounds.earliest.year || (nextPeriod.year === bounds.earliest.year && nextPeriod.month < bounds.earliest.month)) {
          nextPeriod = { ...nextPeriod, year: bounds.earliest.year, month: bounds.earliest.month }
        } else if (nextPeriod.year > bounds.latest.year || (nextPeriod.year === bounds.latest.year && nextPeriod.month > bounds.latest.month)) {
          nextPeriod = { ...nextPeriod, year: bounds.latest.year, month: bounds.latest.month }
        }
      }
    }
    onChange(nextPeriod)
  }

  const label = mode === 'year'
    ? String(year)
    : new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div>
      <button onClick={prev} disabled={atEarliest}>&#8592;</button>
      <strong>{label}</strong>
      <button onClick={next} disabled={atLatest}>&#8594;</button>
      <button onClick={toggleMode} style={{ marginLeft: '1em' }}>
        {mode === 'month' ? 'Year view' : 'Month view'}
      </button>
    </div>
  )
}
