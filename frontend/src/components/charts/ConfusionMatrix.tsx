import { Fragment } from 'react'

interface ConfusionMatrixProps {
  matrix: [[number, number], [number, number]]
  labels: [string, string]
  color?: string
}

// Rows = actual, columns = predicted, matching sklearn.metrics.confusion_matrix
// with labels=[False, True]. Real TN/FP/FN/TP counts only — never a
// placeholder matrix.
export function ConfusionMatrix({ matrix, labels, color = '#3987e5' }: ConfusionMatrixProps) {
  const max = Math.max(...matrix.flat())
  const cellStyle = (value: number) => {
    const t = max > 0 ? value / max : 0
    return { backgroundColor: `color-mix(in oklab, ${color} ${Math.round(t * 75)}%, #1a1a19)` }
  }
  return (
    <div>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-1 text-center text-xs">
        <div />
        <div className="truncate px-1 py-1 text-slate-500">pred: {labels[0]}</div>
        <div className="truncate px-1 py-1 text-slate-500">pred: {labels[1]}</div>
        {matrix.map((row, i) => (
          <Fragment key={i}>
            <div className="flex items-center justify-end px-1 text-slate-500">true: {labels[i]}</div>
            {row.map((value, j) => (
              <div
                key={j}
                className="flex items-center justify-center rounded py-4 font-mono text-base text-slate-50"
                style={cellStyle(value)}
              >
                {value}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-slate-600">
        rows = actual, columns = predicted · TN={matrix[0][0]} FP={matrix[0][1]} FN={matrix[1][0]} TP={matrix[1][1]}
      </p>
    </div>
  )
}
