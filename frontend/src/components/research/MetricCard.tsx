interface MetricCardProps {
  label: string
  value: number | string | null | undefined
  std?: number | null
  format?: (value: number) => string
  description?: string
}

const defaultFormat = (v: number) => v.toFixed(3)

// A single metric with an explicit "mean ± std" form when a std is given
// (cross-validation), and a one-line plain-language description so a metric
// is never shown without context — see the scientific-interpretation
// requirement in the project brief.
export function MetricCard({ label, value, std, format = defaultFormat, description }: MetricCardProps) {
  const display = typeof value === 'number' ? format(value) : (value ?? 'Result not available')
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold text-slate-100">
        {display}
        {std != null && typeof value === 'number' && <span className="ml-1 text-sm text-slate-500">± {format(std)}</span>}
      </p>
      {description && <p className="mt-1 text-[11px] leading-snug text-slate-500">{description}</p>}
    </div>
  )
}
