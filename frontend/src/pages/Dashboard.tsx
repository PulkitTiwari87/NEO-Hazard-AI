import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { EXPERIMENTS, MODELS, fmtDate, fmtInt, modelLabel } from '../lib/research'
import {
  useApi,
  useDataSource,
  useExperiments,
  useHealth,
  useReproducibility,
  useStatistics,
} from '../lib/useApi'
import { MetricCard, MetricGrid, PageHeader, ResearchSection, ScientificCard, StatusBadge, type Tone } from '../components/ui'

interface Check {
  label: string
  tone: Tone
  text: string
  detail?: string
}

export function Dashboard() {
  const health = useHealth()
  const source = useDataSource()
  const stats = useStatistics()
  const experiments = useExperiments()
  const repro = useReproducibility()
  const models = useApi('models', api.models)

  const checks: Check[] = useMemo(() => {
    const list: Check[] = []
    list.push(
      health.loading
        ? { label: 'Backend API', tone: 'idle', text: 'CHECKING' }
        : health.data?.status === 'ok'
          ? { label: 'Backend API', tone: 'ok', text: 'CONNECTED' }
          : { label: 'Backend API', tone: 'danger', text: 'UNREACHABLE' },
    )
    list.push({
      label: 'NASA data ingestion',
      tone: source.data?.ingestion_has_run ? 'ok' : 'idle',
      text: source.data ? (source.data.ingestion_has_run ? 'RAW DATA PRESENT' : 'NOT INGESTED') : '…',
      detail: source.data?.raw_files_present.join(', '),
    })
    list.push({
      label: 'Validated dataset',
      tone: stats.data?.status === 'ok' ? 'ok' : 'idle',
      text: stats.data ? (stats.data.status === 'ok' ? `${fmtInt(stats.data.row_count)} ROWS` : 'NOT VALIDATED') : '…',
    })
    list.push({
      label: 'Legacy baseline models',
      tone: models.data?.status === 'ok' ? 'ok' : 'idle',
      text: models.data ? (models.data.status === 'ok' ? `${models.data.models.length} REGISTERED` : 'NONE TRAINED') : '…',
    })
    const runAt = repro.data?.last_benchmark_run?.run_at_utc
    list.push({
      label: 'Research benchmark',
      tone: runAt ? 'ok' : 'idle',
      text: runAt ? `RUN ${fmtDate(runAt)}` : 'NO RUN RECORDED',
    })
    return list
  }, [health, source, stats, models, repro])

  const list = experiments.data

  return (
    <div>
      <PageHeader
        eyebrow="Overview · Project dashboard"
        title="Project dashboard"
        description="Operational status of the research pipeline. Every indicator is read from the backend; nothing here is a cached or hardcoded result."
      />

      <ResearchSection id="components" eyebrow="Pipeline components" title="System status">
        <ul className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((c) => (
            <li key={c.label} className="bg-surface px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{c.label}</p>
              <div className="mt-1.5">
                <StatusBadge tone={c.tone}>{c.text}</StatusBadge>
              </div>
              {c.detail && <p className="mt-2 truncate font-mono text-[11px] text-muted" title={c.detail}>{c.detail}</p>}
            </li>
          ))}
        </ul>
      </ResearchSection>

      <ResearchSection
        id="matrix"
        eyebrow="Experiment × model"
        title="Execution matrix"
        description="● executed · ○ not executed. Open an executed cell to inspect its artifacts."
      >
        {list ? (
          <ScientificCard bodyClassName="overflow-x-auto p-0">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <caption className="sr-only">Which experiment and model combinations have been executed</caption>
              <thead className="text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.1em]">Experiment</th>
                  {MODELS.map((m) => (
                    <th key={m} scope="col" className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.1em]">{modelLabel(m)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EXPERIMENTS.map((e) => (
                  <tr key={e.key} className="border-t border-line">
                    <th scope="row" className="px-4 py-2 font-mono font-normal text-ink">{e.tag}</th>
                    {MODELS.map((m) => {
                      const done = Boolean(list.experiments[e.key]?.models[m]?.executed)
                      return (
                        <td key={m} className="px-4 py-2">
                          {done ? (
                            <Link to={`/experiments/${e.key}/${m}`} className="text-ok hover:underline">
                              <span aria-hidden="true">●</span> <span className="font-mono text-[11px]">Executed</span>
                            </Link>
                          ) : (
                            <span className="text-faint">
                              <span aria-hidden="true">○</span> <span className="font-mono text-[11px]">Not executed</span>
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScientificCard>
        ) : (
          <p className="text-sm text-muted">Loading execution status…</p>
        )}
      </ResearchSection>

      <ResearchSection id="config" eyebrow="Configuration" title="Benchmark configuration">
        <MetricGrid>
          <MetricCard label="Random seed" value={repro.data?.random_seed ?? null} sub="Fixed for all splits" />
          <MetricCard label="CV folds" value={repro.data?.n_cv_folds ?? null} sub="Stratified, training split" />
          <MetricCard label="Holdout" value={repro.data ? `${repro.data.outer_test_size * 100}%` : null} sub="Untouched test set" />
          <MetricCard label="Feature sets" value={repro.data?.feature_sets.length ?? null} sub="Experiments A–D" />
        </MetricGrid>
      </ResearchSection>
    </div>
  )
}
