import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type DatasetFullResponse, type DatasetQualityResponse } from '../api/client'
import { UnavailableNotice } from '../components/UnavailableNotice'

const PAGE_SIZE = 25

interface RangeFilter {
  min: number
  max: number
}

function RangeInput({
  label,
  bounds,
  value,
  onChange,
}: {
  label: string
  bounds: RangeFilter
  value: RangeFilter
  onChange: (v: RangeFilter) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-slate-500">
        {label} <span className="text-slate-600">[{bounds.min.toPrecision(3)} – {bounds.max.toPrecision(3)}]</span>
      </label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value.min}
          min={bounds.min}
          max={bounds.max}
          step={(bounds.max - bounds.min) / 100 || 1}
          onChange={(e) => onChange({ ...value, min: Number(e.target.value) })}
          className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200"
        />
        <span className="text-slate-600">–</span>
        <input
          type="number"
          value={value.max}
          min={bounds.min}
          max={bounds.max}
          step={(bounds.max - bounds.min) / 100 || 1}
          onChange={(e) => onChange({ ...value, max: Number(e.target.value) })}
          className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200"
        />
      </div>
    </div>
  )
}

const FILTER_FEATURES = [
  { key: 'absolute_magnitude_h', label: 'Absolute magnitude (H)' },
  { key: 'diameter_km_mean', label: 'Diameter mean (km)' },
  { key: 'closest_relative_velocity_km_s', label: 'Relative velocity (km/s)' },
  { key: 'closest_miss_distance_km', label: 'Closest miss distance (km)' },
  { key: 'moid_au', label: 'MOID (au)' },
] as const

export function NeoExplorer() {
  const [dataset, setDataset] = useState<DatasetFullResponse | null>(null)
  const [quality, setQuality] = useState<DatasetQualityResponse | null>(null)
  const [hazardousOnly, setHazardousOnly] = useState(false)
  const [orbitClass, setOrbitClass] = useState('all')
  const [ranges, setRanges] = useState<Record<string, RangeFilter>>({})
  const [page, setPage] = useState(0)

  useEffect(() => {
    api.datasetFull(2000).then(setDataset).catch(() => setDataset({ status: 'unavailable', detail: 'Backend unreachable.', results: [] }))
    api.datasetQuality().then(setQuality).catch(() => null)
  }, [])

  const bounds = useMemo(() => {
    const b: Record<string, RangeFilter> = {}
    for (const f of FILTER_FEATURES) {
      const r = quality?.numeric_ranges?.[f.key]
      if (r) b[f.key] = { min: r.min, max: r.max }
    }
    return b
  }, [quality])

  useEffect(() => {
    if (Object.keys(bounds).length > 0 && Object.keys(ranges).length === 0) {
      setRanges(bounds)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds])

  const orbitClasses = useMemo(() => {
    const cardinality = quality?.categorical_cardinality?.orbit_class_type
    return cardinality ? Object.keys(cardinality.value_counts) : []
  }, [quality])

  const filtered = useMemo(() => {
    if (dataset?.status !== 'ok') return []
    return dataset.results.filter((row) => {
      if (hazardousOnly && !row.is_potentially_hazardous_asteroid) return false
      if (orbitClass !== 'all' && row.orbit_class_type !== orbitClass) return false
      for (const f of FILTER_FEATURES) {
        const range = ranges[f.key]
        if (!range) continue
        const value = row[f.key]
        if (typeof value !== 'number') continue
        if (value < range.min || value > range.max) return false
      }
      return true
    })
  }, [dataset, hazardousOnly, orbitClass, ranges])

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">NEO Explorer</h2>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={hazardousOnly}
            onChange={(e) => {
              setHazardousOnly(e.target.checked)
              setPage(0)
            }}
            className="accent-sky-500"
          />
          Potentially hazardous only
        </label>
      </div>

      {dataset?.status === 'unavailable' && <UnavailableNotice detail={dataset.detail} />}

      {dataset?.status === 'ok' && (
        <>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Filters <span className="text-slate-600">(ranges derived from the actual dataset)</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {FILTER_FEATURES.map((f) =>
                bounds[f.key] && ranges[f.key] ? (
                  <RangeInput
                    key={f.key}
                    label={f.label}
                    bounds={bounds[f.key]}
                    value={ranges[f.key]}
                    onChange={(v) => {
                      setRanges((prev) => ({ ...prev, [f.key]: v }))
                      setPage(0)
                    }}
                  />
                ) : null,
              )}
              {orbitClasses.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-500">Orbit class</label>
                  <select
                    value={orbitClass}
                    onChange={(e) => {
                      setOrbitClass(e.target.value)
                      setPage(0)
                    }}
                    className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="all">All</option>
                    {orbitClasses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {dataset.sampled && <p className="mt-3 text-xs text-amber-300/80">{dataset.sample_note}</p>}
          </div>

          <p className="text-xs text-slate-500">
            {filtered.length} of {dataset.total_count} records match these filters.
          </p>

          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500">No records match this filter.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.04] text-slate-400">
                    <tr>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Hazardous</th>
                      <th className="px-3 py-2">MOID (au)</th>
                      <th className="px-3 py-2">Closest miss (km)</th>
                      <th className="px-3 py-2">Orbit class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => (
                      <tr key={String(row.neo_id)} className="border-t border-white/5 hover:bg-white/[0.02]">
                        <td className="px-3 py-2 font-mono">
                          <Link to={`/neo/${encodeURIComponent(String(row.neo_id))}`} className="text-sky-400 hover:underline">
                            {String(row.neo_id)}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{String(row.name ?? 'N/A')}</td>
                        <td className="px-3 py-2">{row.is_potentially_hazardous_asteroid ? 'Yes' : 'No'}</td>
                        <td className="px-3 py-2 font-mono">{typeof row.moid_au === 'number' ? row.moid_au.toPrecision(4) : 'N/A'}</td>
                        <td className="px-3 py-2 font-mono">
                          {typeof row.closest_miss_distance_km === 'number' ? row.closest_miss_distance_km.toPrecision(5) : 'N/A'}
                        </td>
                        <td className="px-3 py-2">{String(row.orbit_class_type ?? 'N/A')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded border border-white/10 px-3 py-1 disabled:opacity-30"
                >
                  Previous
                </button>
                <span>
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="rounded border border-white/10 px-3 py-1 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
