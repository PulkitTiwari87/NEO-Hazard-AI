import { useLimitations } from '../lib/useApi'
import { Callout, PageHeader, ScientificCard, StatusBadge } from '../components/ui'

const POINTS: { title: string; body: string }[] = [
  {
    title: 'Dependence on the NASA target definition',
    body: "The label is NASA/JPL's geometric screening criterion (MOID and absolute-magnitude thresholds). Every model here learns that definition; if it changes, the task changes.",
  },
  {
    title: 'Label leakage',
    body: 'Two fields directly define the label and others are transforms of them. Experiment A therefore recovers a rule rather than discovering signal — which is why the leakage-aware experiments exist.',
  },
  {
    title: 'Possible proxy features',
    body: 'Removing label-defining fields does not guarantee the remaining features are independent of the label. Some may still encode it indirectly, so leakage-aware scores are an upper bound on independent signal.',
  },
  {
    title: 'Dataset coverage',
    body: "The dataset is whatever was ingested from NASA's catalogue, which may be a sample rather than the full population. Conclusions describe that snapshot only.",
  },
  {
    title: 'Data quality',
    body: 'Values are as reported by NASA. Missing fields are left missing and imputed only inside model pipelines. Orbit determinations for poorly observed objects are uncertain.',
  },
  {
    title: 'Generalization',
    body: 'Cross-validation and a single holdout estimate performance on similar objects from the same snapshot. They do not show how a model behaves on newly discovered objects or a different observation regime.',
  },
  {
    title: 'Model uncertainty',
    body: 'A rare positive class makes metrics noisy. Fold spread and bootstrap intervals are shown for exactly that reason; a single score should not be read as precise.',
  },
  {
    title: 'Classification is not physical impact risk',
    body: 'A "potentially hazardous" label is a screening category, not an impact probability. Nothing here predicts an impact or should inform tracking, deflection or civil-response decisions.',
  },
  {
    title: 'Explanations and anomaly scores',
    body: 'SHAP and feature importance describe model behaviour, not orbital physics. An anomaly score measures statistical unusualness and can flag a data artifact as easily as an unusual orbit.',
  },
]

export function Limitations() {
  const scope = useLimitations().data
  const flags: [string, boolean][] = scope
    ? [
        ['Operational hazard system', scope.is_operational_hazard_system],
        ['Predicts impacts', scope.predicts_impacts],
        ['Replaces NASA/JPL assessment', scope.replaces_nasa_jpl_assessment],
      ]
    : []

  return (
    <div>
      <PageHeader
        eyebrow="Reproducibility · Limitations"
        title="Limitations"
        description="What this project can and cannot tell you. Read this before drawing any conclusion, especially about what “potentially hazardous” means."
      />

      <div className="mb-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Callout tone="warn" title="Scope">
          {scope?.summary ??
            'A research and educational ML project. It does not predict asteroid impacts and does not replace NASA/JPL/CNEOS assessments.'}
        </Callout>
        {flags.length > 0 && (
          <ScientificCard eyebrow="Declared by the API" title="Scope flags">
            <ul className="space-y-2">
              {flags.map(([label, value]) => (
                <li key={label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted">{label}</span>
                  <StatusBadge tone={value ? 'danger' : 'ok'}>{value ? 'Yes' : 'No'}</StatusBadge>
                </li>
              ))}
            </ul>
          </ScientificCard>
        )}
      </div>

      <ol className="grid gap-4 md:grid-cols-2">
        {POINTS.map((p, i) => (
          <li key={p.title}>
            <ScientificCard className="h-full" eyebrow={`Limitation ${String(i + 1).padStart(2, '0')}`} title={p.title}>
              <p className="text-sm leading-relaxed text-muted">{p.body}</p>
            </ScientificCard>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-xs text-muted">
        Full statement: <code className="font-mono">docs/LIMITATIONS.md</code>
      </p>
    </div>
  )
}
