import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GRID, SECONDARY_INK, TOOLTIP_STYLE, tickStyle } from './theme'

interface SignedBarChartProps {
  items: { feature: string; value: number }[]
  positiveColor?: string
  negativeColor?: string
}

// Horizontal bar chart with sign-aware coloring — used for SHAP local
// contributions, where the direction (pushes toward/away from the positive
// class) matters as much as the magnitude.
export function SignedBarChart({ items, positiveColor = '#d95926', negativeColor = '#3987e5' }: SignedBarChartProps) {
  const data = [...items].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).reverse()
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={tickStyle()} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis
          type="category"
          dataKey="feature"
          width={180}
          tick={{ fill: SECONDARY_INK, fontSize: 11 }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="value" name="SHAP value" radius={[0, 3, 3, 0]} maxBarSize={16}>
          {data.map((d) => (
            <Cell key={d.feature} fill={d.value >= 0 ? positiveColor : negativeColor} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
