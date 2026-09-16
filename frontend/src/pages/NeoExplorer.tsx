import { useEffect, useState } from 'react'
import { api, type NeoListResponse } from '../api/client'
import { UnavailableNotice } from '../components/UnavailableNotice'

export function NeoExplorer() {
  const [data, setData] = useState<NeoListResponse | null>(null)
  const [hazardousOnly, setHazardousOnly] = useState(false)

  useEffect(() => {
    api
      .neos({ limit: 25, hazardousOnly })
      .then(setData)
      .catch(() => setData({ status: 'unavailable', detail: 'Backend unreachable.', results: [] }))
  }, [hazardousOnly])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          NEO Explorer
        </h2>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={hazardousOnly}
            onChange={(e) => setHazardousOnly(e.target.checked)}
            className="accent-sky-500"
          />
          Potentially hazardous only
        </label>
      </div>

      {data === null && <p className="text-sm text-slate-500">Loading…</p>}
      {data?.status === 'unavailable' && <UnavailableNotice detail={data.detail} />}
      {data?.status === 'ok' && data.results.length === 0 && (
        <p className="text-sm text-slate-500">No records match this filter.</p>
      )}
      {data?.status === 'ok' && data.results.length > 0 && (
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
              {data.results.map((row) => (
                <tr key={String(row.neo_id)} className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono">{String(row.neo_id)}</td>
                  <td className="px-3 py-2">{String(row.name ?? 'N/A')}</td>
                  <td className="px-3 py-2">{row.is_potentially_hazardous_asteroid ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2">{row.moid_au != null ? String(row.moid_au) : 'N/A'}</td>
                  <td className="px-3 py-2">
                    {row.closest_miss_distance_km != null ? String(row.closest_miss_distance_km) : 'N/A'}
                  </td>
                  <td className="px-3 py-2">{String(row.orbit_class_type ?? 'N/A')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
