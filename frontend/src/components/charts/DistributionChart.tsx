import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GRID, MUTED, SECONDARY_INK, TARGET_COLOR, TOOLTIP_STYLE, tickStyle } from './theme'

interface DistributionChartProps {
  values: number[]
  groups?: boolean[] // aligned with values; true = hazardous, false = not hazardous
  bins?: number
  unit?: string
}

interface Bin {
  label: string
  start: number
  end: number
  hazardous: number
  not_hazardous: number
  total: number
}

function buildBins(values: number[], groups: boolean[] | undefined, binCount: number): Bin[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const width = (max - min) / binCount || 1
  const bins: Bin[] = Array.from({ length: binCount }, (_, i) => {
    const start = min + i * width
    const end = i === binCount - 1 ? max : start + width
    return { label: start.toPrecision(3), start, end, hazardous: 0, not_hazardous: 0, total: 0 }
  })
  values.forEach((v, i) => {
    let idx = width > 0 ? Math.floor((v - min) / width) : 0
    if (idx >= binCount) idx = binCount - 1
    if (idx < 0) idx = 0
    const bin = bins[idx]
    bin.total += 1
    if (groups) {
      if (groups[i]) bin.hazardous += 1
      else bin.not_hazardous += 1
    }
  })
  return bins
}

// Histogram of a real numeric feature, optionally split by target class.
// Bin count fixed (not tuned per feature to "look nice") — see caller for
// the exact feature name/unit shown above this chart.
export function DistributionChart({ values, groups, bins = 20, unit }: DistributionChartProps) {
  const data = buildBins(values, groups, bins)
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: MUTED, fontSize: 9 }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            interval={Math.max(0, Math.floor(bins / 8) - 1)}
          />
          <YAxis tick={tickStyle()} axisLine={{ stroke: GRID }} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `bin start: ${v}${unit ? ` ${unit}` : ''}`} />
          {groups ? (
            <>
              <Legend wrapperStyle={{ fontSize: 11, color: SECONDARY_INK }} />
              <Bar dataKey="not_hazardous" name="Not hazardous" stackId="a" fill={TARGET_COLOR.not_hazardous} />
              <Bar dataKey="hazardous" name="Potentially hazardous" stackId="a" fill={TARGET_COLOR.hazardous} />
            </>
          ) : (
            <Bar dataKey="total" name="Count" fill="#3987e5" />
          )}
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[10px] text-slate-600">n = {values.length}{unit ? `, unit: ${unit}` : ''}</p>
    </div>
  )
}
