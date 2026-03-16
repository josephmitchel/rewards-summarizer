import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatMonth } from './utils/csvParser'

function formatDollar(val) {
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`
  return `$${val.toFixed(0)}`
}

const CustomTooltip = ({ active, payload, label, valueLabel }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e5ea',
      borderRadius: 10,
      padding: '8px 14px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      fontSize: 13,
    }}>
      <div style={{ color: '#8e8e93', marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700, color: '#1c1c1e' }}>
        {valueLabel}: ${payload[0].value.toFixed(2)}
      </div>
    </div>
  )
}

function getValue(t, valueKey, isPoints) {
  const raw = valueKey ? t[valueKey] : t._income
  const val = valueKey
    ? (typeof raw === 'string' ? parseFloat(raw.replace(/[^0-9.-]/g, '')) || 0 : (raw || 0))
    : (raw || 0)
  return isPoints ? Math.max(0, val) * 0.008 : Math.max(0, val)
}

export default function SpendingChart({ transactions, selectedPeriod, valueKey, valueLabel, color, isPoints, yMax, dailyYear }) {
  const data = useMemo(() => {
    const isYear = selectedPeriod.length === 4

    if (isYear && dailyYear) {
      // Aggregate by day across the entire year
      const map = {}
      transactions
        .filter(t => t.Date.startsWith(selectedPeriod))
        .forEach(t => {
          map[t.Date] = (map[t.Date] || 0) + getValue(t, valueKey, isPoints)
        })

      const year = parseInt(selectedPeriod)
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const result = []
      for (let mo = 0; mo < 12; mo++) {
        const daysInMonth = new Date(year, mo + 1, 0).getDate()
        for (let d = 1; d <= daysInMonth; d++) {
          const key = `${selectedPeriod}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          result.push({ label: `${monthNames[mo]} ${d}`, tickLabel: d === 1 ? monthNames[mo] : null, value: map[key] ?? null })
        }
      }
      return result
    } else if (isYear) {
      // Aggregate by month within this year
      const map = {}
      transactions
        .filter(t => t.Date.startsWith(selectedPeriod))
        .forEach(t => {
          const month = t.Date.substring(0, 7)
          map[month] = (map[month] || 0) + getValue(t, valueKey, isPoints)
        })

      const result = []
      for (let mo = 1; mo <= 12; mo++) {
        const key = `${selectedPeriod}-${String(mo).padStart(2, '0')}`
        result.push({ label: formatMonth(key), value: map[key] ?? null })
      }
      return result
    } else {
      // Aggregate by day within the selected month
      const map = {}
      transactions
        .filter(t => t.Date.startsWith(selectedPeriod))
        .forEach(t => {
          const day = parseInt(t.Date.substring(8, 10), 10)
          map[day] = (map[day] || 0) + getValue(t, valueKey, isPoints)
        })
      const [y, m] = selectedPeriod.split('-').map(Number)
      const daysInMonth = new Date(y, m, 0).getDate()
      const result = []
      for (let d = 1; d <= daysInMonth; d++) {
        result.push({ label: `${m}/${d}`, value: map[d] ?? null })
      }
      return result
    }
  }, [transactions, selectedPeriod, valueKey, isPoints])

  // Convert to cumulative running total
  // - Carry forward the sum through gaps within the data range
  // - Use null after the last data point (blank trailing space)
  const cumulativeData = useMemo(() => {
    // Find the last index that has actual data
    let lastDataIndex = -1
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].value !== null) { lastDataIndex = i; break }
    }
    if (lastDataIndex === -1) return data

    let sum = 0
    return data.map((d, i) => {
      if (i > lastDataIndex) return { ...d, value: null }
      if (d.value !== null) sum += d.value
      return { ...d, value: sum }
    })
  }, [data])

  const hasData = cumulativeData.some(d => d.value !== null && d.value > 0)
  if (!hasData) return null

  return (
    <div className="chart-container">
      <div className="chart-title">{valueLabel} over time</div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={cumulativeData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" vertical={false} />
          <XAxis
            dataKey="label"
            tick={selectedPeriod.length === 4 && dailyYear
              ? ({ x, y, payload: tickPayload }) => {
                  const entry = cumulativeData[tickPayload.index]
                  if (!entry?.tickLabel) return null
                  return <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fill="#aeaeb2">{entry.tickLabel}</text>
                }
              : { fontSize: 11, fill: '#aeaeb2' }}
            tickLine={false}
            axisLine={false}
            interval={selectedPeriod.length === 4 && dailyYear ? 0 : 'preserveStartEnd'}
          />
          <YAxis
            tickFormatter={formatDollar}
            tick={{ fontSize: 11, fill: '#aeaeb2' }}
            tickLine={false}
            axisLine={false}
            width={48}
            domain={[0, (typeof yMax === 'object' ? (selectedPeriod.length === 4 ? yMax.year : yMax.month) : yMax) || 'auto']}
          />
          <Tooltip content={<CustomTooltip valueLabel={valueLabel} />} />
          <Line
            type="linear"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
