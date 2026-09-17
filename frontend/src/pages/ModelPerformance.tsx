import { useEffect, useMemo, useState } from 'react'
import {
  api,
  MODEL_COLOR,
  MODEL_LABEL,
  MODEL_NAMES,
  type CalibrationResponse,
  type CvResponse,
  type ExperimentId,
  type HoldoutResponse,
  type ModelName,
  type ThresholdResponse,
} from '../api/client'
import { ChartCard } from '../components/ChartCard'
import { UnavailableNotice } from '../components/UnavailableNotice'
import { ExperimentSelector } from '../components/research/ExperimentSelector'
import { ModelSelector } from '../components/research/ModelSelector'
import { MetricCard } from '../components/research/MetricCard'
import { MethodologyPanel } from '../components/research/MethodologyPanel'
import { ResearchNotes } from '../components/research/ResearchNotes'
import { ConfusionMatrix } from '../components/charts/ConfusionMatrix'
import { ROCCurve, type RocSeries } from '../components/charts/ROCCurve'
import { PRCurve, type PrSeries } from '../components/charts/PRCurve'
import { CVFoldChart } from '../components/charts/CVFoldChart'
import { ThresholdCurve } from '../components/charts/ThresholdCurve'
import { CalibrationCurve } from '../components/charts/CalibrationCurve'

const TABS = ['overview', 'cv', 'confusion', 'roc_pr', 'threshold', 'calibration'] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL: Record<Tab, string> = {
  overview: 'Overview',
  cv: 'Cross-Validation',
  confusion: 'Confusion Matrix Lab',
  roc_pr: 'ROC & PR',
  threshold: 'Threshold Analysis',
  calibration: 'Calibration',
}

const METRIC_DESCRIPTIONS: Record<string, string> = {
  accuracy: 'Overall fraction of correctly classified records.',
  precision: 'Fraction of predicted-positive records that were positive in the evaluated data.',
  recall: 'Fraction of positive records detected in the evaluated data.',
  f1: 'Harmonic mean of precision and recall.',
  roc_auc: 'Ranking discrimination measure calculated on the evaluated data — not an impact probability.',
  pr_auc: 'Precision-recall summary, informative when the positive class is less prevalent.',
}

