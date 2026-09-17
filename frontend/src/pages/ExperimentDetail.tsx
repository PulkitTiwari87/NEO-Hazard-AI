import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api, type ExperimentDetailResponse } from '../api/client'
import { UnavailableNotice } from '../components/UnavailableNotice'
import { StatGrid, StatTile } from '../components/StatTile'
import { ConfusionMatrixGrid, CvFoldBars, PrCurveChart, RocCurveChart, ThresholdChart } from '../components/charts'

function fmt(value: number | null | undefined, digits = 3): string {
  return value === null || value === undefined ? 'N/A' : value.toFixed(digits)
}

export function ExperimentDetail() {
  const { experiment = '', model = '' } = useParams()
  const [data, setData] = useState<ExperimentDetailResponse | null>(null)

  useEffect(() => {
    setData(null)
    api
      .experimentDetail(experiment, model)
      .then(setData)
      .catch(() => setData({ status: 'unavailable', detail: 'Could not reach the backend.' }))
  }, [experiment, model])

  if (!data) return <p className="text-sm text-slate-500">Loading…</p>
  if (data.status === 'unavailable') {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          {experiment} / {model}
        </h2>
        <UnavailableNotice detail={data.detail} />
      </div>
    )
  }

  const cm = data.confusion_matrix
  const roc = data.roc_curve
  const pr = data.pr_curve
  const ci = data.test_metrics?.f1_bootstrap_ci

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          {String(data.metadata?.experiment_name ?? experiment)} — <span className="font-mono">{model}</span>
        </h2>
        <p className="mt-1 text-xs text-slate-500">{String(data.metadata?.experiment_purpose ?? '')}</p>
      </div>

      <StatGrid className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Test F1" value={fmt(data.test_metrics?.f1 as number)} />
        <StatTile label="Test Precision" value={fmt(data.test_metrics?.precision as number)} />
        <StatTile label="Test Recall" value={fmt(data.test_metrics?.recall as number)} />
        <StatTile label="Test ROC-AUC" value={fmt(data.test_metrics?.roc_auc as number)} />
      </StatGrid>
      {ci && (
        <p className="text-xs text-slate-500">
          F1 bootstrap 95% CI: [{fmt(ci.ci_low)}, {fmt(ci.ci_high)}]
        </p>
      )}

      <section className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Confusion matrix (test)</h3>
          {cm && <ConfusionMatrixGrid matrix={cm.matrix} labels={cm.labels} />}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Cross-validation F1 by fold
          </h3>
          <CvFoldBars folds={(data.fold_metrics ?? []) as Record<string, unknown>[]} metricKey="f1" />
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">ROC curve (test)</h3>
          {roc ? (
            <RocCurveChart fpr={roc.fpr} tpr={roc.tpr} aucLabel={`AUC=${fmt(data.test_metrics?.roc_auc as number)}`} />
          ) : (
            <p className="text-xs text-slate-500">Not available (single-class test fold or model has no predict_proba).</p>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Precision-Recall curve (test)</h3>
          {pr ? (
            <PrCurveChart precision={pr.precision} recall={pr.recall} apLabel={`AP=${fmt(pr.average_precision)}`} />
          ) : (
            <p className="text-xs text-slate-500">Not available.</p>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Threshold analysis (computed on out-of-fold CV predictions, never the test set)
        </h3>
        <ThresholdChart rows={data.threshold_analysis?.grid ?? []} />
        {data.threshold_analysis?.best_by_f1 && (
          <p className="mt-2 text-xs text-slate-500">
            Best F1 on the 0.05-grid: threshold={data.threshold_analysis.best_by_f1.threshold} → F1=
            {fmt(data.threshold_analysis.best_by_f1.f1)}. The test-set evaluation above always uses the model's
            default 0.5 threshold — this grid is diagnostic only, per docs/METHODOLOGY.md.
          </p>
        )}
      </section>

      {data.calibration && (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Calibration</h3>
          <p className="text-xs text-slate-400">Brier score (test): {fmt(data.calibration.brier_score, 4)}</p>
        </section>
      )}

      {data.shap_summary && (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            SHAP global importance (mean |SHAP|, n={data.shap_summary.sample_size} test rows)
          </h3>
          <FeatureBarList entries={Object.entries(data.shap_summary.global_mean_abs_shap).slice(0, 10)} />
        </section>
      )}

      {data.feature_importance?.permutation_importance && (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Permutation importance (test set, scoring=f1)
          </h3>
          <FeatureBarList
            entries={data.feature_importance.permutation_importance.features
              .map((f, i) => [f, data.feature_importance!.permutation_importance.mean[i]] as [string, number])
              .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
              .slice(0, 10)}
          />
        </section>
      )}

      <section className="grid gap-6 sm:grid-cols-2">
        <ErrorTable title="False positives (test)" rows={data.false_positives_sample ?? []} />
        <ErrorTable title="False negatives (test)" rows={data.false_negatives_sample ?? []} />
      </section>
    </div>
  )
}

function FeatureBarList({ entries }: { entries: [string, number][] }) {
  if (!entries.length) return <p className="text-xs text-slate-500">No data.</p>
  const max = Math.max(...entries.map(([, v]) => Math.abs(v)), 1e-9)
  return (
    <div className="space-y-1">
      {entries.map(([name, value], i) => (
        <div key={name} className="flex items-center gap-2 text-xs">
          <span className="w-56 truncate font-mono text-slate-400">{name}</span>
          <div className="h-3 flex-1 rounded bg-white/[0.04]">
            <motion.div
              className="h-3 rounded bg-sky-500/60"
              initial={{ width: 0 }}
              animate={{ width: `${(Math.abs(value) / max) * 100}%` }}
              transition={{ type: 'spring', damping: 1, duration: 0.5, delay: i * 0.03 }}
            />
          </div>
          <span className="w-16 text-right font-mono text-slate-500">{value.toFixed(4)}</span>
        </div>
      ))}
    </div>
  )
}

function ErrorTable({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">None on this test set.</p>
      ) : (
        <div className="max-h-64 overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-white/[0.04] text-slate-500">
              <tr>
                <th className="px-2 py-1">neo_id</th>
                <th className="px-2 py-1">probability</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.neo_id)} className="border-t border-white/5">
                  <td className="px-2 py-1 font-mono">{String(row.neo_id)}</td>
                  <td className="px-2 py-1 font-mono">
                    {typeof row.model_probability === 'number' ? row.model_probability.toFixed(3) : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
