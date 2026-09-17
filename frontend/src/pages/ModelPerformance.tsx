import { Fragment, useEffect, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from 'recharts'
import {
  api,
  type ClassificationMetrics,
  type ExplainabilityResponse,
  type ModelRegistryEntry,
  type ModelsResponse,
} from '../api/client'
import { UnavailableNotice } from '../components/UnavailableNotice'

const KNOWN_MODELS = ['logistic_regression', 'random_forest', 'xgboost'] as const
type ModelName = (typeof KNOWN_MODELS)[number]

// Fixed categorical order, validated CVD-safe against this page's dark
// surface (#05070d) — see the dataviz skill. Never reassigned per filter.
const MODEL_COLOR: Record<ModelName, string> = {
  logistic_regression: '#3987e5',
  random_forest: '#d95926',
  xgboost: '#199e70',
}
const MODEL_LABEL: Record<ModelName, string> = {
  logistic_regression: 'Logistic Regression',
  random_forest: 'Random Forest',
  xgboost: 'XGBoost',
}
const MUTED = '#898781'
const GRID = '#2c2c2a'
const SECONDARY_INK = '#c3c2b7'

function ChartCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {children}
      {note && <p className="mt-3 text-xs text-slate-500">{note}</p>}
    </div>
  )
}

function tickStyle() {
  return { fill: MUTED, fontSize: 11 }
}

