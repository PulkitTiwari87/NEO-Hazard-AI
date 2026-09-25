import { EXPERIMENTS } from '../lib/research'
import { useFeatureAudit, useReproducibility } from '../lib/useApi'
import { FeatureBadge } from '../components/FeatureAuditMatrix'
import {
  Callout,
  ErrorState,
  LoadingState,
  MetricCard,
  MetricGrid,
  MonoTag,
  PageHeader,
  ResearchSection,
  ScientificCard,
} from '../components/ui'

export function ExperimentDesign() {
  const audit = useFeatureAudit()
  const repro = useReproducibility()
  const a = audit.data

  const category = (f: string): 'A' | 'B' | 'F' | undefined =>
    a?.label_defining_features.includes(f)
      ? 'A'
      : a?.label_derived_features.includes(f)
        ? 'B'
        : a?.epoch_dependent_excluded_features.includes(f)
          ? 'F'
          : undefined

  return (
    <div>
      <PageHeader
        eyebrow="Research · Experiment design"
        title="Experiment design"
        description="Four controlled feature sets isolate how much signal survives once label-defining features are removed. Everything else — splits, seed, models — is held constant."
      />

      <ResearchSection id="protocol" eyebrow="Fixed protocol" title="What stays constant">
        <MetricGrid>
          <MetricCard label="Random seed" value={repro.data?.random_seed ?? null} sub="All splits and models" />
          <MetricCard label="CV folds" value={repro.data?.n_cv_folds ?? null} sub="Stratified, on the training split" />
          <MetricCard label="Holdout" value={repro.data ? `${repro.data.outer_test_size * 100}%` : null} sub="Never used for tuning" />
          <MetricCard label="Models" value={repro.data?.models.length ?? null} sub="Same set in every experiment" />
        </MetricGrid>
        <div className="mt-4">
          <Callout tone="info" title="Method, as documented">
            Hyperparameters are tuned inside the training split's cross-validation folds. The threshold sweep uses
            out-of-fold predictions. The holdout test set is evaluated once. See <code className="font-mono">docs/METHODOLOGY.md</code>.
          </Callout>
        </div>
      </ResearchSection>

      <ResearchSection id="sets" eyebrow="Feature sets" title="Experiments A–D" description="Badges: A label-defining · B derived from A · F excluded. Unmarked features are retained without a Category A/B/F flag.">
        {audit.loading && <LoadingState variant="table" />}
        {audit.error && <ErrorState />}
        {a && (
          <div className="grid gap-4 lg:grid-cols-2">
            {EXPERIMENTS.map((e) => {
              const fs = a.feature_sets[e.key]
              if (!fs) return null
              const cols = [...fs.numeric_features, ...fs.categorical_features]
              return (
                <ScientificCard key={e.key} eyebrow={e.tag} title={fs.display_name}>
                  <p className="text-sm leading-relaxed text-muted">{fs.purpose}</p>
                  <MonoTag className="mt-4 block">
                    {fs.numeric_features.length} numeric · {fs.categorical_features.length} categorical
                  </MonoTag>
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${e.tag} features`}>
                    {cols.map((f) => (
                      <li key={f}>
                        <FeatureBadge name={f} category={category(f)} />
                      </li>
                    ))}
                  </ul>
                </ScientificCard>
              )
            })}
          </div>
        )}
      </ResearchSection>
    </div>
  )
}
