import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api, type DataSourceInfo, type FeaturesResponse } from '../api/client'

const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }
const spring = { type: 'spring' as const, damping: 1, duration: 0.35 }
const rowVariants = { hidden: { opacity: 0, x: -6 }, show: { opacity: 1, x: 0 } }

export function DataProvenance() {
  const [source, setSource] = useState<DataSourceInfo | null>(null)
  const [features, setFeatures] = useState<FeaturesResponse | null>(null)

  useEffect(() => {
    api.dataSource().then(setSource).catch(() => null)
    api.features().then(setFeatures).catch(() => null)
  }, [])

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Source
        </h2>
        {source ? (
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={spring}
            className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] px-5 py-4 text-sm"
          >
            <p>
              <span className="text-slate-500">Name: </span>
              {source.source_name}
            </p>
            <p>
              <span className="text-slate-500">Endpoint: </span>
              <code className="rounded bg-black/30 px-1">{source.source_url}</code>
            </p>
            <p>
              <span className="text-slate-500">Ingestion has run: </span>
              <span className={source.ingestion_has_run ? 'text-emerald-400' : 'text-amber-400'}>
                {source.ingestion_has_run ? 'yes' : 'no'}
              </span>
            </p>
            <p className="text-slate-400">{source.note}</p>
          </motion.div>
        ) : (
          <p className="text-sm text-slate-500">Loading…</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Features
        </h2>
        {features && (
          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-1 text-slate-500">Target column</p>
              <code className="rounded bg-black/30 px-1">{features.target_column}</code>
            </div>
            <div>
              <p className="mb-2 text-slate-500">Derived features</p>
              <div className="overflow-hidden rounded-lg border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.04] text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Formula</th>
                      <th className="px-3 py-2">Unit</th>
                    </tr>
                  </thead>
                  <motion.tbody
                    initial="hidden"
                    animate="show"
                    variants={{ show: { transition: { staggerChildren: 0.04 } } }}
                  >
                    {features.derived_features.map((f) => (
                      <motion.tr
                        key={f.name}
                        variants={rowVariants}
                        transition={{ type: 'spring', damping: 1, duration: 0.3 }}
                        className="border-t border-white/5 hover:bg-white/[0.02]"
                      >
                        <td className="px-3 py-2 font-mono">{f.name}</td>
                        <td className="px-3 py-2 font-mono text-slate-400">{f.formula}</td>
                        <td className="px-3 py-2 text-slate-400">{f.unit}</td>
                      </motion.tr>
                    ))}
                  </motion.tbody>
                </table>
              </div>
              <p className="mt-2 text-slate-500">
                Full rationale for each feature: <code>docs/FEATURES.md</code>
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
