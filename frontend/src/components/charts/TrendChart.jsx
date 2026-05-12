import { useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot } from 'recharts'
import './TrendChart.css'

// Line + shaded comparison area, brand-styled. Designed to be reused across
// Dashboard / Spending / Optimize. Consumer prepares data in the shape:
//   [{ x: <any>, current: number|null, prior: number|null }, ...]
//
// Props:
//   data           — required, array shaped as above
//   yFormatter     — optional, fn(number) => string for axis + tooltip values
//   xFormatter     — optional, fn(xValue) => string for X-axis tick labels
//   labelFormatter — optional, fn(xValue) => string for tooltip x label
//   tooltipContent — optional, fn(point) => ReactNode | null. When provided,
//                    overrides the default tooltip rendering entirely. `point`
//                    is the underlying data row ({ x, current, prior }).
//   legend         — optional, { current: string, prior: string } — when set,
//                    renders a small legend below the plot with one line swatch
//                    per series.
//   height         — optional, fixed pixel height (default 160)
//
// Tick behaviour:
//   X: 5 evenly-spaced ticks across the data range, anchored to first/last.
//   Y: 4 ticks at [0, ⅓·max, ⅔·max, max], where max is the prior series's max
//      (fallback to current's max if prior is empty).
export default function TrendChart({ data, yFormatter, xFormatter, labelFormatter, tooltipContent, legend, height = 160 }) {
  const tooltipFormatter = (value) => (yFormatter ? yFormatter(value) : value)
  const tooltipLabelFormatter = (label) => (labelFormatter ? labelFormatter(label) : label)
  const customContent = tooltipContent
    ? ({ active, payload }) => {
        if (!active || !payload?.length) return null
        const rendered = tooltipContent(payload[0].payload)
        if (rendered == null) return null
        return <div className="trend-chart__tooltip">{rendered}</div>
      }
    : undefined

  const { xTicks, yTicks, lastCurrent } = useMemo(() => {
    if (!data?.length) return { xTicks: [], yTicks: [], lastCurrent: null }

    const xs = data.map(d => d.x)
    const minX = xs[0]
    const maxX = xs[xs.length - 1]
    const xT = [0, 1, 2, 3, 4].map(i => Math.round(minX + (maxX - minX) * i / 4))

    const priorVals = data.map(d => d.prior).filter(v => typeof v === 'number')
    const currentVals = data.map(d => d.current).filter(v => typeof v === 'number')
    const max = priorVals.length ? Math.max(...priorVals) : (currentVals.length ? Math.max(...currentVals) : 0)
    // Render 3 labels above 0 (⅓·max, ⅔·max, max). 0 is omitted so the
    // baseline isn't labeled, but the domain still starts at 0 via the YAxis.
    const yT = max > 0
      ? [Math.round(max / 3), Math.round((2 * max) / 3), Math.round(max)]
      : []

    // Last point of the current series, for the hollow end dot.
    let last = null
    for (let i = data.length - 1; i >= 0; i--) {
      if (typeof data[i].current === 'number') { last = data[i]; break }
    }

    return { xTicks: xT, yTicks: yT, lastCurrent: last }
  }, [data])

  return (
    <div className="trend-chart">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid
            horizontal
            vertical={false}
            strokeDasharray="4 4"
            stroke="var(--color-card-border)"
          />
          <Area
            type="monotone"
            dataKey="prior"
            stroke="none"
            fill="var(--color-brand-primary)"
            fillOpacity={0.15}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="current"
            stroke="var(--color-brand-primary)"
            strokeWidth={4}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          {lastCurrent && (
            <ReferenceDot
              x={lastCurrent.x}
              y={lastCurrent.current}
              r={7}
              fill="var(--color-surface-base)"
              stroke="var(--color-brand-primary)"
              strokeWidth={4}
              ifOverflow="visible"
              isFront
            />
          )}
          <XAxis
            dataKey="x"
            ticks={xTicks}
            interval={0}
            padding={{ left: 8, right: 8 }}
            tickFormatter={xFormatter}
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            tickLine={false}
            tickMargin={12}
            axisLine={{ stroke: 'var(--color-card-border)' }}
            height={36}
          />
          <YAxis
            orientation="right"
            ticks={yTicks}
            domain={[0, 'auto']}
            tickFormatter={yFormatter}
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11, textAnchor: 'end' }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickMargin={36}
          />
          <Tooltip
            cursor={{ stroke: 'var(--color-card-border)', strokeDasharray: '3 3' }}
            animationDuration={0}
            wrapperStyle={{ transition: 'none' }}
            {...(customContent
              ? { content: customContent }
              : {
                  formatter: tooltipFormatter,
                  labelFormatter: tooltipLabelFormatter,
                  contentStyle: {
                    background: 'var(--color-surface-base)',
                    border: '1px solid var(--color-card-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                    padding: '8px 12px',
                  },
                  itemStyle: { color: 'var(--color-text-primary)' },
                  labelStyle: { color: 'var(--color-text-muted)' },
                })}
          />
        </ComposedChart>
      </ResponsiveContainer>
      {legend && (
        <div className="trend-chart__legend">
          <span className="trend-chart__legend-item">
            <span className="trend-chart__legend-line trend-chart__legend-line--current" />
            {legend.current}
          </span>
          <span className="trend-chart__legend-item">
            <span className="trend-chart__legend-line trend-chart__legend-line--prior" />
            {legend.prior}
          </span>
        </div>
      )}
    </div>
  )
}
