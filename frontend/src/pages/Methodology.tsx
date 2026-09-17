import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api,
  EXPERIMENT_LABEL,
  MODEL_LABEL,
  type DataSourceInfo,
  type ExperimentsIndexResponse,
  type FeaturesResponse,
  type ModelsResponse,
} from '../api/client'

const REPRODUCE_COMMANDS = [
  'python -m src.data.ingestion',
  'python -m src.data.validation',
  'python -m src.models.train',
  'python -m src.models.evaluate',
  'python -m src.experiments.run_all',
  'python -m src.anomaly.detect',
  'python -m src.explainability.shap_analysis --model random_forest',
  'python -m src.explainability.shap_analysis --model random_forest --experiment experiment_a_original',
  'python -m src.explainability.shap_analysis --model random_forest --experiment experiment_b_leakage_aware',
]

function ReportSection({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-lg border border-white/10 bg-white/[0.02]">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-slate-200">
        {number}. {title}
      </summary>
      <div className="space-y-2 border-t border-white/5 px-4 py-3 text-sm leading-relaxed text-slate-400">{children}</div>
    </details>
  )
}

export function Methodology() {
  const [source, setSource] = useState<DataSourceInfo | null>(null)
  const [features, setFeatures] = useState<FeaturesResponse | null>(null)
  const [experiments, setExperiments] = useState<ExperimentsIndexResponse | null>(null)
  const [models, setModels] = useState<ModelsResponse | null>(null)

  useEffect(() => {
    api.dataSource().then(setSource).catch(() => null)
    api.features().then(setFeatures).catch(() => null)
    api.experiments().then(setExperiments).catch(() => null)
    api.models().then(setModels).catch(() => null)
  }, [])

  const definitions = experiments?.experiment_definitions ?? experiments?.experiments ?? {}

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Methodology, Reproducibility &amp; Research Report
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Generated from live experiment metadata and API responses — see each section's linked page for the
          full interactive breakdown. No metric here is hand-typed.
        </p>
      </div>

      <section className="rounded-lg border border-sky-500/20 bg-sky-500/[0.04] p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">Reproducibility panel</p>
        <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
          <p><span className="text-slate-500">Dataset source: </span>{source?.source_name ?? 'loading…'}</p>
          <p><span className="text-slate-500">Ingestion has run: </span>{source ? (source.ingestion_has_run ? 'yes' : 'no') : '…'}</p>
          <p><span className="text-slate-500">Random seed: </span><span className="font-mono">{experiments?.random_seed ?? 'n/a'}</span></p>
          <p><span className="text-slate-500">CV folds: </span><span className="font-mono">{experiments?.cv_folds ?? 'n/a'}</span></p>
          <p><span className="text-slate-500">Train/holdout split: </span><span className="font-mono">{experiments?.test_size ?? 'n/a'}</span></p>
          <p><span className="text-slate-500">Dataset row count: </span><span className="font-mono">{experiments?.dataset_row_count ?? 'n/a'}</span></p>
          <p><span className="text-slate-500">Experiments generated at (UTC): </span><span className="font-mono">{experiments?.generated_at_utc ?? 'n/a'}</span></p>
          <p><span className="text-slate-500">Feature list: </span>{features ? `${features.nasa_provided_features.length + features.derived_features.length} numeric + ${features.categorical_features.length} categorical` : 'loading…'}</p>
        </div>
        {models?.status === 'ok' && (
          <div className="mt-3 text-xs text-slate-400">
            <p className="text-slate-500">Model versions (training timestamp, from the model registry):</p>
            <ul className="mt-1 space-y-1">
              {models.models.map((m) => (
                <li key={m.model_name} className="font-mono">
                  {m.model_name}: {m.model_version}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-4">
          <p className="text-xs text-slate-500">Reproduce this project's full pipeline:</p>
          <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-3 text-[11px] text-slate-300">
            {REPRODUCE_COMMANDS.join('\n')}
          </pre>
          <p className="mt-1 text-xs text-slate-500">
            Requires <code>NASA_API_KEY</code> set in <code>.env</code> and network access to{' '}
            <code>api.nasa.gov</code>. Full sequence and seeding details: <code>docs/REPRODUCIBILITY.md</code>.
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Research report</p>

        <ReportSection number={1} title="Research question">
          <p>
            How well can a statistical model recover NASA/JPL's own{' '}
            <code className="rounded bg-black/30 px-1">is_potentially_hazardous_asteroid</code> classification
            from an object's other NASA-provided orbital/physical features — and, separately, which objects
            look statistically unusual in that same feature space? See <code>README.md</code> (Scientific
            motivation).
          </p>
        </ReportSection>

        <ReportSection number={2} title="Dataset">
          <p>
            {experiments?.dataset_row_count ?? 'N/A'} rows (one row per unique NEO object), from{' '}
            {source?.source_name ?? 'NASA NeoWs'}. Full provenance:{' '}
            <Link to="/dataset" className="text-sky-400 hover:underline">Dataset &amp; Data Quality</Link>,{' '}
            <code>docs/DATA_SOURCE.md</code>.
          </p>
        </ReportSection>

        <ReportSection number={3} title="Data preparation">
          <p>
            Flattening (one row per object), schema validation, and documented cleaning (drop rows missing an
            id or the target label; deduplicate by id) — see <code>src/data/validation.py</code> and{' '}
            <Link to="/dataset" className="text-sky-400 hover:underline">Dataset &amp; Data Quality</Link>.
          </p>
        </ReportSection>

        <ReportSection number={4} title="Feature engineering">
          <p>
            {features ? `${features.nasa_provided_features.length} NASA-provided passthrough features + ${features.derived_features.length} derived features` : 'Loading…'}{' '}
            — see <Link to="/dataset" className="text-sky-400 hover:underline">Dataset</Link> for the full table, <code>docs/FEATURES.md</code> for rationale.
          </p>
        </ReportSection>

        <ReportSection number={5} title="Leakage analysis">
          <p>
            NASA/JPL's own hazard flag is, per NASA's public documentation, essentially a threshold rule over
            an object's MOID and absolute magnitude. Experiment B removes those two features specifically to
            test for leakage. See <Link to="/experiments" className="text-sky-400 hover:underline">Experiment Design &amp; Comparison</Link>.
          </p>
        </ReportSection>

        <ReportSection number={6} title="Experimental design">
          {Object.values(definitions).length > 0 ? (
            <ul className="space-y-1">
              {Object.values(definitions).map((exp) => (
                <li key={exp.id}>
                  <span className="font-medium text-slate-300">{exp.name}</span>: {exp.purpose}
                </li>
              ))}
            </ul>
          ) : (
            <p>Result not available — run <code>python -m src.experiments.run_all</code>.</p>
          )}
        </ReportSection>

        <ReportSection number={7} title="Models">
          <p>
            {experiments?.models?.map((m) => MODEL_LABEL[m as keyof typeof MODEL_LABEL] ?? m).join(', ') ?? 'Logistic Regression, Random Forest, XGBoost'} —
            trained inside leakage-safe pipelines (preprocessing fit only on the training fold). See{' '}
            <code>docs/METHODOLOGY.md</code>.
          </p>
        </ReportSection>

        <ReportSection number={8} title="Cross-validation">
          <p>
            {experiments?.cv_folds ?? 5}-fold stratified cross-validation within the training pool only. See{' '}
            <Link to="/models" className="text-sky-400 hover:underline">Model Performance → Cross-Validation</Link>.
          </p>
        </ReportSection>

        <ReportSection number={9} title="Holdout evaluation">
          <p>
            A single stratified {experiments?.test_size ?? 0.2}-fraction holdout split, touched once for final
            metrics. See <Link to="/models" className="text-sky-400 hover:underline">Model Performance → Overview</Link>.
          </p>
        </ReportSection>

        <ReportSection number={10} title="Results">
          {experiments?.status === 'ok' && experiments.comparison_table ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="pr-4 py-1">Model</th>
                    <th className="pr-4 py-1">Experiment</th>
                    <th className="pr-4 py-1">Accuracy</th>
                    <th className="pr-4 py-1">F1</th>
                    <th className="pr-4 py-1">ROC-AUC</th>
                  </tr>
                </thead>
                <tbody>
                  {experiments.comparison_table.map((row) => (
                    <tr key={`${row.experiment_id}-${row.model_name}`} className="border-t border-white/5">
                      <td className="pr-4 py-1 font-mono">{row.model_name}</td>
                      <td className="pr-4 py-1">{EXPERIMENT_LABEL[row.experiment_id as keyof typeof EXPERIMENT_LABEL] ?? row.experiment_id}</td>
                      <td className="pr-4 py-1 font-mono">{row.accuracy.toFixed(3)}</td>
                      <td className="pr-4 py-1 font-mono">{row.f1.toFixed(3)}</td>
                      <td className="pr-4 py-1 font-mono">{row.roc_auc != null ? row.roc_auc.toFixed(3) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Result not available.</p>
          )}
          <p className="mt-1">
            Full breakdown: <Link to="/experiments" className="text-sky-400 hover:underline">Experiment Comparison</Link>.
          </p>
        </ReportSection>

        <ReportSection number={11} title="Error analysis">
          <p>
            False positive/negative records, inspected individually, plus feature-mean comparisons against true
            negatives/positives. See <Link to="/errors" className="text-sky-400 hover:underline">Error Analysis</Link>.
          </p>
        </ReportSection>

        <ReportSection number={12} title="Explainability">
          <p>
            SHAP global feature importance and per-record local explanations for each trained model. See{' '}
            <Link to="/explainability" className="text-sky-400 hover:underline">Feature Importance &amp; SHAP</Link>.
          </p>
        </ReportSection>

        <ReportSection number={13} title="Anomaly detection">
          <p>
            Unsupervised Isolation Forest over the engineered feature space, independent of the hazard label. See{' '}
            <Link to="/anomalies" className="text-sky-400 hover:underline">Anomaly Detection</Link>.
          </p>
        </ReportSection>

        <ReportSection number={14} title="Discussion">
          <p>
            Experiment A's near-perfect tree-model scores are expected: it includes the two features NASA's own
            screening rule is a threshold function of, so a tree model can recover that rule almost exactly.
            Experiment B's lower scores test a genuinely harder, narrower question — whether the remaining
            features carry independent signal — and should not be read as the model "failing."
          </p>
        </ReportSection>

        <ReportSection number={15} title="Limitations">
          <p>
            Full statement: <Link to="/limitations" className="text-sky-400 hover:underline">Limitations</Link>,{' '}
            <code>docs/LIMITATIONS.md</code>.
          </p>
        </ReportSection>

        <ReportSection number={16} title="Reproducibility">
          <p>See the reproducibility panel above and <code>docs/REPRODUCIBILITY.md</code>.</p>
        </ReportSection>
      </section>
    </div>
  )
}
