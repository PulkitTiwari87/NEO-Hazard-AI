import { Fragment, useState } from 'react'

interface CorrelationMatrixProps {
  features: string[]
  matrix: (number | null)[][]
}

function cellColor(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '#1a1a19'
  // Diverging scale: negative -> blue (#3987e5), positive -> orange (#d95926), 0 -> neutral.
  const t = Math.min(1, Math.abs(value))
  const hue = value >= 0 ? '#d95926' : '#3987e5'
  return `color-mix(in oklab, ${hue} ${Math.round(t * 85)}%, #14141a)`
}

// Pearson (or Spearman) correlation matrix over numeric features. Correlation
// does not establish causation — see the caller's page-level note.
export function CorrelationMatrix({ features, matrix }: CorrelationMatrixProps) {
  const [hovered, setHovered] = useState<{ row: string; col: string; value: number | null } | null>(null)
  const cellSize = features.length > 14 ? 22 : 28

  return (
    <div>
      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-[1px]"
          style={{ gridTemplateColumns: `120px repeat(${features.length}, ${cellSize}px)` }}
        >
          <div />
          {features.map((f) => (
            <div
              key={f}
              className="flex items-end justify-center overflow-visible text-[9px] text-slate-500"
              style={{ height: 90, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              title={f}
            >
              {f}
            </div>
          ))}
          {matrix.map((row, i) => (
            <Fragment key={features[i]}>
              <div className="flex items-center truncate pr-2 text-right text-[10px] text-slate-500">
                {features[i]}
              </div>
              {row.map((value, j) => (
                <div
                  key={`${features[i]}-${features[j]}`}
                  className="cursor-default"
                  style={{ width: cellSize, height: cellSize, backgroundColor: cellColor(value) }}
                  onMouseEnter={() => setHovered({ row: features[i], col: features[j], value })}
                  onMouseLeave={() => setHovered(null)}
                />
              ))}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          {hovered
            ? `${hovered.row} × ${hovered.col}: ${hovered.value != null ? hovered.value.toFixed(3) : 'n/a'}`
            : 'Hover a cell for the exact coefficient.'}
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: cellColor(-1) }} /> -1
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: cellColor(0) }} /> 0
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: cellColor(1) }} /> +1
        </span>
      </div>
    </div>
  )
}
