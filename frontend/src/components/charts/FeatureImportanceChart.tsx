import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GRID, SECONDARY_INK, TOOLTIP_STYLE, tickStyle } from './theme'

interface FeatureImportanceChartProps {
  importance: { feature: string; value: number }[]
  valueLabel: string
  color?: string
  top?: number
}

export function FeatureImportanceChart({ importance, valueLabel, color = '#3987e5', top = 12 }: FeatureImportanceChartProps) {
  const data = importance.slice(0, top).reverse()
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={tickStyle()} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis
          type="category"
          dataKey="feature"
          width={170}
          tick={{ fill: SECONDARY_INK, fontSize: 11 }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="value" name={valueLabel} fill={color} radius={[0, 3, 3, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  )
}
