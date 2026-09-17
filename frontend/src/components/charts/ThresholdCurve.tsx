import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ThresholdRow } from '../../api/client'
import { GRID, MUTED, SECONDARY_INK, TOOLTIP_STYLE, tickStyle } from './theme'

// Interactive decision-threshold explorer. Built from out-of-fold
// cross-validation probabilities (never the holdout test set) — see the
// `source` field on the API response, shown by the caller.
export function ThresholdCurve({ rows }: { rows: ThresholdRow[] }) {
  const [threshold, setThreshold] = useState(0.5)

  const closest = useMemo(() => {
    if (rows.length === 0) return null
    return rows.reduce((best, row) => (Math.abs(row.threshold - threshold) < Math.abs(best.threshold - threshold) ? row : best), rows[0])
  }, [rows, threshold])

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rows} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis
            dataKey="threshold"
            type="number"
            domain={[0, 1]}
            tick={tickStyle()}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            label={{ value: 'Decision threshold', position: 'insideBottom', offset: -2, fill: MUTED, fontSize: 11 }}
          />
          <YAxis domain={[0, 1]} tick={tickStyle()} axisLine={{ stroke: GRID }} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `threshold = ${Number(v).toFixed(2)}`} />
          <Legend wrapperStyle={{ fontSize: 12, color: SECONDARY_INK }} />
          <ReferenceLine x={threshold} stroke="#e0af3c" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="precision" name="Precision" stroke="#3987e5" dot={false} strokeWidth={2} isAnimationActive={false} />
          <Line type="monotone" dataKey="recall" name="Recall" stroke="#d95926" dot={false} strokeWidth={2} isAnimationActive={false} />
          <Line type="monotone" dataKey="f1" name="F1" stroke="#199e70" dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 rounded-md border border-white/5 bg-black/20 p-3">
        <label className="flex items-center gap-3 text-xs text-slate-400">
          Threshold
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="flex-1 accent-amber-400"
          />
          <span className="w-12 text-right font-mono text-slate-200">{threshold.toFixed(2)}</span>
        </label>
        {closest && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="text-slate-500">Precision</p>
              <p className="font-mono text-base text-slate-100">{closest.precision.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-slate-500">Recall</p>
              <p className="font-mono text-base text-slate-100">{closest.recall.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-slate-500">F1</p>
              <p className="font-mono text-base text-slate-100">{closest.f1.toFixed(3)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
