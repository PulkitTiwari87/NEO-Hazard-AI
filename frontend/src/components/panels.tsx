import { Fragment, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ExperimentDetailResponse } from '../api/client'
import {
  CHART_COLORS,
  METRIC_KEYS,
  METRIC_LABEL,
  cleanFeature,
  confusionCounts,
  experimentMeta,
  fmt,
  fmtInt,
  fmtPct,
  foldValue,
  metaStrip,
  modelLabel,
  num,
  str,
} from '../lib/research'
import { useExperimentDetail } from '../lib/useApi'
import { useSelection } from '../lib/useSelection'
import { ExperimentSelector, ModelSelector } from './Selectors'
import { DataTable, type Column } from './DataTable'
import {
  CalibrationChart,
  ConfusionMatrix,
  FoldStrip,
  ImportanceBars,
  Legend,
  PrChart,
  RocChart,
  ThresholdChart,
} from './charts'
import {
  Callout,
  ChartContainer,
  EmptyResearchState,
  ErrorState,
  LoadingState,
  MetricCard,
  MetricGrid,
  MonoTag,
  PageHeader,
  StatusBadge,
} from './ui'

interface FrameProps {
  eyebrow: string
  title: string
  description: ReactNode
  /** Short scientific explainer shown collapsed under the header. */
  explainer?: ReactNode
  children: (detail: ExperimentDetailResponse, ctx: { experiment: string; model: string }) => ReactNode
}

/**
 * Shared page frame for every per-experiment analysis: URL-backed
 * experiment/model selection, honest loading / error / not-executed states.
 */
export function AnalysisFrame({ eyebrow, title, description, explainer, children }: FrameProps) {
  const { experiment, model, setExperiment, setModel } = useSelection()
  const { data, error, loading } = useExperimentDetail(experiment, model)
  const ok = data?.status === 'ok'

  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        meta={ok && data ? metaStrip(data, experiment, model) : undefined}
      />
      <div className="mb-6 space-y-3">
        <ExperimentSelector value={experiment} onChange={setExperiment} />
        <ModelSelector value={model} onChange={setModel} experiment={experiment} />
      </div>
      {explainer && (
        <details className="mb-6 rounded-panel border border-line bg-surface px-4 py-3 text-sm text-muted">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.1em] text-muted hover:text-ink">
            About this analysis
          </summary>
          <div className="mt-2 max-w-3xl leading-relaxed">{explainer}</div>
        </details>
      )}
      {loading && <LoadingState variant="chart" />}
      {error && <ErrorState />}
      {data?.status === 'unavailable' && (
        <EmptyResearchState
          meta={[
            { label: 'Experiment', value: experimentMeta(experiment)?.tag ?? experiment },
            { label: 'Model', value: modelLabel(model) },
          ]}
        >
          <p>This experiment has not been executed against the current NASA dataset.</p>
          <p className="mt-1">Run the experiment to populate this analysis.</p>
          {data.detail && <p className="mt-3 font-mono text-[11px] text-faint">{data.detail}</p>}
        </EmptyResearchState>
      )}
      {ok && data && <Fragment key={`${experiment}:${model}`}>{children(data, { experiment, model })}</Fragment>}
    </div>
  )
}

function NotInArtifact({ children }: { children: ReactNode }) {
  return (
    <EmptyResearchState compact title="NOT IN THIS ARTIFACT">
      {children}
    </EmptyResearchState>
  )
}

// ---------------------------------------------------------------------------

export function ConfusionPanel({ detail }: { detail: ExperimentDetailResponse }) {
  const c = confusionCounts(detail)
  return (
    <ChartContainer
      eyebrow="Held-out test set"
      title="Confusion matrix"
      note={c ? `${fmtInt(c.total)} test objects. Select a cell to read what it means.` : undefined}
    >
      {c ? <ConfusionMatrix {...c} /> : <NotInArtifact>No confusion matrix was written for this run.</NotInArtifact>}
    </ChartContainer>
  )
}

