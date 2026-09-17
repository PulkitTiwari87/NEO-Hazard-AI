interface MethodologyPanelProps {
  title?: string
  items: { label: string; value: string | number | null | undefined }[]
  defaultOpen?: boolean
}

// Collapsible methodology inspector — every model-results screen should let
// a researcher see exactly what produced the metrics above it (dataset,
// feature set, split/CV strategy, seed, hyperparameters, timestamps) so a
// number is never shown without its context.
export function MethodologyPanel({ title = 'Methodology', items, defaultOpen = false }: MethodologyPanelProps) {
  return (
    <details className="rounded-lg border border-white/10 bg-white/[0.02]" open={defaultOpen}>
      <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </summary>
      <div className="grid gap-x-6 gap-y-2 border-t border-white/5 px-4 py-3 text-xs sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between gap-3">
            <span className="text-slate-500">{item.label}</span>
            <span className="text-right font-mono text-slate-300">{item.value ?? 'n/a'}</span>
          </div>
        ))}
      </div>
    </details>
  )
}
