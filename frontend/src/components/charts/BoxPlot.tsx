interface BoxPlotGroup {
  label: string
  values: number[]
  color: string
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base]
}

function summarize(values: number[]) {
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  return {
    min: sorted[0],
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1],
    n: sorted.length,
  }
}

// Box plot (min / Q1 / median / Q3 / max) per group, computed from real
// per-record values — no synthetic distribution is drawn.
export function BoxPlot({ groups, unit }: { groups: BoxPlotGroup[]; unit?: string }) {
  const summaries = groups.map((g) => ({ ...g, stats: summarize(g.values) })).filter((g) => g.stats !== null)
  if (summaries.length === 0) return <p className="text-sm text-slate-500">No values to summarize.</p>

  const globalMin = Math.min(...summaries.map((g) => g.stats!.min))
  const globalMax = Math.max(...summaries.map((g) => g.stats!.max))
  const span = globalMax - globalMin || 1
  const toPct = (v: number) => ((v - globalMin) / span) * 100

  return (
    <div className="space-y-4">
      {summaries.map((g) => {
        const s = g.stats!
        return (
          <div key={g.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span style={{ color: g.color }} className="font-medium">
                {g.label}
              </span>
              <span className="text-slate-500">n = {s.n}</span>
            </div>
            <div className="relative h-6 w-full rounded bg-white/[0.03]">
              {/* whisker */}
              <div
                className="absolute top-1/2 h-px -translate-y-1/2"
                style={{ left: `${toPct(s.min)}%`, width: `${toPct(s.max) - toPct(s.min)}%`, backgroundColor: g.color, opacity: 0.5 }}
              />
              {/* box (Q1-Q3) */}
              <div
                className="absolute top-1/2 h-4 -translate-y-1/2 rounded"
                style={{
                  left: `${toPct(s.q1)}%`,
                  width: `${Math.max(0.5, toPct(s.q3) - toPct(s.q1))}%`,
                  backgroundColor: `color-mix(in oklab, ${g.color} 45%, transparent)`,
                  border: `1px solid ${g.color}`,
                }}
              />
              {/* median */}
              <div
                className="absolute top-1/2 h-4 w-[2px] -translate-y-1/2"
                style={{ left: `${toPct(s.median)}%`, backgroundColor: g.color }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-600">
              <span>min {s.min.toPrecision(3)}</span>
              <span>Q1 {s.q1.toPrecision(3)}</span>
              <span>median {s.median.toPrecision(3)}</span>
              <span>Q3 {s.q3.toPrecision(3)}</span>
              <span>max {s.max.toPrecision(3)}</span>
            </div>
          </div>
        )
      })}
      {unit && <p className="text-[10px] text-slate-600">unit: {unit}</p>}
    </div>
  )
}
