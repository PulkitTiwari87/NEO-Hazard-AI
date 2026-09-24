import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api, type StatisticsResponse } from '../api/client'
import { UnavailableNotice } from '../components/UnavailableNotice'
import { StatGrid, StatTile } from '../components/StatTile'

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

export function Overview() {
  const [stats, setStats] = useState<StatisticsResponse | null>(null)

  useEffect(() => {
    api.statistics().then(setStats).catch(() => setStats({ status: 'unavailable', detail: 'Backend unreachable.' }))
  }, [])

  return (
    <div className="space-y-8">
      <motion.section
        initial="hidden"
        animate="show"
        variants={fadeUp}
        transition={{ type: 'spring', damping: 1, duration: 0.4 }}
        className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] px-6 py-5"
      >
        <p className="text-sm font-medium text-sky-300">Scope statement</p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
          This project trains statistical models on real NASA NeoWs orbital and physical
          features to learn patterns associated with NASA/JPL's own{' '}
          <code className="rounded bg-black/30 px-1">is_potentially_hazardous_asteroid</code> label.
          It is a research/educational ML pipeline — it does not predict asteroid impacts and
          does not replace NASA/JPL/CNEOS assessments. See{' '}
          <a href="/limitations" className="underline hover:text-sky-200">Limitations</a>.
        </p>
      </motion.section>

      <motion.section
        initial="hidden"
        animate="show"
        variants={fadeUp}
        transition={{ type: 'spring', damping: 1, duration: 0.4, delay: 0.05 }}
        className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-6 py-5"
      >
        <p className="text-sm font-medium text-emerald-300">Research question</p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
          The original feature set includes <code>moid_au</code> and <code>absolute_magnitude_h</code> — the two
          fields NASA/JPL's own PHA rule directly thresholds — which is why the tree models score near-perfectly
          there (see <a href="/original-experiment" className="underline hover:text-emerald-200">Experiment A</a>).
          The primary research question this project now asks is: after removing those features (and everything
          derived from them), how much signal is actually left? See{' '}
          <a href="/feature-audit" className="underline hover:text-emerald-200">Feature Audit</a> and{' '}
          <a href="/experiments" className="underline hover:text-emerald-200">Experiments</a>.
        </p>
      </motion.section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Dataset statistics
        </h2>
        {stats === null && <p className="text-sm text-slate-500">Loading…</p>}
        {stats?.status === 'unavailable' && <UnavailableNotice detail={stats.detail} />}
        {stats?.status === 'ok' && (
          <StatGrid className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          </StatGrid>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Pipeline stages
        </h2>
        <motion.ol
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.04 } } }}
          className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2"
        >
          {[
            'Ingestion — src/data/ingestion.py',
            'Validation — src/data/validation.py',
            'Feature engineering — src/features/engineering.py',
            'Model training — src/models/train.py',
            'Evaluation — src/models/evaluate.py',
            'Leakage-aware benchmark — src/experiments/run_all.py',
            'Anomaly detection — src/anomaly/detect.py',
            'Explainability — src/explainability/shap_analysis.py',
            'API — backend/main.py',
          ].map((step) => (
            <motion.li
              key={step}
              variants={fadeUp}
              transition={{ type: 'spring', damping: 1, duration: 0.3 }}
              className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2"
            >
              {step}
            </motion.li>
          ))}
        </motion.ol>
      </section>
    </div>
  )
}
