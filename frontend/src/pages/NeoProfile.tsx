import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { str } from '../lib/research'
import { useApi } from '../lib/useApi'
import { NEOProfile } from '../components/NEOProfile'
import { EmptyResearchState, ErrorState, LoadingState, PageHeader } from '../components/ui'

export function NeoProfilePage() {
  const { id = '' } = useParams()
  const { data, error, loading } = useApi(`neo:${id}`, () => api.neo(id))
  // The backend answers 404 with { detail } — a missing id is a normal state, not a crash.
  const record = data && 'neo_id' in data ? data : null

  return (
    <div>
      <p className="mb-4 text-xs">
        <Link to="/explorer" className="text-accent underline underline-offset-2">← NEO explorer</Link>
      </p>
      {loading && <LoadingState variant="page" />}
      {error && <ErrorState />}
      {data && !record && (
        <EmptyResearchState title="NEO NOT FOUND">
          <p>No object with id “{id}” exists in the validated dataset.</p>
          {typeof data.detail === 'string' && <p className="mt-2 font-mono text-[11px] text-faint">{data.detail}</p>}
        </EmptyResearchState>
      )}
      {record && (
        <>
          <PageHeader
            eyebrow="Observation record"
            title={`NEO-${String(record.neo_id)}`}
            description={typeof record.name === 'string' ? record.name : undefined}
            meta={[
              { label: 'NEO ID', value: String(record.neo_id), copy: String(record.neo_id) },
              { label: 'Designation', value: str(record.designation) },
              { label: 'Orbit class', value: str(record.orbit_class_type) },
              { label: 'Source', value: 'NASA / JPL / CNEOS' },
            ]}
          />
          <NEOProfile record={record} />
        </>
      )}
    </div>
  )
}
