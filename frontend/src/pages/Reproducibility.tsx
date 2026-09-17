import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api, type ReproducibilityResponse } from '../api/client'
import { UnavailableNotice } from '../components/UnavailableNotice'
import { StatGrid, StatTile } from '../components/StatTile'

const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }
const spring = { type: 'spring' as const, damping: 1, duration: 0.35 }

export function Reproducibility() {
  const [data, setData] = useState<ReproducibilityResponse | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.reproducibility().then(setData).catch(() => setError(true))
  }, [])

  if (error) return <UnavailableNotice detail="Could not reach the backend." />
  if (!data) return <p className="text-sm text-slate-500">Loading…</p>

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Reproducibility</h2>

      <StatGrid className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Random seed" value={String(data.random_seed)} />
        <StatTile label="CV folds" value={String(data.n_cv_folds)} />
        <StatTile label="Outer test size" value={`${data.outer_test_size * 100}%`} />
        <StatTile label="Feature sets" value={String(data.feature_sets.length)} />
      </StatGrid>

      {!data.last_benchmark_run && (
        <UnavailableNotice detail="python -m src.experiments.run_all has not produced a benchmark run yet." />
      )}
      {data.last_benchmark_run && (
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          transition={spring}
          className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-300"
        >
          <p>Last benchmark run (UTC): {String(data.last_benchmark_run.run_at_utc)}</p>
          <p>Dataset row count at run time: {String(data.last_benchmark_run.dataset_row_count)}</p>
        </motion.div>
      )}

      {data.dataset_provenance && (
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          transition={{ ...spring, delay: 0.05 }}
          className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-300"
        >
          <p className="mb-1 font-medium text-slate-100">Dataset provenance (validation_report.json)</p>
          <p>Source raw file: {String(data.dataset_provenance.source_raw_file)}</p>
          <p>Validated at (UTC): {String(data.dataset_provenance.validated_at_utc)}</p>
        </motion.div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Reproduce with</p>
        <pre className="overflow-auto rounded-lg border border-white/10 bg-black/30 p-4 text-xs text-slate-300">
          {data.reproduce_with.join('\n')}
        </pre>
      </div>

      <p className="text-xs text-slate-500">
        Models evaluated: <span className="font-mono">{data.models.join(', ')}</span>. Feature sets:{' '}
        <span className="font-mono">{data.feature_sets.join(', ')}</span>. Full per-feature reasoning:{' '}
        <code>docs/FEATURE_AUDIT.md</code>.
      </p>
    </div>
  )
}