export function RocPanel({ detail }: { detail: ExperimentDetailResponse }) {
  const roc = detail.roc_curve
  const auc = num(detail.test_metrics?.roc_auc)
  return (
    <ChartContainer
      eyebrow="Held-out test set"
      title="ROC curve"
      note="ROC-AUC summarizes ranking performance across classification thresholds: the chance of ranking a random positive above a random negative. The dashed diagonal is a classifier with no ranking ability."
    >
      {roc ? (
        <>
          <MetricGrid className="mb-4 grid-cols-2 sm:max-w-md">
            <MetricCard label="ROC-AUC" value={fmt(auc)} />
            <MetricCard label="Curve points" value={fmtInt(roc.fpr.length)} />
          </MetricGrid>
          <RocChart fpr={roc.fpr} tpr={roc.tpr} auc={auc} />
        </>
      ) : (
        <NotInArtifact>
          No ROC curve: the test set had a single class, or this model produces no probability scores.
        </NotInArtifact>
      )}
    </ChartContainer>
  )
}

export function PrPanel({ detail }: { detail: ExperimentDetailResponse }) {
  const pr = detail.pr_curve
  const counts = confusionCounts(detail)
  return (
    <ChartContainer
      eyebrow="Held-out test set"
      title="Precision–recall curve"
      note="With imbalanced classes, PR is more informative than ROC: a model that ignores the rare class still looks good on ROC. The dashed line is the positive-class prevalence in the test set — the precision of a classifier with no skill."
    >
      {pr ? (
        <>
          <MetricGrid className="mb-4 grid-cols-2 sm:grid-cols-3 sm:max-w-xl">
            <MetricCard label="PR-AUC (avg. precision)" value={fmt(pr.average_precision)} />
            <MetricCard label="Class prevalence" value={counts ? fmt(counts.prevalence) : null} sub="Test-set positive fraction" />
            <MetricCard label="Curve points" value={fmtInt(pr.precision.length)} />
          </MetricGrid>
          <PrChart precision={pr.precision} recall={pr.recall} ap={pr.average_precision} prevalence={counts?.prevalence} />
        </>
      ) : (
        <NotInArtifact>No precision–recall curve was written for this run.</NotInArtifact>
      )}
    </ChartContainer>
  )
}

export function ThresholdPanel({ detail }: { detail: ExperimentDetailResponse }) {
  const ta = detail.threshold_analysis
  const grid = ta?.grid ?? []
  const best = ta?.best_by_f1 ?? null
  const start = best ? Math.max(0, grid.findIndex((g) => g.threshold === best.threshold)) : Math.floor(grid.length / 2)
  const [idx, setIdx] = useState(start)
  const row = grid[Math.min(idx, grid.length - 1)]

  return (
    <ChartContainer
      eyebrow="Out-of-fold cross-validation predictions"
      title="Threshold explorer"
      legend={
        <Legend
          items={[
            { name: 'precision', color: CHART_COLORS.blue },
            { name: 'recall', color: CHART_COLORS.orange },
            { name: 'F1', color: CHART_COLORS.green },
          ]}
        />
      }
      note="Every value comes from the backend threshold sweep (a fixed grid), never recomputed in the browser. The sweep uses out-of-fold training predictions, not the test set, so choosing a threshold here cannot leak into the holdout evaluation. Predicted-positive counts are not part of this artifact."
    >
      {grid.length && row ? (
        <>
          <div className="mb-4">
            <label htmlFor="threshold-slider" className="mb-1 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              <span>Decision threshold</span>
              <span className="text-ink">{fmt(row.threshold, 2)}</span>
            </label>
            <input
              id="threshold-slider"
              type="range"
              min={0}
              max={grid.length - 1}
              step={1}
              value={Math.min(idx, grid.length - 1)}
              onChange={(e) => setIdx(Number(e.target.value))}
              aria-valuetext={`threshold ${fmt(row.threshold, 2)}`}
              className="w-full accent-sky-400"
            />
          </div>
          <MetricGrid className="mb-4 grid-cols-3 sm:max-w-xl">
            <MetricCard label="Precision" value={fmt(row.precision)} />
            <MetricCard label="Recall" value={fmt(row.recall)} />
            <MetricCard label="F1" value={fmt(row.f1)} />
          </MetricGrid>
          <ThresholdChart rows={grid} selected={row.threshold} />
          {best && (
            <p className="mt-2 text-xs text-muted">
              Highest F1 on the grid: threshold {fmt(best.threshold, 2)} → F1 {fmt(best.f1)}. The test-set evaluation always
              uses the model's default 0.5 threshold; this sweep is diagnostic only.
            </p>
          )}
        </>
      ) : (
        <NotInArtifact>No threshold sweep: this model produces no probability scores.</NotInArtifact>
      )}
    </ChartContainer>
  )
}

