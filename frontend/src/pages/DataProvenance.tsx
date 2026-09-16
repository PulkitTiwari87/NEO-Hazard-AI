import { useEffect, useState } from 'react'
import { api, type DataSourceInfo, type FeaturesResponse } from '../api/client'

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
          <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] px-5 py-4 text-sm">
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
          </div>
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
                  <tbody>
                    {features.derived_features.map((f) => (
                      <tr key={f.name} className="border-t border-white/5">
                        <td className="px-3 py-2 font-mono">{f.name}</td>
                        <td className="px-3 py-2 font-mono text-slate-400">{f.formula}</td>
                        <td className="px-3 py-2 text-slate-400">{f.unit}</td>
                      </tr>
                    ))}
                  </tbody>
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
