import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  api,
  type ClassificationMetrics,
  type ExplainabilityResponse,
  type ModelRegistryEntry,
  type ModelsResponse,
} from '../api/client'
import { MODEL_COLOR, MODEL_LABEL, fmtUtc } from '../lib/research'
import { ConfusionMatrix } from '../components/charts'
import { Callout, ChartContainer, EmptyResearchState, KeyValueList, LoadingState, PageHeader, ResearchSection } from '../components/ui'

// Legacy Experiment A baseline: three models from the model registry
// (results/model_metrics.json), separate from the A–D benchmark artifacts.
const KNOWN_MODELS = ['logistic_regression', 'random_forest', 'xgboost'] as const
type ModelName = (typeof KNOWN_MODELS)[number]

const MUTED = '#8b97ab'
const GRID = 'rgb(255 255 255 / 0.08)'
const TOOLTIP = { background: '#0a0f1a', border: '1px solid rgb(255 255 255 / 0.18)', fontSize: 12, borderRadius: 4 }
const tick = { fill: MUTED, fontSize: 11 }

function MetricsBarChart({ metricsByModel }: { metricsByModel: Partial<Record<ModelName, ClassificationMetrics>> }) {
  const keys = ['accuracy', 'precision', 'recall', 'f1'] as const
  const label: Record<string, string> = { accuracy: 'Accuracy', precision: 'Precision', recall: 'Recall', f1: 'F1' }
  const data = keys.map((key) => {
    const row: Record<string, number | string> = { metric: label[key] }
    for (const m of KNOWN_MODELS) {
      const v = metricsByModel[m]?.[key]
      if (typeof v === 'number') row[m] = Number(v.toFixed(4))
    }
    return row
  })
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="metric" tick={tick} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis domain={[0, 1]} tick={tick} axisLine={{ stroke: GRID }} tickLine={false} />
        <Tooltip contentStyle={TOOLTIP} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => MODEL_LABEL[v] ?? v} />
        {KNOWN_MODELS.map((m) => (
          <Bar key={m} dataKey={m} name={m} fill={MODEL_COLOR[m]} radius={[3, 3, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function CurveChart({
  metricsByModel,
  kind,
}: {
  metricsByModel: Partial<Record<ModelName, ClassificationMetrics>>
  kind: 'roc' | 'pr'
}) {
  const xKey = kind === 'roc' ? 'fpr' : 'recall'
  const yKey = kind === 'roc' ? 'tpr' : 'precision'
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis type="number" dataKey={xKey} domain={[0, 1]} tick={tick} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis type="number" domain={[0, 1]} tick={tick} axisLine={{ stroke: GRID }} tickLine={false} />
        <Tooltip contentStyle={TOOLTIP} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {kind === 'roc' && (
          <Line
            data={[{ fpr: 0, tpr: 0 }, { fpr: 1, tpr: 1 }]}
            dataKey="tpr"
            name="Chance"
            stroke={MUTED}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
        )}
        {KNOWN_MODELS.map((m) => {
          const metrics = metricsByModel[m]
          const c = kind === 'roc' ? metrics?.roc_curve : metrics?.pr_curve
          if (!c) return null
          const points =
            kind === 'roc' && 'fpr' in c
              ? c.fpr.map((f, i) => ({ fpr: f, tpr: c.tpr[i] }))
              : 'recall' in c
                ? c.recall.map((r, i) => ({ recall: r, precision: c.precision[i] }))
                : []
          const auc = kind === 'roc' ? metrics?.roc_auc : metrics?.pr_auc
          return (
            <Line
              key={m}
              data={points}
              dataKey={yKey}
              name={`${MODEL_LABEL[m]}${auc != null ? ` (AUC ${auc.toFixed(3)})` : ''}`}
              stroke={MODEL_COLOR[m]}
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

function ShapBars({ importance }: { importance: { feature: string; mean_abs_shap: number }[] }) {
  const top = importance.slice(0, 8).reverse()
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={top} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={tick} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis type="category" dataKey="feature" width={150} tick={{ fill: '#c3c9d6', fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} />
        <Tooltip contentStyle={TOOLTIP} />
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
          if (res.status === 'ok' && res.metrics) setMetricsByModel((prev) => ({ ...prev, [name]: res.metrics }))
        })
        .catch(() => null)
    })
    api.modelExplainability('random_forest').then(setExplainability).catch(() => null)
  }, [])

  const registry: Partial<Record<ModelName, ModelRegistryEntry>> = {}
  for (const entry of models?.models ?? []) {
    if ((KNOWN_MODELS as readonly string[]).includes(entry.model_name)) registry[entry.model_name as ModelName] = entry
  }
  const anyMetrics = Object.keys(metricsByModel).length > 0
  const ref = registry.random_forest ?? registry.logistic_regression ?? registry.xgboost

  return (
    <div>
      <PageHeader
        eyebrow="Research · Legacy baseline"
        title="Experiment A — legacy baseline"
        description="The original single-feature-set models, including the two fields that define NASA's label. Near-perfect tree-model scores here reflect recovering that rule, not new hazard signal."
        meta={ref ? [{ label: 'Trained', value: fmtUtc(ref.trained_at_utc) }, { label: 'Seed', value: String(ref.random_seed) }, { label: 'Dataset rows', value: String(ref.dataset_row_count) }] : undefined}
      />

      {models === null && <LoadingState variant="page" />}
      {models?.status === 'unavailable' && !anyMetrics && (
        <EmptyResearchState title="NO TRAINED MODELS">
          <p>The legacy baseline has not been trained against the current NASA dataset.</p>
          <p className="mt-1">Run the training stage to populate this page.</p>
        </EmptyResearchState>
      )}

      {ref && (
        <ResearchSection id="training" eyebrow="Setup" title="How these models were trained">
          <ChartContainer title="Registry record">
            <KeyValueList
              columns="sm:grid-cols-2 lg:grid-cols-3"
              items={[
                { label: 'Target', value: ref.target_column },
                { label: 'Features', value: `${ref.numeric_features.length} numeric + ${ref.categorical_features.length} categorical` },
                { label: 'Test size', value: String(ref.test_size) },
                ...KNOWN_MODELS.filter((m) => registry[m]).map((m) => ({
                  label: MODEL_LABEL[m],
                  value: Object.entries(registry[m]?.hyperparameters ?? {})
                    .filter(([k]) => ['max_iter', 'class_weight', 'n_estimators', 'scale_pos_weight'].includes(k))
                    .map(([k, v]) => `${k}=${v}`)
                    .join(', '),
                })),
              ]}
            />
          </ChartContainer>
        </ResearchSection>
      )}

      {anyMetrics && (
        <ResearchSection id="metrics" eyebrow="Held-out test fold" title="Metrics">
          <div className="space-y-6">
            <ChartContainer title="Accuracy · precision · recall · F1" note="Computed by sklearn.metrics on the held-out test fold.">
              <MetricsBarChart metricsByModel={metricsByModel} />
            </ChartContainer>
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartContainer title="ROC curve" note="Dashed diagonal: a classifier no better than chance.">
                <CurveChart metricsByModel={metricsByModel} kind="roc" />
              </ChartContainer>
              <ChartContainer title="Precision–recall curve">
                <CurveChart metricsByModel={metricsByModel} kind="pr" />
              </ChartContainer>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              {KNOWN_MODELS.map((m) => {
                const cm = metricsByModel[m]?.confusion_matrix.matrix
                return cm ? (
                  <ChartContainer key={m} eyebrow="Confusion matrix" title={MODEL_LABEL[m]}>
                    <ConfusionMatrix tn={cm[0][0]} fp={cm[0][1]} fn={cm[1][0]} tp={cm[1][1]} />
                  </ChartContainer>
                ) : null
              })}
            </div>
          </div>
        </ResearchSection>
      )}

      {explainability?.status === 'ok' && explainability.global_importance && (
        <ResearchSection id="shap" eyebrow="Interpretability" title="Random forest — SHAP">
          <ChartContainer title="Mean |SHAP value|" note="Explains this model's behaviour, not physical causation.">
            <ShapBars importance={explainability.global_importance} />
          </ChartContainer>
        </ResearchSection>
      )}
      {explainability?.status === 'unavailable' && (
        <ResearchSection id="shap" eyebrow="Interpretability" title="Random forest — SHAP">
          <EmptyResearchState compact>
            <p>{explainability.detail ?? 'SHAP explainability has not been generated.'}</p>
          </EmptyResearchState>
        </ResearchSection>
      )}

      {anyMetrics && (
        <Callout tone="warn" title="Read before drawing conclusions">
          <code className="font-mono">moid_au</code> and <code className="font-mono">absolute_magnitude_h</code> are direct
          inputs here, and NASA's flag is essentially a threshold over them. See the{' '}
          <Link to="/feature-audit" className="text-accent underline underline-offset-2">Feature Audit</Link> and the
          leakage-aware <Link to="/experiments" className="text-accent underline underline-offset-2">Experiments</Link>.
        </Callout>
      )}
    </div>
  )
}
