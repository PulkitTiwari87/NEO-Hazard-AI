import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api,
  EXPERIMENT_LABEL,
  type DataSourceInfo,
  type ExperimentsIndexResponse,
  type StatisticsResponse,
} from '../api/client'
import { UnavailableNotice } from '../components/UnavailableNotice'

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-slate-100">{value}</p>
    </div>
  )
}

function NavCard({ to, title, description }: { to: string; title: string; description: string }) {
  return (
    <Link to={to} className="rounded-lg border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-sky-500/40 hover:bg-white/[0.04]">
      <p className="text-sm font-medium text-slate-100">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </Link>
  )
}

export function Overview() {
  const [stats, setStats] = useState<StatisticsResponse | null>(null)
  const [source, setSource] = useState<DataSourceInfo | null>(null)
  const [experiments, setExperiments] = useState<ExperimentsIndexResponse | null>(null)

  useEffect(() => {
    api.statistics().then(setStats).catch(() => setStats({ status: 'unavailable', detail: 'Backend unreachable.' }))
    api.dataSource().then(setSource).catch(() => null)
    api.experiments().then(setExperiments).catch(() => null)
  }, [])

  const definitions = experiments?.experiment_definitions ?? experiments?.experiments ?? {}

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">NEO-Hazard-AI — research laboratory</p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
          <span className="font-medium text-slate-100">Research question: </span>
          how well can a statistical model recover NASA/JPL's own{' '}
          <code className="rounded bg-black/30 px-1">is_potentially_hazardous_asteroid</code> classification from
          an object's other NASA-provided orbital and physical features — and, separately, which objects look
          statistically unusual in that same feature space?
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
          This is a research/educational ML pipeline over real NASA NeoWs data. It does not predict asteroid
          impacts and does not replace NASA/JPL/CNEOS assessments. See{' '}
          <Link to="/limitations" className="underline hover:text-sky-200">Limitations</Link>.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
          <span><span className="text-slate-500">Dataset source: </span>{source?.source_name ?? 'loading…'}</span>
          <span><span className="text-slate-500">Ingestion has run: </span>{source ? (source.ingestion_has_run ? 'yes' : 'no') : '…'}</span>
          <span>
            <span className="text-slate-500">Experiments generated: </span>
            {experiments?.generated_at_utc ? new Date(experiments.generated_at_utc).toUTCString() : 'not yet run'}
          </span>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Dataset overview</h2>
        {stats === null && <p className="text-sm text-slate-500">Loading…</p>}
        {stats?.status === 'unavailable' && <UnavailableNotice detail={stats.detail} />}
        {stats?.status === 'ok' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Total objects" value={stats.row_count ?? 'N/A'} />
            <StatTile label="Potentially hazardous" value={stats.hazardous_count ?? 'N/A'} />
            <StatTile label="Not hazardous" value={stats.non_hazardous_count ?? 'N/A'} />
            <StatTile
              label="Class balance"
              value={stats.row_count ? `${((100 * (stats.hazardous_count ?? 0)) / stats.row_count).toFixed(1)}%` : 'N/A'}
            />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Experimental setup</h2>
        {Object.keys(definitions).length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.values(definitions).map((exp) => (
              <div key={exp.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <p className="text-sm font-medium text-slate-200">{EXPERIMENT_LABEL[exp.id as keyof typeof EXPERIMENT_LABEL] ?? exp.name}</p>
                <p className="mt-1 text-xs text-slate-500">{exp.purpose}</p>
              </div>
            ))}
          </div>
        ) : (
          <UnavailableNotice detail="Experiments have not been run yet. Run `python -m src.experiments.run_all`." />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Explore the research</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NavCard to="/dataset" title="Dataset & Data Quality" description="Stats, missing values, cleaning report, feature definitions." />
          <NavCard to="/explore" title="Exploratory Analysis" description="Distributions, correlation matrix, bivariate & target analysis." />
          <NavCard to="/experiments" title="Experiment Comparison" description="Experiment A vs B, model comparison matrix." />
          <NavCard to="/models" title="Model Performance" description="Cross-validation, confusion matrices, ROC/PR, threshold, calibration." />
          <NavCard to="/explainability" title="Feature Importance & SHAP" description="Global and local explainability." />
          <NavCard to="/errors" title="Error Analysis" description="False positives, false negatives, individual record inspection." />
          <NavCard to="/anomalies" title="Anomaly Detection" description="Isolation Forest anomaly scores and top outliers." />
          <NavCard to="/explorer" title="NEO Explorer" description="Filter and browse individual objects." />
          <NavCard to="/methodology" title="Methodology & Reproducibility" description="Research report, provenance, reproduction commands." />
        </div>
      </section>
    </div>
  )
}