export function CalibrationPanel({ detail }: { detail: ExperimentDetailResponse }) {
  const cal = detail.calibration
  return (
    <ChartContainer
      eyebrow="Held-out test set"
      title="Calibration"
      note="A calibrated model's predicted probability matches how often the outcome actually occurs: of objects scored near 0.8, about 80% should be positive. Points below the diagonal mean over-confident scores. Bins are quantile-based, so each holds a similar number of objects."
    >
      {cal ? (
        <>
          <MetricGrid className="mb-4 grid-cols-2 sm:max-w-md">
            <MetricCard label="Brier score" value={fmt(cal.brier_score, 4)} sub="Lower is better" />
            <MetricCard label="Quantile bins" value={fmtInt(cal.prob_pred.length)} />
          </MetricGrid>
          <CalibrationChart probPred={cal.prob_pred} probTrue={cal.prob_true} />
          <p className="mt-3 text-xs text-faint">A predicted-probability histogram is not part of the stored artifacts, so it is not shown.</p>
        </>
      ) : (
        <NotInArtifact>No calibration data: this model produces no probability scores.</NotInArtifact>
      )}
    </ChartContainer>
  )
}

export function ImportancePanel({ detail }: { detail: ExperimentDetailResponse }) {
  const [view, setView] = useState<'permutation' | 'model'>('permutation')
  const fi = detail.feature_importance
  const perm = fi?.permutation_importance
  const permEntries = perm
    ? perm.features
        .map((f, i) => ({ name: f, value: perm.mean[i], err: perm.std[i] }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
        .slice(0, 15)
    : []
  const modelEntries = fi?.model_specific
    ? Object.entries(fi.model_specific)
        .map(([name, value]) => ({ name: cleanFeature(name), value }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
        .slice(0, 15)
    : []

  return (
    <ChartContainer
      eyebrow="Held-out test set"
      title="Feature importance"
      legend={
        <div role="tablist" aria-label="Importance view" className="flex gap-1">
          {(['permutation', 'model'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${view === v ? 'border-accent/60 bg-accent-soft text-ink' : 'border-line text-muted hover:text-ink'}`}
            >
              {v === 'permutation' ? 'Permutation' : 'Model-specific'}
            </button>
          ))}
        </div>
      }
      note={
        view === 'permutation'
          ? 'Mean drop in test F1 when a feature is shuffled (±1 std over repeats). Negative values mean shuffling did not hurt. This describes what the model relies on, not physical causation.'
          : 'Impurity importance (tree models) or coefficients (logistic regression) for the fitted model. Coefficient sign is shown; magnitudes are not comparable across model types. Not causal.'
      }
    >
      {view === 'permutation' ? (
        permEntries.length ? (
          <ImportanceBars entries={permEntries} color={CHART_COLORS.accent} unit="permutation importance" />
        ) : (
          <NotInArtifact>No permutation importance was written for this run.</NotInArtifact>
        )
      ) : modelEntries.length ? (
        <ImportanceBars entries={modelEntries} color={CHART_COLORS.green} unit="model-specific importance" />
      ) : (
        <NotInArtifact>This model type exposes no built-in importances (e.g. the dummy baseline).</NotInArtifact>
      )}
    </ChartContainer>
  )
}

export function ShapPanel({ detail }: { detail: ExperimentDetailResponse }) {
  const shap = detail.shap_summary
  const entries = shap
    ? Object.entries(shap.global_mean_abs_shap)
        .map(([name, value]) => ({ name: cleanFeature(name), value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15)
    : []
  return (
    <div className="space-y-6">
      <ChartContainer
        eyebrow={shap ? `Global · ${shap.sample_size} test rows sampled` : 'Global'}
        title="Mean |SHAP value| per feature"
        note="SHAP values describe how much each feature moved this trained model's output. They explain the model, not orbital physics or hazard causation."
      >
        {entries.length ? (
          <ImportanceBars entries={entries} color={CHART_COLORS.orange} unit="mean absolute SHAP value" />
        ) : (
          <NotInArtifact>SHAP is only computed for tree-based models (and only when the shap package was available).</NotInArtifact>
        )}
      </ChartContainer>
      <ChartContainer eyebrow="Local" title="Per-object explanation">
        <NotInArtifact>
          Per-object SHAP values are not stored in the experiment artifacts or exposed by the API, so an individual
          prediction cannot be explained here.
        </NotInArtifact>
      </ChartContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------

type ErrorRow = Record<string, unknown>

const BUCKETS = [
  { key: 'false_positive', label: 'False positives', short: 'FP' },
  { key: 'false_negative', label: 'False negatives', short: 'FN' },
  { key: 'true_positive', label: 'True positives', short: 'TP' },
  { key: 'true_negative', label: 'True negatives', short: 'TN' },
] as const

export function ErrorPanel({ detail }: { detail: ExperimentDetailResponse }) {
  const [bucket, setBucket] = useState<(typeof BUCKETS)[number]['key']>('false_negative')
  const summary = detail.error_summary ?? {}
  const active = BUCKETS.find((b) => b.key === bucket) ?? BUCKETS[0]

  const records: ErrorRow[] | null =
    bucket === 'false_positive' ? (detail.false_positives_sample ?? []) : bucket === 'false_negative' ? (detail.false_negatives_sample ?? []) : null

  const features = Array.from(new Set(BUCKETS.flatMap((b) => Object.keys(summary[b.key]?.feature_stats ?? {})))).sort()

  const columns: Column<ErrorRow>[] = [
    {
      key: 'neo_id',
      header: 'NEO ID',
      sortValue: (r) => str(r.neo_id),
      render: (r) => (
        <Link to={`/neo/${encodeURIComponent(String(r.neo_id))}`} className="font-mono text-accent hover:underline">
          {String(r.neo_id)}
        </Link>
      ),
    },
    { key: 'p', header: 'Model probability', align: 'right', sortValue: (r) => num(r.model_probability), render: (r) => fmt(num(r.model_probability)) },
    { key: 'actual', header: 'NASA label', render: (r) => <span className="font-mono">{str(r.actual_label)}</span> },
    { key: 'pred', header: 'Predicted', render: (r) => <span className="font-mono">{str(r.predicted_label)}</span> },
  ]

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Outcome" className="flex flex-wrap gap-2">
        {BUCKETS.map((b) => {
          const n = summary[b.key]?.n_rows
          return (
            <button
              key={b.key}
              role="tab"
              type="button"
              aria-selected={bucket === b.key}
              onClick={() => setBucket(b.key)}
              className={`rounded-sm border px-3 py-1.5 text-left transition-colors ${bucket === b.key ? 'border-accent/60 bg-accent-soft' : 'border-line hover:border-line-strong'}`}
            >
              <MonoTag className="block">{b.label}</MonoTag>
              <span className="font-display text-xl font-semibold tabular-nums text-ink">{fmtInt(n ?? null)}</span>
            </button>
          )
        })}
      </div>

      <ChartContainer
        eyebrow={`Records · ${active.short}`}
        title={`${active.label} on the test set`}
        note="Records are real held-out predictions. Select a row's expander to see the feature values the model received."
      >
        {records === null ? (
          <NotInArtifact>
            Only false positives and false negatives are stored as individual records (capped at 25 each). Aggregate
            feature statistics for this outcome are shown below.
          </NotInArtifact>
        ) : (
          <DataTable
            caption={`${active.label} on the held-out test set`}
            columns={columns}
            rows={records}
            rowKey={(r) => String(r.neo_id)}
            initialSort={{ key: 'p', dir: 'desc' }}
            empty={<EmptyResearchState compact title="NONE ON THIS TEST SET">No {active.label.toLowerCase()} were recorded.</EmptyResearchState>}
            renderExpanded={(r) => (
              <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(r)
                  .filter(([k]) => !['neo_id', 'actual_label', 'predicted_label', 'model_probability', 'outcome'].includes(k))
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 border-b border-line py-1">
                      <dt className="truncate font-mono text-faint">{k}</dt>
                      <dd className="font-mono text-ink">{typeof v === 'number' ? fmt(v, 4) : str(v)}</dd>
                    </div>
                  ))}
              </dl>
            )}
          />
        )}
      </ChartContainer>

      <ChartContainer
        eyebrow="Feature comparison"
        title="Mean feature value by outcome"
        note="Plain per-outcome means over the real test rows. A difference between columns is descriptive; it does not explain why the model erred."
      >
        {features.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <caption className="sr-only">Mean numeric feature value per prediction outcome</caption>
              <thead>
                <tr className="text-muted">
                  <th scope="col" className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em]">Feature</th>
                  {BUCKETS.map((b) => (
                    <th key={b.key} scope="col" className={`px-2 py-1.5 text-right font-mono text-[10px] uppercase tracking-[0.1em] ${bucket === b.key ? 'text-accent' : ''}`}>
                      {b.short}
                      {bucket === b.key && <span className="sr-only"> (selected)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((f) => (
                  <tr key={f} className="border-t border-line">
                    <th scope="row" className="px-2 py-1 font-mono font-normal text-muted">{f}</th>
                    {BUCKETS.map((b) => (
                      <td key={b.key} className={`px-2 py-1 text-right font-mono tabular-nums ${bucket === b.key ? 'bg-accent-soft text-ink' : 'text-ink/80'}`}>
                        {fmt(num(summary[b.key]?.feature_stats?.[f]?.mean), 3)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <NotInArtifact>No feature-range summary was written for this run.</NotInArtifact>
        )}
      </ChartContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function FoldPanel({ detail }: { detail: ExperimentDetailResponse }) {
  const folds = (detail.fold_metrics ?? []) as Record<string, unknown>[]
  if (!folds.length) {
    return (
      <ChartContainer title="Cross-validation folds">
        <NotInArtifact>No per-fold metrics were written for this run.</NotInArtifact>
      </ChartContainer>
    )
  }
  return (
    <div className="space-y-6">
      <ChartContainer
        eyebrow={`${folds.length} folds · training set only`}
        title="Fold-level metrics"
        note="Each dot is one fold's real value; the shaded bar spans min to max and the white tick marks the mean. A wide bar means the estimate is unstable across data splits. No smoothing is applied."
      >
        <FoldStrip folds={folds} />
      </ChartContainer>
      <div className="overflow-x-auto rounded-panel border border-line bg-surface">
        <table className="w-full min-w-[34rem] text-left text-xs">
          <caption className="sr-only">Cross-validation metrics per fold with mean and standard deviation</caption>
          <thead className="bg-raised text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em]">Fold</th>
              {METRIC_KEYS.map((k) => (
                <th key={k} scope="col" className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.1em]">{METRIC_LABEL[k]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {folds.map((f, i) => (
              <tr key={i} className="border-t border-line">
                <th scope="row" className="px-3 py-1.5 font-mono font-normal">F{String(f.fold ?? i + 1)}</th>
                {METRIC_KEYS.map((k) => (
                  <td key={k} className="px-3 py-1.5 text-right font-mono tabular-nums">{fmt(foldValue(f, k))}</td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-line-strong bg-white/[0.02]">
              <th scope="row" className="px-3 py-1.5 font-mono font-normal text-muted">mean ± std</th>
              {METRIC_KEYS.map((k) => {
                const cv = detail.cv_metrics?.[k]
                return (
                  <td key={k} className="px-3 py-1.5 text-right font-mono tabular-nums">
                    {fmt(cv?.mean ?? null)} ± {fmt(cv?.std ?? null)}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ModelResultsPanel({ detail }: { detail: ExperimentDetailResponse }) {
  const t = detail.test_metrics
  const ci = t?.f1_bootstrap_ci
  return (
    <div className="space-y-4">
      <MetricGrid className="sm:grid-cols-3 lg:grid-cols-6">
        {METRIC_KEYS.map((k) => (
          <MetricCard key={k} label={`Test ${METRIC_LABEL[k]}`} value={t ? fmt(num(t[k])) : null} />
        ))}
      </MetricGrid>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <StatusBadge tone="info">Held-out test set</StatusBadge>
        {ci && (
          <span>
            F1 bootstrap {fmtPct(ci.ci_level, 0)} CI: [{fmt(ci.ci_low)}, {fmt(ci.ci_high)}]
          </span>
        )}
      </div>
      <Callout tone="info" title="Reading these numbers">
        Test metrics come from one fixed holdout split. Compare them with the cross-validation spread before drawing
        conclusions — a single split can be lucky or unlucky.
      </Callout>
    </div>
  )
}
