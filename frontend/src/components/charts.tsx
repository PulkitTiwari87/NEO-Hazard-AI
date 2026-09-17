import { Fragment } from 'react'

// Minimal, dependency-free SVG charts. Every point plotted here comes
// straight from a backend response (real ROC/PR curve coordinates, real
// confusion-matrix counts, real threshold-sweep rows) — none of it is
// approximated or hand-drawn. See docs/FEATURE_AUDIT.md and
// backend/main.py::experiment_model_detail for where the numbers
// originate.

const WIDTH = 320
const HEIGHT = 240
const PAD = 34

function scale(value: number, min: number, max: number, outMin: number, outMax: number) {
  if (max === min) return (outMin + outMax) / 2
  return outMin + ((value - min) / (max - min)) * (outMax - outMin)
}

function AxisFrame({ xLabel, yLabel }: { xLabel: string; yLabel: string }) {
  return (
    <>
      <line x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - 10} y2={HEIGHT - PAD} stroke="currentColor" className="text-white/20" />
      <line x1={PAD} y1={10} x2={PAD} y2={HEIGHT - PAD} stroke="currentColor" className="text-white/20" />
      <text x={(WIDTH + PAD) / 2} y={HEIGHT - 6} textAnchor="middle" className="fill-slate-500 text-[10px]">
        {xLabel}
      </text>
      <text
        x={-(HEIGHT / 2)}
        y={12}
        transform="rotate(-90)"
        textAnchor="middle"
        className="fill-slate-500 text-[10px]"
      >
        {yLabel}
      </text>
    </>
  )
}

export function RocCurveChart({ fpr, tpr, aucLabel }: { fpr: number[]; tpr: number[]; aucLabel?: string }) {
  if (!fpr?.length) return <p className="text-xs text-slate-500">No ROC curve data.</p>
  const points = fpr.map((f, i) => {
    const x = scale(f, 0, 1, PAD, WIDTH - 10)
    const y = scale(tpr[i], 0, 1, HEIGHT - PAD, 10)
    return `${x},${y}`
  })
  const diagStart = `${scale(0, 0, 1, PAD, WIDTH - 10)},${scale(0, 0, 1, HEIGHT - PAD, 10)}`
  const diagEnd = `${scale(1, 0, 1, PAD, WIDTH - 10)},${scale(1, 0, 1, HEIGHT - PAD, 10)}`
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full max-w-sm text-slate-400">
      <AxisFrame xLabel="False positive rate" yLabel="True positive rate" />
      <line x1={diagStart.split(',')[0]} y1={diagStart.split(',')[1]} x2={diagEnd.split(',')[0]} y2={diagEnd.split(',')[1]} className="stroke-white/15" strokeDasharray="4 4" />
      <polyline points={points.join(' ')} fill="none" className="stroke-sky-400" strokeWidth={2} />
      {aucLabel && (
        <text x={WIDTH - 14} y={22} textAnchor="end" className="fill-sky-300 text-[10px] font-mono">
          {aucLabel}
        </text>
      )}
    </svg>
  )
}

export function PrCurveChart({ precision, recall, apLabel }: { precision: number[]; recall: number[]; apLabel?: string }) {
  if (!precision?.length) return <p className="text-xs text-slate-500">No PR curve data.</p>
  const points = recall.map((r, i) => {
    const x = scale(r, 0, 1, PAD, WIDTH - 10)
    const y = scale(precision[i], 0, 1, HEIGHT - PAD, 10)
    return `${x},${y}`
  })
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full max-w-sm text-slate-400">
      <AxisFrame xLabel="Recall" yLabel="Precision" />
      <polyline points={points.join(' ')} fill="none" className="stroke-emerald-400" strokeWidth={2} />
      {apLabel && (
        <text x={WIDTH - 14} y={22} textAnchor="end" className="fill-emerald-300 text-[10px] font-mono">
          {apLabel}
        </text>
      )}
    </svg>
  )
}

export function ThresholdChart({
  rows,
}: {
  rows: { threshold: number; precision: number; recall: number; f1: number }[]
}) {
  if (!rows?.length) return <p className="text-xs text-slate-500">No threshold-sweep data.</p>
  const series: { key: 'precision' | 'recall' | 'f1'; color: string }[] = [
    { key: 'precision', color: 'stroke-sky-400' },
    { key: 'recall', color: 'stroke-amber-400' },
    { key: 'f1', color: 'stroke-emerald-400' },
  ]
  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full max-w-sm text-slate-400">
        <AxisFrame xLabel="Decision threshold" yLabel="Score" />
        {series.map(({ key, color }) => {
          const points = rows.map((row) => {
            const x = scale(row.threshold, 0, 1, PAD, WIDTH - 10)
            const y = scale(row[key], 0, 1, HEIGHT - PAD, 10)
            return `${x},${y}`
          })
          return <polyline key={key} points={points.join(' ')} fill="none" className={color} strokeWidth={2} />
        })}
      </svg>
      <div className="flex gap-4 text-[11px] text-slate-400">
        <span className="text-sky-400">— precision</span>
        <span className="text-amber-400">— recall</span>
        <span className="text-emerald-400">— f1</span>
      </div>
    </div>
  )
}

export function ConfusionMatrixGrid({
  matrix,
  labels,
}: {
  matrix: number[][]
  labels: string[]
}) {
  if (!matrix?.length) return <p className="text-xs text-slate-500">No confusion matrix data.</p>
  const max = Math.max(...matrix.flat())
  return (
    <div className="inline-block">
      <div className="grid grid-cols-[auto_1fr_1fr] gap-1 text-xs">
        <div />
        <div className="px-2 py-1 text-center text-slate-500">Pred: {labels[0]}</div>
        <div className="px-2 py-1 text-center text-slate-500">Pred: {labels[1]}</div>
        {matrix.map((row, i) => (
          <Fragment key={`row-${i}`}>
            <div className="flex items-center px-2 text-slate-500">Actual: {labels[i]}</div>
            {row.map((value, j) => {
              const intensity = max > 0 ? value / max : 0
              return (
                <div
                  key={`${i}-${j}`}
                  className="flex h-16 w-24 items-center justify-center rounded-md border border-white/10 font-mono text-lg text-slate-100"
                  style={{ backgroundColor: `rgba(56, 189, 248, ${0.08 + intensity * 0.35})` }}
                >
                  {value}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

export function CvFoldBars({ folds, metricKey = 'f1' }: { folds: Record<string, unknown>[]; metricKey?: string }) {
  if (!folds?.length) return <p className="text-xs text-slate-500">No fold-level data.</p>
  return (
    <div className="flex items-end gap-2">
      {folds.map((fold) => {
        const value = Number(fold[metricKey] ?? 0)
        return (
          <div key={String(fold.fold)} className="flex flex-col items-center gap-1">
            <div
              className="w-8 rounded-t bg-sky-500/60"
              style={{ height: `${Math.max(4, value * 100)}px` }}
              title={`Fold ${fold.fold}: ${value.toFixed(3)}`}
            />
            <span className="text-[10px] text-slate-500">F{String(fold.fold)}</span>
          </div>
        )
      })}
    </div>
  )
}
