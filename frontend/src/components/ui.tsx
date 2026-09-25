import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

// Shared building blocks for the research UI. Presentation only — every
// value shown is passed in from a backend response, never defined here.

// Card titles are h2 by default and h3 inside a ResearchSection (which owns an
// h2), so the heading outline never skips a level.
const HeadingLevel = createContext<2 | 3>(2)

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'idle'

const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
  info: 'text-accent',
  idle: 'text-muted',
}

// Shape + text carry the status as well as color (WCAG 1.4.1).
const TONE_GLYPH: Record<Tone, string> = { ok: '●', warn: '▲', danger: '✕', info: '●', idle: '○' }

export function MonoTag({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-mono text-[11px] uppercase tracking-[0.08em] text-muted ${className}`}>{children}</span>
  )
}

export function StatusBadge({ tone = 'idle', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border border-line px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] ${TONE_TEXT[tone]}`}
    >
      <span aria-hidden="true" className="text-[9px] leading-none">
        {TONE_GLYPH[tone]}
      </span>
      {children}
    </span>
  )
}

export function ScientificCard({
  title,
  eyebrow,
  actions,
  children,
  className = '',
  bodyClassName = 'p-4',
}: {
  title?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  const Heading = useContext(HeadingLevel) === 2 ? 'h2' : 'h3'
  return (
    // min-w-0: cards are grid items, and a long unbroken title would otherwise set the track width.
    <section className={`min-w-0 rounded-panel border border-line bg-surface shadow-panel ${className}`}>
      {(title || eyebrow || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <div className="min-w-0">
            {eyebrow && <MonoTag className="block">{eyebrow}</MonoTag>}
            {title && <Heading className="truncate font-display text-sm font-semibold text-ink">{title}</Heading>}
          </div>
          {actions}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

export function MetricCard({
  label,
  value,
  sub,
  tone = 'idle',
}: {
  label: string
  value: string | number | null | undefined
  sub?: ReactNode
  tone?: Tone
}) {
  const has = value !== null && value !== undefined && value !== '—'
  return (
    <div className="min-w-0 rounded-panel border border-line bg-surface px-4 py-3 shadow-panel">
      <MonoTag className="block">{label}</MonoTag>
      <p className={`mt-1.5 font-display text-3xl font-semibold tracking-tight ${has ? 'text-ink' : 'text-faint'}`}>
        {has ? value : '—'}
      </p>
      <p className={`mt-1 text-xs ${has ? TONE_TEXT[tone] : 'text-faint'}`}>{has ? sub : (sub ?? 'Not yet executed')}</p>
    </div>
  )
}

export function MetricGrid({ children, className = 'sm:grid-cols-2 lg:grid-cols-4' }: { children: ReactNode; className?: string }) {
  return <div className={`grid gap-3 ${className}`}>{children}</div>
}

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  meta?: { label: string; value: ReactNode; copy?: string }[]
  actions?: ReactNode
}) {
  return (
    <header className="mb-8 border-b border-line pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && <MonoTag className="block text-accent">{eyebrow}</MonoTag>}
          <h1 className="mt-1 font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">{title}</h1>
          {description && <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {meta && meta.length > 0 && (
        <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
          {meta.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{item.label}</dt>
              <dd className="mt-0.5 flex items-center gap-1 truncate font-mono text-xs text-ink">
                <span className="truncate">{item.value}</span>
                {item.copy && <CopyButton text={item.copy} label={`Copy ${item.label}`} />}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  )
}

export function ResearchSection({
  id,
  title,
  eyebrow,
  description,
  children,
}: {
  id?: string
  title: string
  eyebrow?: ReactNode
  description?: ReactNode
  children: ReactNode
}) {
  const headingId = id ? `${id}-heading` : undefined
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-20 py-6">
      <div className="mb-4">
        {eyebrow && <MonoTag className="block">{eyebrow}</MonoTag>}
        <h2 id={headingId} className="font-display text-xl font-semibold text-ink">
          {title}
        </h2>
        {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      <HeadingLevel.Provider value={3}>{children}</HeadingLevel.Provider>
    </section>
  )
}

export function ChartContainer({
  title,
  eyebrow,
  note,
  legend,
  children,
  className = '',
}: {
  title: string
  eyebrow?: ReactNode
  note?: ReactNode
  legend?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <ScientificCard title={title} eyebrow={eyebrow} actions={legend} className={className}>
      {children}
      {note && <p className="mt-3 text-xs leading-relaxed text-muted">{note}</p>}
    </ScientificCard>
  )
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard can be unavailable (insecure context / denied) — fail quietly.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={label}
      className="inline-flex h-6 shrink-0 items-center rounded-sm px-1.5 font-mono text-[10px] uppercase tracking-wider text-faint transition-colors hover:bg-white/5 hover:text-ink"
    >
      {copied ? 'Copied' : 'Copy'}
      {/* Rendered only while "Copied" shows, so tables of copy buttons don't add hundreds of empty live regions. */}
      {copied && (
        <span className="sr-only" role="status">
          Copied to clipboard
        </span>
      )}
    </button>
  )
}

/** Monospace command block with a copy button. Display only — nothing is executed. */
export function CodeBlock({ lines, label }: { lines: string[]; label: string }) {
  return (
    <figure className="overflow-hidden rounded-panel border border-line bg-void">
      <figcaption className="flex items-center justify-between border-b border-line bg-surface px-3 py-1.5">
        <MonoTag>{label}</MonoTag>
        <CopyButton text={lines.join('\n')} label={`Copy ${label}`} />
      </figcaption>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-ink">
        {lines.map((l) => (
          <div key={l}>
            <span aria-hidden="true" className="select-none text-faint">$ </span>
            {l}
          </div>
        ))}
      </pre>
    </figure>
  )
}

export function KeyValueList({
  items,
  columns = 'sm:grid-cols-2',
}: {
  items: { label: string; value: ReactNode; copy?: string }[]
  columns?: string
}) {
  return (
    <dl className={`grid gap-x-8 gap-y-4 ${columns}`}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0 border-b border-line pb-3">
          <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{item.label}</dt>
          <dd className="mt-1 flex items-start gap-1 break-words font-mono text-xs text-ink">
            <span className="min-w-0 break-words">{item.value}</span>
            {item.copy && <CopyButton text={item.copy} label={`Copy ${item.label}`} />}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function Callout({
  tone = 'warn',
  title,
  children,
}: {
  tone?: Tone
  title?: string
  children: ReactNode
}) {
  const border: Record<Tone, string> = {
    ok: 'border-ok/40 bg-ok-soft',
    warn: 'border-warn/40 bg-warn-soft',
    danger: 'border-danger/40 bg-danger-soft',
    info: 'border-accent/40 bg-accent-soft',
    idle: 'border-line bg-white/[0.02]',
  }
  return (
    <aside className={`flex min-w-0 gap-3 rounded-panel border px-4 py-3 text-sm ${border[tone]}`}>
      <span aria-hidden="true" className={`mt-0.5 font-mono text-xs ${TONE_TEXT[tone]}`}>
        {TONE_GLYPH[tone]}
      </span>
      <div className="min-w-0 leading-relaxed text-ink/90">
        {title && <p className={`mb-0.5 font-mono text-[11px] uppercase tracking-[0.08em] ${TONE_TEXT[tone]}`}>{title}</p>}
        {children}
      </div>
    </aside>
  )
}

/** Thin dashed orbit motif reused by the empty state. */
function OrbitGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" className={className} aria-hidden="true" fill="none">
      <ellipse cx="60" cy="30" rx="54" ry="20" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" opacity="0.5" />
      <ellipse cx="60" cy="30" rx="34" ry="12" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" opacity="0.35" />
      <circle cx="60" cy="30" r="3" fill="currentColor" opacity="0.7" />
    </svg>
  )
}

export function EmptyResearchState({
  title = 'RESULTS NOT AVAILABLE',
  children,
  meta,
  compact = false,
}: {
  title?: string
  children?: ReactNode
  meta?: { label: string; value: string }[]
  compact?: boolean
}) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center rounded-panel border border-dashed border-line-strong bg-surface text-center ${compact ? 'px-4 py-8' : 'px-6 py-14'}`}
    >
      <OrbitGlyph className="mb-4 h-10 w-20 text-accent" />
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">{title}</p>
      <div className="mt-3 max-w-md text-sm leading-relaxed text-muted">
        {children ?? (
          <>
            <p>This analysis has not been executed against the current NASA dataset.</p>
            <p className="mt-1">Run the experiment to populate it.</p>
          </>
        )}
      </div>
      {meta && meta.length > 0 && (
        <dl className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {meta.map((m) => (
            <div key={m.label}>
              <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{m.label}</dt>
              <dd className="font-mono text-xs text-ink">{m.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

export function ErrorState({
  title = 'DATA SOURCE UNAVAILABLE',
  children,
}: {
  title?: string
  children?: ReactNode
}) {
  return (
    <div role="alert" className="rounded-panel border border-danger/40 border-l-[3px] bg-danger-soft px-5 py-4">
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-danger">{title}</p>
      <div className="mt-2 max-w-xl text-sm leading-relaxed text-ink/90">
        {children ?? (
          <>
            <p>The research API could not be reached.</p>
            <p className="mt-1 text-muted">No synthetic or placeholder research results are displayed.</p>
          </>
        )}
      </div>
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-sm ${className}`} />
}

export function LoadingState({ variant = 'page' }: { variant?: 'page' | 'chart' | 'table' | 'metrics' }) {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <span className="sr-only">Loading research data</span>
      {variant === 'page' && (
        <>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </>
      )}
      {(variant === 'page' || variant === 'metrics') && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}
      {(variant === 'page' || variant === 'chart') && <Skeleton className="h-64 w-full" />}
      {variant === 'table' && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      )}
    </div>
  )
}
