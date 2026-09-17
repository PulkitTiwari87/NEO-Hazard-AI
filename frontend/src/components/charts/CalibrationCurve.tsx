import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CalibrationCurveData } from '../../api/client'
import { GRID, MUTED, SECONDARY_INK, TOOLTIP_STYLE, tickStyle } from './theme'

export function CalibrationCurve({ data, color = '#3987e5' }: { data: CalibrationCurveData; color?: string }) {
  const diagonal = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]
  const points = data.mean_predicted_value.map((v, i) => ({ x: v, y: data.fraction_of_positives[i] }))
  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 1]}
            tick={tickStyle()}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            label={{ value: 'Mean predicted probability', position: 'insideBottom', offset: -2, fill: MUTED, fontSize: 11 }}
          />
          <YAxis
            type="number"
            domain={[0, 1]}
            tick={tickStyle()}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            label={{ value: 'Observed frequency', angle: -90, position: 'insideLeft', fill: MUTED, fontSize: 11 }}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 12, color: SECONDARY_INK }} />
          <Line data={diagonal} dataKey="y" name="Perfectly calibrated" stroke={MUTED} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
          <Line data={points} dataKey="y" name={`Observed (${data.n_bins_actual} bins)`} stroke={color} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span>
          Brier score: <span className="font-mono text-slate-100">{data.brier_score.toFixed(4)}</span> (lower is better)
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{data.note}</p>
    </div>
  )
}
