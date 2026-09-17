import { useEffect, useState } from 'react'
import { api, type FeatureAuditResponse } from '../api/client'
import { UnavailableNotice } from '../components/UnavailableNotice'

export function FeatureAudit() {
  const [audit, setAudit] = useState<FeatureAuditResponse | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.featureAudit().then(setAudit).catch(() => setError(true))
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Feature audit</h2>
      <p className="max-w-3xl text-sm text-slate-400">
        The Original experiment scored a perfect F1 (1.000) on <code>random_forest</code>/<code>xgboost</code>.
        That's a signal to investigate, not celebrate. This page mirrors <code>docs/FEATURE_AUDIT.md</code> (the source of
        truth) and classifies every feature by whether it directly defines, or is a NASA-side derived transform
        of, the target — see that file for the full per-feature reasoning.
      </p>

      {error && <UnavailableNotice detail="Could not reach the backend." />}
      {!audit && !error && <p className="text-sm text-slate-500">Loading…</p>}

      {audit && (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-rose-700/40 bg-rose-950/20 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-rose-300">
                Category A — label-defining
              </p>
              <p className="mt-2 font-mono text-sm text-rose-100">{audit.label_defining_features.join(', ')}</p>
              <p className="mt-1 text-xs text-rose-200/70">
                NASA/JPL's PHA rule is a direct threshold over these two fields.
              </p>
            </div>
            <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-300">
                Category B — derived from A
              </p>
              <p className="mt-2 font-mono text-sm text-amber-100">{audit.label_derived_features.join(', ')}</p>
              <p className="mt-1 text-xs text-amber-200/70">
                Diameter is computed by NASA from absolute magnitude + an assumed albedo — a transform of a
                Category-A field, not an independent measurement.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Category F — excluded as invalid
              </p>
              <p className="mt-2 font-mono text-sm text-slate-200">
                {audit.epoch_dependent_excluded_features.join(', ')}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Epoch-dependent orbital phase at catalog time, not a fixed property of the object.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Feature sets by experiment
            </h3>
            {Object.entries(audit.feature_sets).map(([key, fs]) => (
              <div key={key} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <p className="text-sm font-medium text-slate-100">{fs.display_name}</p>
                <p className="mt-1 text-xs text-slate-400">{fs.purpose}</p>
                <p className="mt-2 font-mono text-xs text-slate-500">
                  {[...fs.numeric_features, ...fs.categorical_features].join(', ')}
                </p>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
