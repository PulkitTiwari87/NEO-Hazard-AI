import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { experimentMeta, fmt, fmtInt, fmtUtc, metaStrip, modelLabel, str } from '../lib/research'
import { useFeatureAudit, useExperimentDetail, useReproducibility } from '../lib/useApi'
import { ModelSelector } from '../components/Selectors'
import { FeatureBadge } from '../components/FeatureAuditMatrix'
import {
  CalibrationPanel,
  ConfusionPanel,
  ErrorPanel,
  FoldPanel,
  ImportancePanel,
  ModelResultsPanel,
  PrPanel,
  RocPanel,
  ShapPanel,
  ThresholdPanel,
} from '../components/panels'
import {
  CodeBlock,
  EmptyResearchState,
  ErrorState,
  KeyValueList,
  LoadingState,
  MetricCard,
  MetricGrid,
  MonoTag,
  PageHeader,
  ResearchSection,
  ScientificCard,
  Skeleton,
} from '../components/ui'

const SECTIONS = [
  ['overview', 'Overview'],
  ['feature-set', 'Feature set'],
  ['cross-validation', 'Cross validation'],
  ['model-results', 'Model results'],
  ['roc', 'ROC'],
  ['precision-recall', 'Precision–recall'],
  ['threshold', 'Threshold analysis'],
  ['calibration', 'Calibration'],
  ['importance', 'Feature importance'],
  ['shap', 'SHAP'],
  ['errors', 'Error analysis'],
  ['reproducibility', 'Reproducibility'],
] as const

/** Mounts its children the first time it nears the viewport — keeps a 12-section page light. */
function Deferred({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  // Without IntersectionObserver there is nothing to defer on — render immediately.
  const [show, setShow] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || show) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShow(true)
          io.disconnect()
        }
      },
      { rootMargin: '500px' },
    )
    io.observe(el)
    // Backstop: observers don't fire in background tabs or print views, and a
    // section that can never mount is worse than one that mounts a little early.
    const fallback = window.setTimeout(() => setShow(true), 2500)
    return () => {
      io.disconnect()
      window.clearTimeout(fallback)
    }
  }, [show])
  return <div ref={ref}>{show ? children : <Skeleton className="h-72 w-full" />}</div>
}

const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])

