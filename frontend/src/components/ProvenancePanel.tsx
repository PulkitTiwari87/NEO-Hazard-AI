import type { DataSourceInfo } from '../api/client'
import { asRecord, fmtInt, fmtUtc, str } from '../lib/research'
import { KeyValueList, ScientificCard, StatusBadge } from './ui'

/**
 * Data-provenance record. Every field is read from /api/data-source or the
 * validation report; anything the API does not expose is shown as "—".
 */
export function ProvenancePanel({
  source,
  report,
}: {
  source: DataSourceInfo | null
  report: Record<string, unknown> | null | undefined
}) {
  const schema = asRecord(report?.schema_validation)
  const cleaning = asRecord(report?.cleaning)

  return (
    <ScientificCard
      eyebrow="Provenance record"
      title="NASA / JPL / CNEOS"
      actions={
        source ? (
          <StatusBadge tone={source.ingestion_has_run ? 'ok' : 'warn'}>
            {source.ingestion_has_run ? 'Ingestion has run' : 'Not ingested'}
          </StatusBadge>
        ) : undefined
      }
    >
      <KeyValueList
        columns="sm:grid-cols-2"
        items={[
          { label: 'Source', value: str(source?.source_name) },
          { label: 'Endpoint', value: str(source?.source_url), copy: source?.source_url },
          { label: 'Documentation', value: str(source?.documentation_url) },
          { label: 'Raw files', value: source ? (source.raw_files_present.length ? source.raw_files_present.join(', ') : 'none') : '—' },
          { label: 'Validated at', value: fmtUtc(report?.validated_at_utc) },
          { label: 'Source raw file', value: str(report?.source_raw_file) },
          { label: 'Records retrieved', value: fmtInt(typeof schema?.total_records === 'number' ? schema.total_records : null) },
          {
            label: 'Dropped (id / target / duplicate)',
            value: cleaning
              ? [cleaning.dropped_missing_id, cleaning.dropped_missing_target, cleaning.dropped_duplicate_id].map((v) => str(v)).join(' / ')
              : '—',
          },
        ]}
      />
      <p className="mt-4 text-xs leading-relaxed text-muted">
        Retrieval timestamps and a dataset version identifier are not exposed by the API, so they are not shown here.
        {source?.note ? ` ${source.note}` : ''}
      </p>
    </ScientificCard>
  )
}
