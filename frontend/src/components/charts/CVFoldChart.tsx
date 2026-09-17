import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { FoldResult } from '../../api/client'
import { GRID, MUTED, SECONDARY_INK, TOOLTIP_STYLE, tickStyle } from './theme'

interface CVFoldChartProps {
  folds: FoldResult[]
  metric: keyof Pick<FoldResult, 'accuracy' | 'precision' | 'recall' | 'f1' | 'roc_auc' | 'pr_auc'>
  mean?: number | null
  color?: string
}

// Fold-by-fold values for one metric — shows whether a model's performance
// is stable across folds or dependent on a particular split. Real per-fold
// values only; folds without a defined metric (e.g. roc_auc on a
// single-class fold) are simply omitted, not zero-filled.
export function CVFoldChart({ folds, metric, mean, color = '#3987e5' }: CVFoldChartProps) {
  const data = folds
    .filter((f) => f[metric] !== null && f[metric] !== undefined)
    .map((f) => ({ fold: `Fold ${f.fold}`, value: f[metric] as number }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 48, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="fold" tick={tickStyle()} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis domain={[0, 1]} tick={tickStyle()} axisLine={{ stroke: GRID }} tickLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11, color: SECONDARY_INK }} />
        {mean != null && (
          <ReferenceLine y={mean} stroke={MUTED} strokeDasharray="4 4" label={{ value: `mean ${mean.toFixed(3)}`, fill: MUTED, fontSize: 10, position: 'insideTopRight' }} />
        )}
        <Bar dataKey="value" name={metric} fill={color} radius={[3, 3, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  )
}
