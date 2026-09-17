import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GRID, MUTED, SECONDARY_INK, TOOLTIP_STYLE, tickStyle } from './theme'

export interface RocSeries {
  key: string
  name: string
  color: string
  fpr: number[]
  tpr: number[]
  auc: number | null
}

// ROC-AUC summarizes ranking discrimination on the evaluated dataset; it is
// not an impact probability. See the caller's page-level explanation.
export function ROCCurve({ series }: { series: RocSeries[] }) {
  const diagonal = [
    { fpr: 0, y: 0 },
    { fpr: 1, y: 1 },
  ]
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis
          type="number"
          dataKey="fpr"
          domain={[0, 1]}
          tick={tickStyle()}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          label={{ value: 'False positive rate', position: 'insideBottom', offset: -2, fill: MUTED, fontSize: 11 }}
        />
        <YAxis
          type="number"
          domain={[0, 1]}
          tick={tickStyle()}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          label={{ value: 'True positive rate', angle: -90, position: 'insideLeft', fill: MUTED, fontSize: 11 }}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12, color: SECONDARY_INK }} />
        <Line
          data={diagonal}
          dataKey="y"
          name="Chance"
          stroke={MUTED}
          strokeDasharray="4 4"
          dot={false}
          isAnimationActive={false}
        />
        {series.map((s) => (
          <Line
            key={s.key}
            data={s.fpr.map((f, i) => ({ fpr: f, tpr: s.tpr[i] }))}
            dataKey="tpr"
            name={`${s.name}${s.auc != null ? ` (AUC ${s.auc.toFixed(3)})` : ''}`}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
