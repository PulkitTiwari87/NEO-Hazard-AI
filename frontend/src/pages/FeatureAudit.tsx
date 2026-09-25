import { useFeatureAudit, useFeatures } from '../lib/useApi'
import { FeatureAuditMatrix } from '../components/FeatureAuditMatrix'
import { ErrorState, LoadingState, PageHeader } from '../components/ui'

export function FeatureAudit() {
  const audit = useFeatureAudit()
  const features = useFeatures()

  return (
    <div>
      <PageHeader
        eyebrow="Research · Feature audit"
        title="Feature audit"
        description="A near-perfect score is a signal to investigate, not celebrate. This audit classifies every feature by whether it defines, or is a NASA-side transform of, the target — the reason Experiments B–D exist."
        meta={[{ label: 'Source of truth', value: audit.data?.documentation ?? 'docs/FEATURE_AUDIT.md' }]}
      />
      {audit.loading && <LoadingState variant="table" />}
      {audit.error && <ErrorState />}
      {audit.data && <FeatureAuditMatrix audit={audit.data} features={features.data} />}
    </div>
  )
}
