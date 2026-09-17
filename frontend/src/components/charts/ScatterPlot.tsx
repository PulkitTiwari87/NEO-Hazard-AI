import { CartesianGrid, Legend, Scatter, ScatterChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { GRID, SECONDARY_INK, TARGET_COLOR, TOOLTIP_STYLE, tickStyle } from './theme'

export interface ScatterPoint {
  x: number
  y: number
  hazardous: boolean
  id?: string | number
}

interface ScatterPlotProps {
  points: ScatterPoint[]
  xLabel: string
  yLabel: string
}

// Real observations only (see caller for the sampled-N note when the full
// dataset exceeds the render cap). Color = target class; this is a
// visualization of association, not a causal claim.
export function ScatterPlot({ points, xLabel, yLabel }: ScatterPlotProps) {
  const hazardous = points.filter((p) => p.hazardous)
  const notHazardous = points.filter((p) => !p.hazardous)
  return (
    <ResponsiveContainer width="100%" height={340}>
      <ScatterChart margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis
          type="number"
          dataKey="x"
          name={xLabel}
          tick={tickStyle()}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          label={{ value: xLabel, position: 'insideBottom', offset: -4, fill: '#898781', fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yLabel}
          tick={tickStyle()}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#898781', fontSize: 11 }}
        />
        <ZAxis range={[24, 24]} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ strokeDasharray: '3 3', stroke: GRID }} />
        <Legend wrapperStyle={{ fontSize: 12, color: SECONDARY_INK }} />
        <Scatter name="Not hazardous" data={notHazardous} fill={TARGET_COLOR.not_hazardous} fillOpacity={0.55} />
        <Scatter name="Potentially hazardous" data={hazardous} fill={TARGET_COLOR.hazardous} fillOpacity={0.7} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}
