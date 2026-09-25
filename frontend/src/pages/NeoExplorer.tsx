import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { fmt, fmtInt, num, str } from '../lib/research'
import { useApi } from '../lib/useApi'
import { DataTable, type Column } from '../components/DataTable'
import {
  CopyButton,
  EmptyResearchState,
  ErrorState,
  KeyValueList,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../components/ui'

type Neo = Record<string, unknown>

// Candidate numeric columns; only those actually present in the data are shown.
const NUMERIC: { key: string; header: string; digits?: number }[] = [
  { key: 'moid_au', header: 'MOID (au)', digits: 5 },
  { key: 'eccentricity', header: 'Eccentricity', digits: 4 },
  { key: 'semi_major_axis_au', header: 'Semi-major axis (au)', digits: 4 },
  { key: 'inclination_deg', header: 'Inclination (°)', digits: 3 },
  { key: 'closest_miss_distance_km', header: 'Closest miss (km)', digits: 0 },
  { key: 'closest_relative_velocity_km_s', header: 'Velocity (km/s)', digits: 2 },
]

export function NeoExplorer() {
  const neos = useApi('neos:1000', () => api.neos({ limit: 1000 }))
  const [query, setQuery] = useState('')
  const [label, setLabel] = useState<'all' | 'hazardous' | 'not'>('all')
  const [orbit, setOrbit] = useState('all')
  const [pageSize, setPageSize] = useState(25)

  const all: Neo[] = useMemo(() => (neos.data?.status === 'ok' ? neos.data.results : []), [neos.data])
  const total = neos.data?.status === 'ok' ? (neos.data.total_count ?? all.length) : 0
  const orbitClasses = useMemo(() => Array.from(new Set(all.map((r) => str(r.orbit_class_type)).filter((v) => v !== '—'))).sort(), [all])

  const q = query.trim().toLowerCase()
  const rows = all.filter(
    (r) =>
      (label === 'all' || (label === 'hazardous') === (r.is_potentially_hazardous_asteroid === true)) &&
      (orbit === 'all' || str(r.orbit_class_type) === orbit) &&
      (!q || String(r.neo_id).toLowerCase().includes(q) || String(r.name ?? '').toLowerCase().includes(q)),
  )

  const columns: Column<Neo>[] = [
    {
      key: 'neo_id',
      header: 'NEO ID',
      sortValue: (r) => str(r.neo_id),
      render: (r) => (
        <span className="flex items-center gap-1">
          <Link to={`/neo/${encodeURIComponent(String(r.neo_id))}`} className="font-mono text-accent hover:underline">
            {String(r.neo_id)}
          </Link>
          <CopyButton text={String(r.neo_id)} label={`Copy NEO ID ${String(r.neo_id)}`} />
        </span>
      ),
    },
    { key: 'name', header: 'Name', sortValue: (r) => str(r.name), render: (r) => str(r.name) },
    {
      key: 'label',
      header: 'Hazard label',
      sortValue: (r) => (r.is_potentially_hazardous_asteroid === true ? 1 : 0),
      render: (r) =>
        r.is_potentially_hazardous_asteroid === true ? (
          <StatusBadge tone="warn">Potentially hazardous</StatusBadge>
        ) : (
          <StatusBadge tone="idle">Not hazardous</StatusBadge>
        ),
    },
    ...NUMERIC.filter((c) => all.some((r) => num(r[c.key]) !== null)).map<Column<Neo>>((c) => ({
      key: c.key,
      header: c.header,
      align: 'right',
      className: 'font-mono',
      sortValue: (r) => num(r[c.key]),
      render: (r) => fmt(num(r[c.key]), c.digits ?? 3),
    })),
    { key: 'orbit', header: 'Orbit class', sortValue: (r) => str(r.orbit_class_type), render: (r) => str(r.orbit_class_type) },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Data · NEO explorer"
        title="NEO explorer"
        description="Search, filter and sort the validated NASA dataset. The hazard label is NASA/JPL's own classification, not a model output."
      />

      {neos.loading && <LoadingState variant="table" />}
      {neos.error && <ErrorState />}
      {neos.data?.status === 'unavailable' && (
        <EmptyResearchState title="DATASET NOT AVAILABLE">
          <p>No NASA data has been ingested and validated yet.</p>
          {neos.data.detail && <p className="mt-2 font-mono text-[11px] text-faint">{neos.data.detail}</p>}
        </EmptyResearchState>
      )}

      {neos.data?.status === 'ok' && (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="neo-search" className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Search</label>
              <input
                id="neo-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="NEO ID or name"
                className="w-56 rounded-sm border border-line bg-surface px-3 py-1.5 font-mono text-xs text-ink placeholder:text-faint"
              />
            </div>
            <div>
              <label htmlFor="neo-label" className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Hazard label</label>
              <select id="neo-label" value={label} onChange={(e) => setLabel(e.target.value as typeof label)} className="rounded-sm border border-line bg-surface px-2.5 py-1.5 text-xs text-ink">
                <option value="all">All</option>
                <option value="hazardous">Potentially hazardous</option>
                <option value="not">Not hazardous</option>
              </select>
            </div>
            {orbitClasses.length > 0 && (
              <div>
                <label htmlFor="neo-orbit" className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Orbit class</label>
                <select id="neo-orbit" value={orbit} onChange={(e) => setOrbit(e.target.value)} className="rounded-sm border border-line bg-surface px-2.5 py-1.5 text-xs text-ink">
                  <option value="all">All</option>
                  {orbitClasses.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
            <p className="ml-auto font-mono text-[11px] text-muted" aria-live="polite">
              {fmtInt(rows.length)} of {fmtInt(all.length)} loaded{total > all.length ? ` (dataset: ${fmtInt(total)})` : ''}
            </p>
          </div>

          <DataTable
            caption="Near-Earth objects in the validated dataset"
            columns={columns}
            rows={rows}
            rowKey={(r) => String(r.neo_id)}
            initialSort={{ key: 'neo_id', dir: 'asc' }}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            empty={
              <EmptyResearchState compact title="NO MATCHING OBJECTS">
                <p>No loaded record matches these filters.</p>
                {q && total > all.length && (
                  <p className="mt-2">
                    Only part of the dataset is loaded.{' '}
                    <Link to={`/neo/${encodeURIComponent(query.trim())}`} className="text-accent underline underline-offset-2">
                      Look up “{query.trim()}” directly
                    </Link>
                    .
                  </p>
                )}
              </EmptyResearchState>
            }
            renderExpanded={(r) => (
              <div>
                <KeyValueList
                  columns="sm:grid-cols-2 lg:grid-cols-4"
                  items={[
                    ['Eccentricity', 'eccentricity'],
                    ['Semi-major axis (au)', 'semi_major_axis_au'],
                    ['Inclination (°)', 'inclination_deg'],
                    ['Perihelion (au)', 'perihelion_distance_au'],
                    ['Aphelion (au)', 'aphelion_distance_au'],
                    ['Closest approach', 'closest_approach_date'],
                    ['Data arc (days)', 'data_arc_in_days'],
                    ['Observations', 'observations_used'],
                  ]
                    .filter(([, k]) => r[k] !== null && r[k] !== undefined && r[k] !== '')
                    .map(([labelText, k]) => ({ label: labelText, value: typeof r[k] === 'number' ? fmt(r[k] as number, 4) : str(r[k]) }))}
                />
                <Link to={`/neo/${encodeURIComponent(String(r.neo_id))}`} className="mt-3 inline-block text-xs text-accent underline underline-offset-2">
                  Open full profile →
                </Link>
              </div>
            )}
          />
        </>
      )}
    </div>
  )
}
