import type { ReactNode } from 'react'

interface ChartCardProps {
  title: string
  description?: string
  note?: string
  actions?: ReactNode
  children: ReactNode
}

// Shared card wrapper for every chart across the research dashboard, so a
// title/description/note/sample-size sits next to every visualization —
// see the "graph integrity" requirement in the project brief.
export function ChartCard({ title, description, note, actions, children }: ChartCardProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
          {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
      {note && <p className="mt-3 text-xs text-slate-500">{note}</p>}
    </div>
  )
}
