import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { EXPERIMENTS, MODELS, fmtDate } from '../lib/research'
import { NAV_GROUPS } from '../lib/nav'
import { useDataSource, useExperiments, useHealth, useReproducibility } from '../lib/useApi'
import { StatusBadge, type Tone } from './ui'

interface Status {
  tone: Tone
  text: string
}

/** Every status is derived from a live API response — none is hardcoded. */
function useSystemStatus(): Status[] {
  const health = useHealth()
  const source = useDataSource()
  const experiments = useExperiments()
  const repro = useReproducibility()

  const api: Status = health.loading
    ? { tone: 'idle', text: 'API CHECKING' }
    : health.error || health.data?.status !== 'ok'
      ? { tone: 'danger', text: 'API UNREACHABLE' }
      : { tone: 'ok', text: 'API CONNECTED' }

  const data: Status = source.loading
    ? { tone: 'idle', text: 'DATA …' }
    : source.data?.ingestion_has_run
      ? { tone: 'ok', text: 'NASA DATA INGESTED' }
      : { tone: 'idle', text: 'DATA NOT INGESTED' }

  let executed = 0
  let total = 0
  if (experiments.data?.status === 'ok' || experiments.data?.status === 'unavailable') {
    for (const e of EXPERIMENTS) {
      for (const m of MODELS) {
        const entry = experiments.data.experiments[e.key]?.models[m]
        if (entry) {
          total += 1
          if (entry.executed) executed += 1
        }
      }
    }
  }
  const results: Status = experiments.loading
    ? { tone: 'idle', text: 'RESULTS …' }
    : executed > 0
      ? { tone: 'ok', text: `RESULTS ${executed}/${total} RUNS` }
      : { tone: 'idle', text: 'RESULTS NOT GENERATED' }

  const runAt = repro.data?.last_benchmark_run?.run_at_utc
  const last: Status = repro.loading
    ? { tone: 'idle', text: 'LAST RUN …' }
    : runAt
      ? { tone: 'info', text: `LAST RUN ${fmtDate(runAt)}` }
      : { tone: 'idle', text: 'NO RUN RECORDED' }

  return [api, data, results, last]
}

function StatusCluster({ className = '' }: { className?: string }) {
  const statuses = useSystemStatus()
  return (
    <ul aria-label="System status" className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {statuses.map((s) => (
        <li key={s.text}>
          <StatusBadge tone={s.tone}>{s.text}</StatusBadge>
        </li>
      ))}
    </ul>
  )
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary" className="space-y-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">{group.label}</p>
          <ul>
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `block border-l-2 px-3 py-1.5 text-[13px] transition-colors ${
                      isActive
                        ? 'border-accent bg-accent-soft font-medium text-ink'
                        : 'border-transparent text-muted hover:border-line-strong hover:bg-white/[0.03] hover:text-ink'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    drawerRef.current?.querySelector<HTMLElement>('a')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="min-h-screen bg-void text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-sm focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-void"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-void/90 backdrop-blur">
        <div className="flex min-h-12 items-center gap-3 px-4 py-2">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-line text-muted hover:text-ink lg:hidden"
            aria-label="Open navigation"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <span aria-hidden="true">☰</span>
          </button>
          <Link to="/" className="flex shrink-0 items-baseline gap-2">
            <span className="font-display text-sm font-semibold tracking-tight text-ink">NEO-HAZARD-AI</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-faint sm:inline">NASA / CNEOS DATA</span>
          </Link>
          <StatusCluster className="ml-auto hidden md:flex" />
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[16rem_1fr]">
        <aside className="sticky top-12 hidden h-[calc(100vh-3rem)] overflow-y-auto border-r border-line bg-surface/60 py-5 lg:block">
          <NavList />
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
            <div ref={drawerRef} className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-line bg-surface py-5">
              <div className="mb-5 px-3">
                <StatusCluster />
              </div>
              <NavList onNavigate={() => setOpen(false)} />
            </div>
          </div>
        )}

        <main id="main" tabIndex={-1} className="min-w-0 px-4 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