function MetricsBarChart({ metricsByModel }: { metricsByModel: Partial<Record<ModelName, ClassificationMetrics>> }) {
  const metricKeys: Array<keyof ClassificationMetrics> = ['accuracy', 'precision', 'recall', 'f1']
  const metricLabel: Record<string, string> = { accuracy: 'Acc', precision: 'Prec', recall: 'Rec', f1: 'F1' }
  const data = metricKeys.map((key) => {
    const row: Record<string, number | string> = { metric: metricLabel[key] }
    for (const model of KNOWN_MODELS) {
      const value = metricsByModel[model]?.[key]
      if (typeof value === 'number') row[model] = Number(value.toFixed(4))
    }
    return row
  })
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="metric" tick={tickStyle()} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis domain={[0, 1]} tick={tickStyle()} axisLine={{ stroke: GRID }} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#0d0d0d', border: '1px solid #2c2c2a', fontSize: 12 }}
          labelStyle={{ color: SECONDARY_INK }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: SECONDARY_INK }} formatter={(v: string) => MODEL_LABEL[v as ModelName] ?? v} />
        {KNOWN_MODELS.map((model) => (
          <Bar key={model} dataKey={model} name={model} fill={MODEL_COLOR[model]} radius={[3, 3, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function RocCurveChart({ metricsByModel }: { metricsByModel: Partial<Record<ModelName, ClassificationMetrics>> }) {
  const diagonal = [
    { fpr: 0, y: 0 },
    { fpr: 1, y: 1 },
  ]
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis type="number" dataKey="fpr" domain={[0, 1]} tick={tickStyle()} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis type="number" domain={[0, 1]} tick={tickStyle()} axisLine={{ stroke: GRID }} tickLine={false} />
        <Tooltip contentStyle={{ background: '#0d0d0d', border: '1px solid #2c2c2a', fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12, color: SECONDARY_INK }} />
        <Line data={diagonal} dataKey="y" name="Chance" stroke={MUTED} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
        {KNOWN_MODELS.map((model) => {
          const curve = metricsByModel[model]?.roc_curve
          if (!curve) return null
          const points = curve.fpr.map((f, i) => ({ fpr: f, tpr: curve.tpr[i] }))
          const auc = metricsByModel[model]?.roc_auc
          return (
            <Line
              key={model}
              data={points}
              dataKey="tpr"
              name={`${MODEL_LABEL[model]}${auc != null ? ` (AUC ${auc.toFixed(3)})` : ''}`}
              stroke={MODEL_COLOR[model]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          )
        })}
      </LineChart>
    </ResponsiveContainer>
  )
}

function PrCurveChart({ metricsByModel }: { metricsByModel: Partial<Record<ModelName, ClassificationMetrics>> }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis type="number" dataKey="recall" domain={[0, 1]} tick={tickStyle()} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis type="number" domain={[0, 1]} tick={tickStyle()} axisLine={{ stroke: GRID }} tickLine={false} />
        <Tooltip contentStyle={{ background: '#0d0d0d', border: '1px solid #2c2c2a', fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12, color: SECONDARY_INK }} />
        {KNOWN_MODELS.map((model) => {
          const curve = metricsByModel[model]?.pr_curve
          if (!curve) return null
          const points = curve.recall.map((r, i) => ({ recall: r, precision: curve.precision[i] }))
          const auc = metricsByModel[model]?.pr_auc
          return (
            <Line
              key={model}
              data={points}
              dataKey="precision"
              name={`${MODEL_LABEL[model]}${auc != null ? ` (AUC ${auc.toFixed(3)})` : ''}`}
              stroke={MODEL_COLOR[model]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          )
        })}
      </LineChart>
    </ResponsiveContainer>
  )
}

function ConfusionMatrixGrid({ model, metrics }: { model: ModelName; metrics: ClassificationMetrics }) {
  const { labels, matrix } = metrics.confusion_matrix
  const max = Math.max(...matrix.flat())
  const cellStyle = (value: number) => {
    const t = max > 0 ? value / max : 0
    // Interpolate from the dark surface toward this model's series color.
    return {
      backgroundColor: `color-mix(in oklab, ${MODEL_COLOR[model]} ${Math.round(t * 75)}%, #1a1a19)`,
    }
  }
  return (
    <div>
      <p className="mb-2 text-xs font-medium" style={{ color: MODEL_COLOR[model] }}>
        {MODEL_LABEL[model]}
      </p>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-1 text-center text-xs">
        <div />
        <div className="truncate px-1 py-1 text-slate-500">pred: no</div>
        <div className="truncate px-1 py-1 text-slate-500">pred: yes</div>
        {matrix.map((row, i) => (
          <Fragment key={i}>
            <div className="flex items-center justify-end px-1 text-slate-500">
              true: {i === 0 ? 'no' : 'yes'}
            </div>
            {row.map((value, j) => (
              <div
                key={j}
                className="flex items-center justify-center rounded py-3 font-mono text-slate-50"
                style={cellStyle(value)}
              >
                {value}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-slate-600">
        labels: {labels[0]} / {labels[1]}
      </p>
    </div>
  )
}

function FeatureImportanceChart({ importance }: { importance: { feature: string; mean_abs_shap: number }[] }) {
  const top = importance.slice(0, 8).reverse()
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={top} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={tickStyle()} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis
          type="category"
          dataKey="feature"
          width={150}
          tick={{ fill: SECONDARY_INK, fontSize: 11 }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
        />
        <Tooltip contentStyle={{ background: '#0d0d0d', border: '1px solid #2c2c2a', fontSize: 12 }} />
        <Bar dataKey="mean_abs_shap" name="mean |SHAP value|" fill={MODEL_COLOR.random_forest} radius={[0, 3, 3, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ModelPerformance() {
  const [models, setModels] = useState<ModelsResponse | null>(null)
  const [metricsByModel, setMetricsByModel] = useState<Partial<Record<ModelName, ClassificationMetrics>>>({})
  const [explainability, setExplainability] = useState<ExplainabilityResponse | null>(null)

  useEffect(() => {
    api.models().then(setModels).catch(() => setModels({ status: 'unavailable', models: [] }))
    KNOWN_MODELS.forEach((name) => {
      api
        .modelMetrics(name)
        .then((res) => {
          if (res.status === 'ok' && res.metrics) {
            setMetricsByModel((prev) => ({ ...prev, [name]: res.metrics }))
          }
        })
        .catch(() => null)
    })
    api.modelExplainability('random_forest').then(setExplainability).catch(() => null)
  }, [])

  const registryByModel: Partial<Record<ModelName, ModelRegistryEntry>> = {}
  for (const entry of models?.models ?? []) {
    if ((KNOWN_MODELS as readonly string[]).includes(entry.model_name)) {
      registryByModel[entry.model_name as ModelName] = entry
    }
  }
  const anyMetrics = Object.keys(metricsByModel).length > 0
  const reference = registryByModel.random_forest ?? registryByModel.logistic_regression ?? registryByModel.xgboost

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Experiment A — Original / Label-Defining Feature Experiment
      </h2>

      {models?.status === 'unavailable' && !anyMetrics && (
        <UnavailableNotice detail="No trained models found. Run `python -m src.models.train`." />
      )}

      {reference && (
        <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            How these models were trained
          </p>
          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <p>
              <span className="text-slate-500">Dataset: </span>
              {reference.dataset_row_count} rows (one row per unique NEO object), split{' '}
              {Math.round((1 - reference.test_size) * reference.dataset_row_count)} train /{' '}
              {Math.round(reference.test_size * reference.dataset_row_count)} test —{' '}
              {Math.round((1 - reference.test_size) * 100)}/{Math.round(reference.test_size * 100)}{' '}
              stratified split, seed {reference.random_seed}.
            </p>
            <p>
              <span className="text-slate-500">Target: </span>
              <code className="rounded bg-black/30 px-1">{reference.target_column}</code> — NASA/JPL's own
              classification, passed through unmodified.
            </p>
            <p>
              <span className="text-slate-500">Features: </span>
              {reference.numeric_features.length} numeric + {reference.categorical_features.length} categorical
              (one-hot encoded) — see <code className="rounded bg-black/30 px-1">docs/FEATURES.md</code>.
            </p>
            <p>
              <span className="text-slate-500">Preprocessing: </span>
              median imputation + standard scaling (numeric), most-frequent imputation + one-hot
              encoding (categorical) — fit only on the training fold, inside each model's pipeline.
            </p>
            <p>
              <span className="text-slate-500">Trained: </span>
              {new Date(reference.trained_at_utc).toUTCString()}
            </p>
            <p>
              <span className="text-slate-500">Class imbalance: </span>
              handled adaptively per model —{' '}
              <code className="rounded bg-black/30 px-1">class_weight=&quot;balanced&quot;</code> (logistic
              regression, random forest) or a computed{' '}
              <code className="rounded bg-black/30 px-1">scale_pos_weight</code> (XGBoost), from the actual
              training-fold label counts, not assumed in advance.
            </p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {KNOWN_MODELS.map((model) => {
              const entry = registryByModel[model]
              if (!entry) return null
              const hp = entry.hyperparameters
              const highlight =
                model === 'logistic_regression'
                  ? `max_iter=${hp.max_iter}, class_weight=${hp.class_weight}`
                  : model === 'random_forest'
                    ? `n_estimators=${hp.n_estimators}, class_weight=${hp.class_weight}`
                    : `scale_pos_weight=${Number(hp.scale_pos_weight).toFixed(2)}`
              return (
                <div key={model} className="rounded-md border border-white/5 bg-black/20 px-3 py-2 text-xs">
                  <p className="font-medium" style={{ color: MODEL_COLOR[model] }}>
                    {MODEL_LABEL[model]}
                  </p>
                  <p className="mt-1 text-slate-500">{highlight}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {anyMetrics && (
        <>
          <ChartCard
            title="Accuracy / Precision / Recall / F1 by model"
            note="Computed by sklearn.metrics on the held-out test fold — see results/model_metrics.json."
          >
            <MetricsBarChart metricsByModel={metricsByModel} />
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="ROC curve"
              note="X-axis: false positive rate. Y-axis: true positive rate. Diagonal = a classifier no better than chance."
            >
              <RocCurveChart metricsByModel={metricsByModel} />
            </ChartCard>
            <ChartCard title="Precision-Recall curve" note="X-axis: recall. Y-axis: precision.">
              <PrCurveChart metricsByModel={metricsByModel} />
            </ChartCard>
          </div>

          <ChartCard title="Confusion matrices (test fold)">
            <div className="grid gap-6 sm:grid-cols-3">
              {KNOWN_MODELS.map((model) => {
                const metrics = metricsByModel[model]
                return metrics ? <ConfusionMatrixGrid key={model} model={model} metrics={metrics} /> : null
              })}
            </div>
          </ChartCard>
        </>
      )}

      {explainability?.status === 'ok' && explainability.global_importance && (
        <ChartCard
          title="Feature importance — random_forest (SHAP)"
          note="Mean |SHAP value| across a sample of the test fold. Explains this model's behavior, not physical causation — see docs/LIMITATIONS.md."
        >
          <FeatureImportanceChart importance={explainability.global_importance} />
        </ChartCard>
      )}
      {explainability?.status === 'unavailable' && (
        <ChartCard title="Feature importance — random_forest (SHAP)">
          <UnavailableNotice detail={explainability.detail} />
        </ChartCard>
      )}

      {anyMetrics && (
        <div className="rounded-lg border border-amber-700/30 bg-amber-950/20 px-4 py-3 text-xs text-amber-200/90">
          Read before drawing conclusions: <code className="rounded bg-black/30 px-1">moid_au</code> and{' '}
          <code className="rounded bg-black/30 px-1">absolute_magnitude_h</code> are direct model inputs, and
          NASA/JPL's own hazard flag is essentially a threshold rule over those two quantities. Near-perfect
          tree-model scores mean the model recovered that known rule from its own inputs — not that it
          discovered new hazard signal. See <code className="rounded bg-black/30 px-1">docs/MODEL_CARD.md</code>{' '}
          and <code className="rounded bg-black/30 px-1">docs/LIMITATIONS.md</code>, or the full{' '}
          <a href="/feature-audit" className="underline hover:text-amber-100">
            Feature Audit
          </a>{' '}
          and leakage-audited{' '}
          <a href="/experiments" className="underline hover:text-amber-100">
            Experiments
          </a>{' '}
          (the primary research view) for what remains once these features are removed.
        </div>
      )}

      <p className="text-xs text-slate-500">
        Every number on this page is read live from <code>results/model_metrics.json</code> and{' '}
        <code>results/shap_global_importance.json</code>, generated by <code>python -m src.models.train</code>{' '}
        and <code>python -m src.explainability.shap_analysis</code>. No number is hardcoded — see{' '}
        <code>backend/main.py</code>.
      </p>
    </div>
  )
}
