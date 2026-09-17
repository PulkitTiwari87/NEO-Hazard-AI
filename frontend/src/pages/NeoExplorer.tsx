import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api, type NeoListResponse } from '../api/client'
import { UnavailableNotice } from '../components/UnavailableNotice'

const rowVariants = { hidden: { opacity: 0, x: -6 }, show: { opacity: 1, x: 0 }, exit: { opacity: 0 } }

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
        <motion.label whileTap={{ scale: 0.97 }} className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={hazardousOnly}
            onChange={(e) => setHazardousOnly(e.target.checked)}
            className="accent-sky-500"
          />
          Potentially hazardous only
        </motion.label>
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
              <AnimatePresence initial={false}>
                {data.results.map((row, i) => (
                  <motion.tr
                    key={String(row.neo_id)}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    variants={rowVariants}
                    transition={{ type: 'spring', damping: 1, duration: 0.3, delay: i * 0.015 }}
                    className="border-t border-white/5 hover:bg-white/[0.02]"
                  >
                    <td className="px-3 py-2 font-mono">{String(row.neo_id)}</td>
                    <td className="px-3 py-2">{String(row.name ?? 'N/A')}</td>
                    <td className="px-3 py-2">{row.is_potentially_hazardous_asteroid ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2">{row.moid_au != null ? String(row.moid_au) : 'N/A'}</td>
                    <td className="px-3 py-2">
                      {row.closest_miss_distance_km != null ? String(row.closest_miss_distance_km) : 'N/A'}
                    </td>
                    <td className="px-3 py-2">{String(row.orbit_class_type ?? 'N/A')}</td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
