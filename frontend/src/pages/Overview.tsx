import { Link } from 'react-router-dom'
import { EXPERIMENTS, MODELS, fmtInt } from '../lib/research'
import { useDataSource, useExperiments, useFeatureAudit, useFeatures, useLimitations, useReproducibility, useStatistics } from '../lib/useApi'
import { OrbitHero } from '../components/OrbitHero'
import { Callout, MetricCard, MetricGrid, MonoTag, ResearchSection, ScientificCard, StatusBadge, type Tone } from '../components/ui'

interface Stage {
  name: string
  detail: string
  state: 'COMPLETE' | 'PENDING' | 'DEFINED' | 'CHECKING'
}

const STAGE_TONE: Record<Stage['state'], Tone> = { COMPLETE: 'ok', PENDING: 'idle', DEFINED: 'info', CHECKING: 'idle' }

export function Overview() {
  const source = useDataSource()
  const stats = useStatistics()
  const experiments = useExperiments()
  const features = useFeatures()
  const audit = useFeatureAudit()
  const repro = useReproducibility()
  const limits = useLimitations()

  let executedRuns = 0
  let totalRuns = 0
  let executedExperiments = 0
  if (experiments.data) {
    for (const e of EXPERIMENTS) {
      const entries = MODELS.map((m) => experiments.data?.experiments[e.key]?.models[m]).filter(Boolean)
      totalRuns += entries.length
      const n = entries.filter((m) => m?.executed).length
      executedRuns += n
      if (n > 0) executedExperiments += 1
    }
  }
  const anyRun = executedRuns > 0
  const expKnown = experiments.data !== null
  const runState = (done: boolean, known: boolean): Stage['state'] => (!known ? 'CHECKING' : done ? 'COMPLETE' : 'PENDING')

  const stages: Stage[] = [
    { name: 'NASA DATA', detail: 'NeoWs browse ingestion', state: runState(Boolean(source.data?.ingestion_has_run), source.data !== null) },
    { name: 'VALIDATION', detail: 'Schema checks · dedupe', state: runState(stats.data?.status === 'ok', stats.data !== null) },
    { name: 'FEATURE AUDIT', detail: 'Label-leakage classification', state: audit.data ? 'DEFINED' : 'CHECKING' },
    { name: 'LEAKAGE-AWARE FEATURES', detail: 'Experiments B · C · D', state: audit.data ? 'DEFINED' : 'CHECKING' },
    { name: '5-FOLD CROSS VALIDATION', detail: 'Training split only', state: runState(anyRun, expKnown) },
    { name: 'MODEL TRAINING', detail: 'Tuned inside each fold', state: runState(anyRun, expKnown) },
    { name: 'HOLDOUT EVALUATION', detail: 'Untouched test set', state: runState(anyRun, expKnown) },
    { name: 'INTERPRETABILITY', detail: 'Importance · SHAP', state: runState(anyRun, expKnown) },
    { name: 'ERROR ANALYSIS', detail: 'FP / FN inspection', state: runState(anyRun, expKnown) },
  ]

  const s = stats.data
  const candidateFeatures = features.data
    ? features.data.nasa_provided_features.length + features.data.categorical_features.length + features.data.derived_features.length
    : null

  return (
    <div>
      <section className="grid items-center gap-8 border-b border-line pb-10 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <MonoTag className="text-accent">NASA / CNEOS · NeoWs · research platform</MonoTag>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.1] text-ink sm:text-5xl">
            Leakage-aware ML analysis of NASA near-Earth objects
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
            AI-assisted analysis of NASA near-Earth object data. The research question: after removing every feature that
            defines, or is derived from, NASA's potentially-hazardous classification, how much predictive signal is left?
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/experiments" className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-void hover:bg-accent/90">
              View experiments
            </Link>
            <Link to="/feature-audit" className="rounded-sm border border-line-strong px-4 py-2 text-sm text-ink hover:bg-white/5">
              Open feature audit
            </Link>
          </div>
        </div>
        <OrbitHero />
      </section>

      <ResearchSection id="summary" eyebrow="Current state · live from the API" title="Research summary">
        <MetricGrid className="sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            label="Dataset"
            value={s?.status === 'ok' ? fmtInt(s.row_count) : null}
            sub={s?.status === 'ok' ? `${fmtInt(s.hazardous_count)} labelled potentially hazardous` : undefined}
          />
          <MetricCard
            label="Experiments"
            value={expKnown && anyRun ? `${executedExperiments}/${EXPERIMENTS.length}` : null}
            sub={anyRun ? 'with at least one executed model' : undefined}
          />
          <MetricCard label="Models" value={expKnown && anyRun ? `${executedRuns}/${totalRuns}` : null} sub={anyRun ? 'experiment × model runs' : undefined} />
          <MetricCard label="Features" value={candidateFeatures} sub="candidate columns before the audit" />
          <MetricCard
            label="Validation"
            value={repro.data ? `${repro.data.n_cv_folds}-fold` : null}
            sub={repro.data ? `${anyRun ? 'Executed' : 'Configured, not yet executed'} · ${repro.data.outer_test_size * 100}% holdout` : undefined}
          />
        </MetricGrid>
      </ResearchSection>

      <ResearchSection id="pipeline" eyebrow="Method" title="Research pipeline" description="Each stage's status is derived from what the backend reports it has produced.">
        <ol className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-3">
          {stages.map((st, i) => (
            <li key={st.name} className="flex items-start gap-3 bg-surface px-4 py-3">
              <span className="mt-0.5 font-mono text-[11px] text-faint">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink">{st.name}</p>
                <p className="mt-0.5 text-xs text-muted">{st.detail}</p>
                <div className="mt-2">
                  <StatusBadge tone={STAGE_TONE[st.state]}>{st.state}</StatusBadge>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </ResearchSection>

      <ResearchSection id="scope" eyebrow="Scope" title="What this project is — and is not">
        <div className="grid gap-4 lg:grid-cols-2">
          <Callout tone="warn" title="Scope statement">
            {limits.data?.summary ??
              'A research and educational ML project. It does not predict asteroid impacts and does not replace NASA/JPL/CNEOS assessments.'}{' '}
            <Link to="/limitations" className="text-accent underline underline-offset-2">Read the limitations</Link>.
          </Callout>
          <ScientificCard eyebrow="Research focus" title="Why the original result is not the finding">
            <p className="text-sm leading-relaxed text-muted">
              NASA's flag is essentially a threshold rule over <code className="font-mono text-ink">moid_au</code> and{' '}
              <code className="font-mono text-ink">absolute_magnitude_h</code>. A model given those fields recovers the rule.
              The leakage-aware experiments remove them, and everything derived from them, to measure what remains.
            </p>
          </ScientificCard>
        </div>
      </ResearchSection>
    </div>
  )
}
