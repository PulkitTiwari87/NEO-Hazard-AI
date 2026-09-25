import { Link } from 'react-router-dom'
import { EXPERIMENTS, MODELS, fmt, modelLabel } from '../lib/research'
import { useExperiments, useReproducibility } from '../lib/useApi'
import {
  CopyButton,
  EmptyResearchState,
  ErrorState,
  LoadingState,
  MonoTag,
  PageHeader,
  ResearchSection,
  ScientificCard,
  StatusBadge,
} from '../components/ui'

function StatusRow({ label, done }: { label: string; done: boolean }) {
  return (
    <li className="flex items-center justify-between border-t border-line py-1.5 text-xs">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{label}</span>
      <span className={done ? 'text-ok' : 'text-faint'}>
        <span aria-hidden="true">{done ? '●' : '○'}</span> <span className="font-mono text-[11px]">{done ? 'generated' : 'not generated'}</span>
      </span>
    </li>
  )
}

export function Experiments() {
  const list = useExperiments()
  const repro = useReproducibility()
  const data = list.data

  return (
    <div>
      <PageHeader
        eyebrow="Research · Experiments"
        title="Experiments"
        description="Every experiment × model combination and whether the real benchmark has produced its artifacts. Results are never ranked or labelled best."
      />

      {list.loading && <LoadingState variant="page" />}
      {list.error && <ErrorState />}

      {data && (
        <>
          {data.status === 'unavailable' && (
            <div className="mb-6">
              <EmptyResearchState title="NO EXPERIMENT HAS BEEN EXECUTED">
                <p>The real benchmark has not produced artifacts against the current NASA dataset.</p>
                <p className="mt-1">Run the experiment to populate this page.</p>
              </EmptyResearchState>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {EXPERIMENTS.map((e) => {
              const exp = data.experiments[e.key]
              if (!exp) return null
              const entries = MODELS.map((m) => [m, exp.models[m]] as const).filter(([, v]) => v)
              const executed = entries.filter(([, v]) => v?.executed)
              const cv = executed.some(([, v]) => v?.cv_f1_mean !== null && v?.cv_f1_mean !== undefined)
              const holdout = executed.some(([, v]) => v?.test_f1 !== null && v?.test_f1 !== undefined)
              return (
                <ScientificCard
                  key={e.key}
                  eyebrow={<span className="inline-flex items-center gap-1">{e.tag}<CopyButton text={e.tag} label={`Copy ${e.tag}`} /></span>}
                  title={`${e.letter} — ${e.title}`}
                  actions={<StatusBadge tone={executed.length ? 'ok' : 'idle'}>{executed.length ? 'Executed' : 'Not executed'}</StatusBadge>}
                >
                  <p className="text-xs leading-relaxed text-muted">{exp.purpose}</p>
                  <dl className="my-4 grid grid-cols-2 gap-4">
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Features</dt>
                      <dd className="font-display text-2xl font-semibold text-ink">{exp.feature_columns.length}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Models executed</dt>
                      <dd className="font-display text-2xl font-semibold text-ink">
                        {executed.length}
                        <span className="text-base text-faint">/{entries.length}</span>
                      </dd>
                    </div>
                  </dl>
                  <ul>
                    <StatusRow label="Cross-validation" done={cv} />
                    <StatusRow label="Holdout" done={holdout} />
                    <StatusRow label="Artifacts" done={executed.length > 0} />
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <MonoTag>
                      Seed {repro.data?.random_seed ?? '—'} · CV: {repro.data?.n_cv_folds ?? '—'}-fold
                    </MonoTag>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {executed.map(([m]) => (
                        <Link key={m} to={`/experiments/${e.key}/${m}`} className="text-accent underline underline-offset-2">
                          {modelLabel(m)} →
                        </Link>
                      ))}
                    </div>
                  </div>
                </ScientificCard>
              )
            })}
          </div>

          <ResearchSection id="results" eyebrow="Results" title="Results by experiment" description="Values are read from each run's artifacts. Em dashes mark runs that have not been executed.">
            <div className="space-y-6">
              {EXPERIMENTS.map((e) => {
                const exp = data.experiments[e.key]
                if (!exp) return null
                return (
                  <div key={e.key} className="overflow-x-auto rounded-panel border border-line bg-surface">
                    <table className="w-full min-w-[40rem] text-left text-xs">
                      <caption className="border-b border-line px-4 py-2 text-left font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                        {e.tag}
                      </caption>
                      <thead className="bg-raised text-muted">
                        <tr>
                          {['Model', 'CV F1 (mean ± std)', 'Test F1', 'Precision', 'Recall', 'ROC-AUC', 'PR-AUC', ''].map((h) => (
                            <th key={h} scope="col" className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.1em]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {MODELS.map((m) => {
                          const r = exp.models[m]
                          if (!r) return null
                          return (
                            <tr key={m} className="border-t border-line">
                              <th scope="row" className="px-3 py-2 font-normal text-ink">{modelLabel(m)}</th>
                              {r.executed ? (
                                <>
                                  <td className="px-3 py-2 font-mono tabular-nums">{fmt(r.cv_f1_mean)} ± {fmt(r.cv_f1_std)}</td>
                                  <td className="px-3 py-2 font-mono tabular-nums">{fmt(r.test_f1)}</td>
                                  <td className="px-3 py-2 font-mono tabular-nums">{fmt(r.test_precision)}</td>
                                  <td className="px-3 py-2 font-mono tabular-nums">{fmt(r.test_recall)}</td>
                                  <td className="px-3 py-2 font-mono tabular-nums">{fmt(r.test_roc_auc)}</td>
                                  <td className="px-3 py-2 font-mono tabular-nums">{fmt(r.test_pr_auc)}</td>
                                  <td className="px-3 py-2">
                                    <Link to={`/experiments/${e.key}/${m}`} className="text-accent underline underline-offset-2">Details →</Link>
                                  </td>
                                </>
                              ) : (
                                <td colSpan={7} className="px-3 py-2 font-mono text-[11px] text-faint">— Not yet executed</td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          </ResearchSection>
        </>
      )}
    </div>
  )
}