export function ModelPerformance() {
  const [experimentId, setExperimentId] = useState<ExperimentId>('experiment_a_original')
  const [modelName, setModelName] = useState<ModelName>('random_forest')
  const [tab, setTab] = useState<Tab>('overview')

  const [holdout, setHoldout] = useState<HoldoutResponse | null>(null)
  const [cv, setCv] = useState<CvResponse | null>(null)
  const [threshold, setThreshold] = useState<ThresholdResponse | null>(null)
  const [calibration, setCalibration] = useState<CalibrationResponse | null>(null)
  const [allModelHoldouts, setAllModelHoldouts] = useState<Partial<Record<ModelName, HoldoutResponse>>>({})
  const [confusionSource, setConfusionSource] = useState<string>('holdout')

  useEffect(() => {
    setHoldout(null)
    setCv(null)
    setThreshold(null)
    setCalibration(null)
    setConfusionSource('holdout')
    api.experimentHoldout(experimentId, modelName).then(setHoldout).catch(() => null)
    api.experimentCv(experimentId, modelName).then(setCv).catch(() => null)
    api.experimentThreshold(experimentId, modelName).then(setThreshold).catch(() => null)
    api.experimentCalibration(experimentId, modelName).then(setCalibration).catch(() => null)
  }, [experimentId, modelName])

  useEffect(() => {
    setAllModelHoldouts({})
    MODEL_NAMES.forEach((name) => {
      api
        .experimentHoldout(experimentId, name)
        .then((res) => setAllModelHoldouts((prev) => ({ ...prev, [name]: res })))
        .catch(() => null)
    })
  }, [experimentId])

  const rocSeries: RocSeries[] = useMemo(
    () =>
      MODEL_NAMES.filter((name) => allModelHoldouts[name]?.status === 'ok' && allModelHoldouts[name]?.metrics?.roc_curve).map(
        (name) => ({
          key: name,
          name: MODEL_LABEL[name],
          color: MODEL_COLOR[name],
          fpr: allModelHoldouts[name]!.metrics!.roc_curve!.fpr,
          tpr: allModelHoldouts[name]!.metrics!.roc_curve!.tpr,
          auc: allModelHoldouts[name]!.metrics!.roc_auc,
        }),
      ),
    [allModelHoldouts],
  )
  const baselinePrevalence = useMemo(() => {
    const cm = holdout?.status === 'ok' ? holdout.metrics?.confusion_matrix?.matrix : undefined
    if (!cm) return null
    const total = cm[0][0] + cm[0][1] + cm[1][0] + cm[1][1]
    const positives = cm[1][0] + cm[1][1]
    return total > 0 ? positives / total : null
  }, [holdout])

  const prSeries: PrSeries[] = useMemo(
    () =>
      MODEL_NAMES.filter((name) => allModelHoldouts[name]?.status === 'ok' && allModelHoldouts[name]?.metrics?.pr_curve).map(
        (name) => ({
          key: name,
          name: MODEL_LABEL[name],
          color: MODEL_COLOR[name],
          recall: allModelHoldouts[name]!.metrics!.pr_curve!.recall,
          precision: allModelHoldouts[name]!.metrics!.pr_curve!.precision,
          auc: allModelHoldouts[name]!.metrics!.pr_auc,
        }),
      ),
    [allModelHoldouts],
  )

  const methodologyItems = holdout?.status === 'ok'
    ? [
        { label: 'Experiment', value: experimentId },
        { label: 'Model', value: modelName },
        { label: 'Random seed', value: holdout.random_seed },
        { label: 'Test size', value: holdout.test_size },
        { label: 'Train rows', value: holdout.train_rows },
        { label: 'Holdout rows', value: holdout.holdout_rows },
        { label: 'Trained at (UTC)', value: holdout.trained_at_utc },
        { label: 'CV folds', value: cv?.folds },
        { label: 'CV strategy', value: cv?.strategy },
      ]
    : []

  const confusionMatrix =
    confusionSource === 'holdout'
      ? holdout?.status === 'ok'
        ? holdout.metrics?.confusion_matrix
        : undefined
      : cv?.status === 'ok'
        ? cv.fold_results?.find((f) => `fold-${f.fold}` === confusionSource)?.confusion_matrix
        : undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Model Performance</h2>
          <p className="mt-1 text-sm text-slate-400">Cross-validation, confusion matrices, ROC/PR, threshold and calibration analysis.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExperimentSelector value={experimentId} onChange={setExperimentId} />
          <ModelSelector value={modelName} onChange={setModelName} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-md border border-white/10 bg-black/20 p-1 text-xs w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1.5 ${tab === t ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-100'}`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {holdout?.status === 'unavailable' && (
        <UnavailableNotice detail={holdout.detail ?? 'Run `python -m src.experiments.run_all`.'} />
      )}

      {tab === 'overview' && holdout?.status === 'ok' && holdout.metrics && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="Accuracy" value={holdout.metrics.accuracy} description={METRIC_DESCRIPTIONS.accuracy} />
            <MetricCard label="Precision" value={holdout.metrics.precision} description={METRIC_DESCRIPTIONS.precision} />
            <MetricCard label="Recall" value={holdout.metrics.recall} description={METRIC_DESCRIPTIONS.recall} />
            <MetricCard label="F1" value={holdout.metrics.f1} description={METRIC_DESCRIPTIONS.f1} />
            <MetricCard label="ROC-AUC" value={holdout.metrics.roc_auc} description={METRIC_DESCRIPTIONS.roc_auc} />
            <MetricCard label="PR-AUC" value={holdout.metrics.pr_auc} description={METRIC_DESCRIPTIONS.pr_auc} />
          </div>
          {cv?.status === 'ok' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <MetricCard label="CV Accuracy" value={cv.accuracy?.mean} std={cv.accuracy?.std} description="Mean ± std across folds" />
              <MetricCard label="CV Precision" value={cv.precision?.mean} std={cv.precision?.std} description="Mean ± std across folds" />
              <MetricCard label="CV Recall" value={cv.recall?.mean} std={cv.recall?.std} description="Mean ± std across folds" />
              <MetricCard label="CV F1" value={cv.f1?.mean} std={cv.f1?.std} description="Mean ± std across folds" />
              <MetricCard label="CV ROC-AUC" value={cv.roc_auc?.mean} std={cv.roc_auc?.std} description="Mean ± std across folds" />
              <MetricCard label="CV PR-AUC" value={cv.pr_auc?.mean} std={cv.pr_auc?.std} description="Mean ± std across folds" />
            </div>
          )}
          <MethodologyPanel items={methodologyItems} />
        </div>
      )}

      {tab === 'cv' && cv?.status === 'unavailable' && <UnavailableNotice detail={cv.detail} />}
      {tab === 'cv' && cv?.status === 'ok' && cv.fold_results && (
        <div className="space-y-4">
          <ResearchNotes
            title="Model stability"
            notes={[
              `${cv.folds}-fold stratified cross-validation over the training pool only (holdout untouched). A large spread across folds means performance depends on which rows land in which fold — not just the model choice.`,
            ]}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="F1 by fold" note="Dashed line = mean across folds.">
              <CVFoldChart folds={cv.fold_results} metric="f1" mean={cv.f1?.mean} color={MODEL_COLOR[modelName]} />
            </ChartCard>
            <ChartCard title="ROC-AUC by fold">
              <CVFoldChart folds={cv.fold_results} metric="roc_auc" mean={cv.roc_auc?.mean} color={MODEL_COLOR[modelName]} />
            </ChartCard>
            <ChartCard title="PR-AUC by fold">
              <CVFoldChart folds={cv.fold_results} metric="pr_auc" mean={cv.pr_auc?.mean} color={MODEL_COLOR[modelName]} />
            </ChartCard>
            <ChartCard title="Accuracy by fold">
              <CVFoldChart folds={cv.fold_results} metric="accuracy" mean={cv.accuracy?.mean} color={MODEL_COLOR[modelName]} />
            </ChartCard>
          </div>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr>
                  <th className="px-3 py-2">Fold</th>
                  <th className="px-3 py-2">Train / Val rows</th>
                  <th className="px-3 py-2">Accuracy</th>
                  <th className="px-3 py-2">Precision</th>
                  <th className="px-3 py-2">Recall</th>
                  <th className="px-3 py-2">F1</th>
                  <th className="px-3 py-2">ROC-AUC</th>
                  <th className="px-3 py-2">PR-AUC</th>
                </tr>
              </thead>
              <tbody>
                {cv.fold_results.map((f) => (
                  <tr key={f.fold} className="border-t border-white/5">
                    <td className="px-3 py-2">Fold {f.fold}</td>
                    <td className="px-3 py-2 font-mono text-slate-400">{f.train_rows} / {f.val_rows}</td>
                    <td className="px-3 py-2 font-mono">{f.accuracy.toFixed(3)}</td>
                    <td className="px-3 py-2 font-mono">{f.precision.toFixed(3)}</td>
                    <td className="px-3 py-2 font-mono">{f.recall.toFixed(3)}</td>
                    <td className="px-3 py-2 font-mono">{f.f1.toFixed(3)}</td>
                    <td className="px-3 py-2 font-mono">{f.roc_auc != null ? f.roc_auc.toFixed(3) : '—'}</td>
                    <td className="px-3 py-2 font-mono">{f.pr_auc != null ? f.pr_auc.toFixed(3) : '—'}</td>
                  </tr>
                ))}
                <tr className="border-t border-white/10 bg-white/[0.02] font-medium">
                  <td className="px-3 py-2">Mean ± std</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 font-mono">{cv.accuracy?.mean?.toFixed(3)} ± {cv.accuracy?.std?.toFixed(3)}</td>
                  <td className="px-3 py-2 font-mono">{cv.precision?.mean?.toFixed(3)} ± {cv.precision?.std?.toFixed(3)}</td>
                  <td className="px-3 py-2 font-mono">{cv.recall?.mean?.toFixed(3)} ± {cv.recall?.std?.toFixed(3)}</td>
                  <td className="px-3 py-2 font-mono">{cv.f1?.mean?.toFixed(3)} ± {cv.f1?.std?.toFixed(3)}</td>
                  <td className="px-3 py-2 font-mono">{cv.roc_auc?.mean?.toFixed(3)} ± {cv.roc_auc?.std?.toFixed(3)}</td>
                  <td className="px-3 py-2 font-mono">{cv.pr_auc?.mean?.toFixed(3)} ± {cv.pr_auc?.std?.toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'confusion' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-500">Evaluation source:</label>
            <select
              value={confusionSource}
              onChange={(e) => setConfusionSource(e.target.value)}
              className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200"
            >
              <option value="holdout">Holdout test fold</option>
              {cv?.status === 'ok' && cv.fold_results?.map((f) => (
                <option key={f.fold} value={`fold-${f.fold}`}>
                  CV Fold {f.fold}
                </option>
              ))}
            </select>
          </div>
          {confusionMatrix ? (
            <ChartCard title={`Confusion matrix — ${experimentId} / ${modelName} / ${confusionSource}`}>
              <ConfusionMatrix matrix={confusionMatrix.matrix} labels={confusionMatrix.labels} color={MODEL_COLOR[modelName]} />
            </ChartCard>
          ) : (
            <UnavailableNotice detail="This confusion matrix has not been generated. Run `python -m src.experiments.run_all`." />
          )}
        </div>
      )}

      {tab === 'roc_pr' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="ROC curve — model comparison"
            description={`Experiment: ${experimentId}`}
            note="ROC-AUC summarizes ranking discrimination on the evaluated dataset; it is not an impact probability."
          >
            {rocSeries.length > 0 ? <ROCCurve series={rocSeries} /> : <p className="text-sm text-slate-500">Result not available.</p>}
          </ChartCard>
          <ChartCard
            title="Precision-Recall curve — model comparison"
            description={`Experiment: ${experimentId}`}
            note="PR-AUC is informative for a minority-prevalence positive class."
          >
            {prSeries.length > 0 ? (
              <PRCurve series={prSeries} baselinePrevalence={baselinePrevalence} />
            ) : (
              <p className="text-sm text-slate-500">Result not available.</p>
            )}
          </ChartCard>
        </div>
      )}

      {tab === 'threshold' && (
        <div className="space-y-4">
          {threshold?.status === 'unavailable' && <UnavailableNotice detail={threshold.detail} />}
          {threshold?.status === 'ok' && threshold.thresholds && (
            <ChartCard
              title="Threshold analysis"
              description={threshold.source}
              note="Threshold selection here is exploratory — it is computed from out-of-fold CV probabilities, not the holdout test set, which stays untouched."
            >
              <ThresholdCurve rows={threshold.thresholds} />
            </ChartCard>
          )}
        </div>
      )}

      {tab === 'calibration' && (
        <div className="space-y-4">
          {calibration?.status === 'unavailable' && <UnavailableNotice detail={calibration.detail} />}
          {calibration?.status === 'ok' && calibration.calibration && (
            <ChartCard title="Calibration curve (holdout)" description="Raw classifier probabilities vs. observed frequency, in quantile-sized bins.">
              <CalibrationCurve data={calibration.calibration} color={MODEL_COLOR[modelName]} />
            </ChartCard>
          )}
          {calibration?.status === 'ok' && !calibration.calibration && (
            <p className="text-sm text-slate-500">
              Calibration could not be computed for this holdout split (e.g. only one class present).
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-slate-500">
        Every number on this page is read live from <code>results/experiments/{'{experiment}'}/{'{model}'}/*.json</code>,
        generated by <code>python -m src.experiments.run_all</code>. No number is hardcoded.
      </p>
    </div>
  )
}
