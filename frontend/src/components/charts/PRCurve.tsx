import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GRID, MUTED, SECONDARY_INK, TOOLTIP_STYLE, tickStyle } from './theme'

export interface PrSeries {
  key: string
  name: string
  color: string
  recall: number[]
  precision: number[]
  auc: number | null
}

// PR-AUC is informative for a minority-positive class: unlike ROC-AUC it is
// sensitive to how rare the positive class is, which is why a baseline
// (positive-class prevalence) line is drawn alongside it.
export function PRCurve({ series, baselinePrevalence }: { series: PrSeries[]; baselinePrevalence?: number | null }) {
  const baseline =
    baselinePrevalence != null
      ? [
          { recall: 0, y: baselinePrevalence },
          { recall: 1, y: baselinePrevalence },
        ]
      : null
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis
          type="number"
          dataKey="recall"
          domain={[0, 1]}
          tick={tickStyle()}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          label={{ value: 'Recall', position: 'insideBottom', offset: -2, fill: MUTED, fontSize: 11 }}
        />
        <YAxis
          type="number"
          domain={[0, 1]}
          tick={tickStyle()}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          label={{ value: 'Precision', angle: -90, position: 'insideLeft', fill: MUTED, fontSize: 11 }}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12, color: SECONDARY_INK }} />
        {baseline && (
          <Line
            data={baseline}
            dataKey="y"
            name={`Baseline prevalence (${(baselinePrevalence! * 100).toFixed(1)}%)`}
            stroke={MUTED}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
        )}
        {series.map((s) => (
          <Line
            key={s.key}
            data={s.recall.map((r, i) => ({ recall: r, precision: s.precision[i] }))}
            dataKey="precision"
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