export function ExperimentDetail() {
  const { experiment = '', model = '' } = useParams()
  const navigate = useNavigate()
  const { data, error, loading } = useExperimentDetail(experiment, model)
  const audit = useFeatureAudit().data
  const repro = useReproducibility().data
  const meta = experimentMeta(experiment)

  const category = (f: string): 'A' | 'B' | 'F' | undefined =>
    audit?.label_defining_features.includes(f)
      ? 'A'
      : audit?.label_derived_features.includes(f)
        ? 'B'
        : audit?.epoch_dependent_excluded_features.includes(f)
          ? 'F'
          : undefined

  const header = (
    <>
      <p className="mb-4 text-xs">
        <Link to="/experiments" className="text-accent underline underline-offset-2">← All experiments</Link>
      </p>
      <PageHeader
        eyebrow={meta ? `Experiment ${meta.letter}` : 'Experiment'}
        title={meta?.title ?? experiment}
        description={data?.status === 'ok' ? str(data.metadata?.experiment_purpose) : undefined}
        meta={data?.status === 'ok' ? metaStrip(data, experiment, model) : [{ label: 'Model', value: modelLabel(model) }]}
      />
      <div className="mb-6">
        <ModelSelector value={model} experiment={experiment} onChange={(m) => navigate(`/experiments/${experiment}/${m}`)} />
      </div>
    </>
  )

  if (loading) return <div>{header}<LoadingState variant="page" /></div>
  if (error) return <div>{header}<ErrorState /></div>
  if (!data || data.status === 'unavailable') {
    return (
      <div>
        {header}
        <EmptyResearchState
          meta={[
            { label: 'Experiment', value: meta?.tag ?? experiment },
            { label: 'Model', value: modelLabel(model) },
          ]}
        >
          <p>This experiment has not been executed against the current NASA dataset.</p>
          <p className="mt-1">Run the experiment to populate this analysis.</p>
          {data?.detail && <p className="mt-3 font-mono text-[11px] text-faint">{data.detail}</p>}
        </EmptyResearchState>
      </div>
    )
  }

  const m = data.metadata ?? {}
  const numeric = list(m.numeric_features)
  const categorical = list(m.categorical_features)
  const software = (m.software_versions ?? {}) as Record<string, unknown>
  const provenance = (m.dataset_provenance ?? {}) as Record<string, unknown>
  const hyper = (m.best_hyperparameters ?? {}) as Record<string, unknown>

  return (
    <div>
      {header}
      <div className="lg:grid lg:grid-cols-[11rem_1fr] lg:gap-8">
        <nav aria-label="Sections" className="mb-6 lg:sticky lg:top-20 lg:mb-0 lg:self-start">
          <MonoTag className="mb-2 hidden lg:block">Contents</MonoTag>
          <ol className="flex gap-3 overflow-x-auto pb-2 text-xs lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
            {SECTIONS.map(([id, label], i) => (
              <li key={id} className="shrink-0">
                <a href={`#${id}`} className="text-muted hover:text-ink">
                  <span className="mr-1.5 font-mono text-[10px] text-faint">{String(i + 1).padStart(2, '0')}</span>
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 divide-y divide-line">
          <ResearchSection id="overview" eyebrow="01" title="Overview">
            <MetricGrid>
              <MetricCard label="Features" value={fmtInt(list(m.feature_columns).length)} />
              <MetricCard label="Training rows" value={fmtInt(typeof m.train_rows === 'number' ? m.train_rows : null)} />
              <MetricCard label="Test rows" value={fmtInt(typeof m.test_rows === 'number' ? m.test_rows : null)} />
              <MetricCard label="Tuned" value={m.tuned === true ? 'Yes' : m.tuned === false ? 'No' : null} sub="Inside CV folds" />
            </MetricGrid>
          </ResearchSection>

          <ResearchSection id="feature-set" eyebrow="02" title="Feature set" description="A label-defining · B derived from A · F excluded, per the feature audit.">
            <ScientificCard>
              <MonoTag className="mb-2 block">{numeric.length} numeric</MonoTag>
              <ul className="flex flex-wrap gap-1.5">
                {numeric.map((f) => (
                  <li key={f}><FeatureBadge name={f} category={category(f)} /></li>
                ))}
              </ul>
              {categorical.length > 0 && (
                <>
                  <MonoTag className="mb-2 mt-4 block">{categorical.length} categorical</MonoTag>
                  <ul className="flex flex-wrap gap-1.5">
                    {categorical.map((f) => (
                      <li key={f}><FeatureBadge name={f} category={category(f)} /></li>
                    ))}
                  </ul>
                </>
              )}
            </ScientificCard>
          </ResearchSection>

          <ResearchSection id="cross-validation" eyebrow="03" title="Cross validation">
            <Deferred><FoldPanel detail={data} /></Deferred>
          </ResearchSection>

          <ResearchSection id="model-results" eyebrow="04" title="Model results">
            <div className="space-y-6">
              <ModelResultsPanel detail={data} />
              <Deferred><ConfusionPanel detail={data} /></Deferred>
            </div>
          </ResearchSection>

          <ResearchSection id="roc" eyebrow="05" title="ROC">
            <Deferred><RocPanel detail={data} /></Deferred>
          </ResearchSection>
          <ResearchSection id="precision-recall" eyebrow="06" title="Precision–recall">
            <Deferred><PrPanel detail={data} /></Deferred>
          </ResearchSection>
          <ResearchSection id="threshold" eyebrow="07" title="Threshold analysis">
            <Deferred><ThresholdPanel detail={data} /></Deferred>
          </ResearchSection>
          <ResearchSection id="calibration" eyebrow="08" title="Calibration">
            <Deferred><CalibrationPanel detail={data} /></Deferred>
          </ResearchSection>
          <ResearchSection id="importance" eyebrow="09" title="Feature importance">
            <Deferred><ImportancePanel detail={data} /></Deferred>
          </ResearchSection>
          <ResearchSection id="shap" eyebrow="10" title="SHAP">
            <Deferred><ShapPanel detail={data} /></Deferred>
          </ResearchSection>
          <ResearchSection id="errors" eyebrow="11" title="Error analysis">
            <Deferred><ErrorPanel detail={data} /></Deferred>
          </ResearchSection>

          <ResearchSection id="reproducibility" eyebrow="12" title="Reproducibility">
            <div className="space-y-4">
              <ScientificCard>
                <KeyValueList
                  columns="sm:grid-cols-2 lg:grid-cols-3"
                  items={[
                    { label: 'Random seed', value: str(m.random_seed) },
                    { label: 'CV folds', value: str(m.n_cv_folds) },
                    { label: 'Outer test size', value: str(m.outer_test_size) },
                    { label: 'Dataset rows', value: fmtInt(typeof m.dataset_row_count === 'number' ? m.dataset_row_count : null) },
                    { label: 'Trained (UTC)', value: fmtUtc(m.trained_at_utc) },
                    { label: 'Dataset validated (UTC)', value: fmtUtc(provenance.validated_at_utc) },
                    { label: 'Python', value: str(software.python) },
                    { label: 'scikit-learn', value: str(software.scikit_learn) },
                    { label: 'XGBoost', value: str(software.xgboost) },
                    { label: 'Git commit', value: 'Not recorded in artifacts' },
                  ]}
                />
                {Object.keys(hyper).length > 0 && (
                  <details className="mt-4 text-xs">
                    <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.1em] text-muted hover:text-ink">
                      Best hyperparameters ({Object.keys(hyper).length})
                    </summary>
                    <KeyValueList
                      columns="sm:grid-cols-2 lg:grid-cols-3"
                      items={Object.entries(hyper).map(([k, v]) => ({ label: k, value: typeof v === 'number' ? fmt(v, 6) : str(v) }))}
                    />
                  </details>
                )}
              </ScientificCard>
              {repro && <CodeBlock label="Reproduce this experiment" lines={repro.reproduce_with} />}
              <p className="text-xs text-muted">
                Commands are shown for reference only; this interface never executes anything on the backend.
              </p>
            </div>
          </ResearchSection>
        </div>
      </div>
    </div>
  )
}
