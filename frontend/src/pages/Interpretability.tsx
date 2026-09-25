import { MODELS, fmt, modelLabel, num } from '../lib/research'
import { useExperimentDetails, useExperiments } from '../lib/useApi'
import { AnalysisFrame, ErrorPanel, ImportancePanel, ShapPanel } from '../components/panels'
import { Callout, ChartContainer, EmptyResearchState, LoadingState, PageHeader } from '../components/ui'

/** Permutation importance for every executed model of one experiment, side by side. */
function ImportanceComparison({ experiment }: { experiment: string }) {
  const list = useExperiments().data
  const executed = MODELS.filter((m) => list?.experiments[experiment]?.models[m]?.executed)
  const details = useExperimentDetails(experiment, [...executed])

  const perModel: { model: string; values: Map<string, number> }[] = []
  for (const m of executed) {
    const d = details.data?.[m]
    const perm = d?.status === 'ok' ? d.feature_importance?.permutation_importance : undefined
    if (perm) perModel.push({ model: m, values: new Map(perm.features.map((f, i) => [f, perm.mean[i]] as const)) })
  }

  const features = Array.from(new Set(perModel.flatMap((p) => [...p.values.keys()])))
    .sort((a, b) => Math.max(...perModel.map((p) => Math.abs(p.values.get(b) ?? 0))) - Math.max(...perModel.map((p) => Math.abs(p.values.get(a) ?? 0))))
    .slice(0, 15)

  return (
    <ChartContainer
      eyebrow="Across models"
      title="Permutation importance by model"
      note="Cell shading is scaled within each model's own column, so it shows what that model relies on — it does not say one model is better. Rows are ordered by the largest importance in any model. Not causal."
    >
      {details.loading && <LoadingState variant="table" />}
      {perModel.length > 1 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-xs">
            <caption className="sr-only">Permutation importance per feature for each executed model</caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em]">Feature</th>
                {perModel.map((p) => (
                  <th key={p.model} scope="col" className="px-2 py-1.5 text-right font-mono text-[10px] uppercase tracking-[0.1em]">{modelLabel(p.model)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr key={f} className="border-t border-line">
                  <th scope="row" className="px-2 py-1 font-mono font-normal text-muted">{f}</th>
                  {perModel.map((p) => {
                    const v = p.values.get(f)
                    const max = Math.max(...[...p.values.values()].map(Math.abs), 1e-12)
                    return (
                      <td
                        key={p.model}
                        className="px-2 py-1 text-right font-mono tabular-nums text-ink"
                        style={{ backgroundColor: `rgb(56 189 248 / ${v === undefined ? 0 : (Math.abs(v) / max) * 0.35})` }}
                      >
                        {fmt(num(v), 4)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !details.loading && (
          <p className="text-sm text-muted">At least two executed models with permutation importance are needed to compare.</p>
        )
      )}
    </ChartContainer>
  )
}

export function ImportancePage() {
  return (
    <AnalysisFrame
      eyebrow="Analysis · Feature importance"
      title="Feature importance"
      description="Which inputs each model relies on. Importance describes the fitted model's behaviour and does not imply causation."
    >
      {(detail, ctx) => (
        <div className="space-y-6">
          <ImportancePanel detail={detail} />
          <ImportanceComparison experiment={ctx.experiment} />
        </div>
      )}
    </AnalysisFrame>
  )
}

export function ShapPage() {
  return (
    <AnalysisFrame
      eyebrow="Analysis · SHAP"
      title="SHAP analysis"
      description="Model explanation via SHAP values. This explains the trained model's output, not the physics of near-Earth objects."
      explainer={
        <p>
          SHAP attributes a prediction to features by averaging each feature's marginal contribution. Mean |SHAP| ranks
          features by how strongly they move this model's output on average. A large value means the model uses the
          feature, not that the feature causes an object to be hazardous.
        </p>
      }
    >
      {(detail) => <ShapPanel detail={detail} />}
    </AnalysisFrame>
  )
}

export function ErrorsPage() {
  return (
    <AnalysisFrame
      eyebrow="Analysis · Error analysis"
      title="Error analysis"
      description="Where the model disagrees with NASA's label on the held-out test set, using real predictions."
    >
      {(detail) => <ErrorPanel detail={detail} />}
    </AnalysisFrame>
  )
}

export function AnomalyPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Analysis · Anomaly detection"
        title="Anomaly detection"
        description="An unsupervised Isolation Forest scores how statistically unusual each object is in feature space."
      />
      <div className="mb-6">
        <Callout tone="warn" title="Read this first">
          An anomaly is not equivalent to a hazardous asteroid classification. An unusual score can reflect a genuinely
          unusual orbit or simply a data-quality artifact.
        </Callout>
      </div>
      <EmptyResearchState title="ANOMALY SCORES NOT EXPOSED">
        <p>The anomaly pipeline writes its scores to a results file, but the backend does not expose them through the API.</p>
        <p className="mt-1">No scores, distributions or records are shown, and none are estimated.</p>
      </EmptyResearchState>
    </div>
  )
}
