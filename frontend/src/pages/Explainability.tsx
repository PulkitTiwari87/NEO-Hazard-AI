import { useEffect, useState } from 'react'
import { api, MODEL_COLOR, type ExperimentExplainabilityResponse, type ExperimentId, type ModelName } from '../api/client'
import { ChartCard } from '../components/ChartCard'
import { UnavailableNotice } from '../components/UnavailableNotice'
import { ExperimentSelector } from '../components/research/ExperimentSelector'
import { ModelSelector } from '../components/research/ModelSelector'
import { ResearchNotes } from '../components/research/ResearchNotes'
import { FeatureImportanceChart } from '../components/charts/FeatureImportanceChart'
import { SignedBarChart } from '../components/charts/SignedBarChart'

export function Explainability() {
  const [experimentId, setExperimentId] = useState<ExperimentId>('experiment_a_original')
  const [modelName, setModelName] = useState<ModelName>('random_forest')
  const [explainability, setExplainability] = useState<ExperimentExplainabilityResponse | null>(null)
  const [selectedNeoId, setSelectedNeoId] = useState<string | null>(null)

  useEffect(() => {
    setExplainability(null)
    setSelectedNeoId(null)
    api.experimentExplainability(experimentId, modelName).then(setExplainability).catch(() => null)
  }, [experimentId, modelName])

  const localExample =
    explainability?.local_examples?.find((e) => String(e.neo_id) === selectedNeoId) ?? explainability?.local_examples?.[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Feature Importance &amp; SHAP</h2>
          <p className="mt-1 text-sm text-slate-400">Global model behavior and per-record local explanations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExperimentSelector value={experimentId} onChange={setExperimentId} />
          <ModelSelector value={modelName} onChange={setModelName} />
        </div>
      </div>

      <ResearchNotes
        notes={[
          'SHAP values describe how much each feature moved this model\'s output for this row, relative to the model\'s average prediction. They explain the model\'s behavior, not the physical cause of an object\'s classification.',
        ]}
      />

      {explainability?.status === 'unavailable' && (
        <UnavailableNotice
          detail={
            explainability.detail ??
            `SHAP explainability not generated. Run \`python -m src.explainability.shap_analysis --model ${modelName} --experiment ${experimentId}\`.`
          }
        />
      )}

      {explainability?.status === 'ok' && explainability.global_importance && (
        <ChartCard
          title="Global feature importance"
          description={`Mean |SHAP value| across a sample of the holdout set — ${experimentId} / ${modelName}.`}
        >
          <FeatureImportanceChart
            importance={explainability.global_importance.map((f) => ({ feature: f.feature, value: f.mean_abs_shap }))}
            valueLabel="mean |SHAP value|"
            color={MODEL_COLOR[modelName]}
            top={15}
          />
        </ChartCard>
      )}

      {explainability?.status === 'ok' && explainability.local_examples && explainability.local_examples.length > 0 && (
        <ChartCard
          title="Local explanation"
          description="Feature contributions for one selected record. Positive (orange) pushes toward 'potentially hazardous'; negative (blue) pushes away."
          actions={
            <select
              value={selectedNeoId ?? String(explainability.local_examples[0].neo_id)}
              onChange={(e) => setSelectedNeoId(e.target.value)}
              className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200"
            >
              {explainability.local_examples.map((ex) => (
                <option key={String(ex.neo_id)} value={String(ex.neo_id)}>
                  NEO {ex.neo_id}
                </option>
              ))}
            </select>
          }
        >
          {localExample && (
            <SignedBarChart
              items={localExample.top_contributing_features.map((f) => ({ feature: f.feature, value: f.shap_value }))}
            />
          )}
        </ChartCard>
      )}
    </div>
  )
}
