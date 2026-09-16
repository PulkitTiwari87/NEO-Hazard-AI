import { useEffect, useState } from 'react'
import { api, type StatisticsResponse } from '../api/client'
import { UnavailableNotice } from '../components/UnavailableNotice'

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-100">{value}</p>
    </div>
  )
}

export function Overview() {
  const [stats, setStats] = useState<StatisticsResponse | null>(null)

  useEffect(() => {
    api.statistics().then(setStats).catch(() => setStats({ status: 'unavailable', detail: 'Backend unreachable.' }))
  }, [])

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] px-6 py-5">
        <p className="text-sm font-medium text-sky-300">Scope statement</p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
          This project trains statistical models on real NASA NeoWs orbital and physical
          features to learn patterns associated with NASA/JPL's own{' '}
          <code className="rounded bg-black/30 px-1">is_potentially_hazardous_asteroid</code> label.
          It is a research/educational ML pipeline — it does not predict asteroid impacts and
          does not replace NASA/JPL/CNEOS assessments. See{' '}
          <a href="/limitations" className="underline hover:text-sky-200">Limitations</a>.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Dataset statistics
        </h2>
        {stats === null && <p className="text-sm text-slate-500">Loading…</p>}
        {stats?.status === 'unavailable' && <UnavailableNotice detail={stats.detail} />}
        {stats?.status === 'ok' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Total objects" value={stats.row_count ?? 'N/A'} />
            <StatTile label="Potentially hazardous" value={stats.hazardous_count ?? 'N/A'} />
            <StatTile label="Not hazardous" value={stats.non_hazardous_count ?? 'N/A'} />
            <StatTile
              label="Class balance"
              value={
                stats.row_count
                  ? `${((100 * (stats.hazardous_count ?? 0)) / stats.row_count).toFixed(1)}%`
                  : 'N/A'
              }
            />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Pipeline stages
        </h2>
        <ol className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
          {[
            'Ingestion — src/data/ingestion.py',
            'Validation — src/data/validation.py',
            'Feature engineering — src/features/engineering.py',
            'Model training — src/models/train.py',
            'Evaluation — src/models/evaluate.py',
            'Anomaly detection — src/anomaly/detect.py',
            'Explainability — src/explainability/shap_analysis.py',
            'API — backend/main.py',
          ].map((step) => (
            <li key={step} className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2">
              {step}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
