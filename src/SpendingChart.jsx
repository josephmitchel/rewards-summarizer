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

export default function SpendingChart({ transactions, selectedPeriod, valueKey, valueLabel, color, isPoints }) {
  const data = useMemo(() => {
    const isYear = selectedPeriod.length === 4

    if (isYear) {
      // Aggregate by month within this year
      const map = {}
      transactions
        .filter(t => t.Date.startsWith(selectedPeriod))
        .forEach(t => {
          const month = t.Date.substring(0, 7)
          map[month] = (map[month] || 0) + getValue(t, valueKey, isPoints)
        })

      const now = new Date()
      const isCurrentYear = parseInt(selectedPeriod) === now.getFullYear()
      const maxMonth = isCurrentYear ? now.getMonth() + 1 : 12

      const result = []
      for (let mo = 1; mo <= maxMonth; mo++) {
        const key = `${selectedPeriod}-${String(mo).padStart(2, '0')}`
        result.push({ label: formatMonth(key), value: map[key] || 0 })
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
        result.push({ label: `${m}/${d}`, value: map[d] || 0 })
      }
      return result
    }
  }, [transactions, selectedPeriod, valueKey, isPoints])

  const hasData = data.some(d => d.value > 0)
  if (!hasData) return null

  return (
    <div className="chart-container">
      <div className="chart-title">{valueLabel} over time</div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#aeaeb2' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={formatDollar}
            tick={{ fontSize: 11, fill: '#aeaeb2' }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip valueLabel={valueLabel} />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
