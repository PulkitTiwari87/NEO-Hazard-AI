import { EXPERIMENTS, MODELS, fmtUtc, modelLabel, str } from '../lib/research'
import { useDataSource, useExperimentDetail, useExperiments, useFeatures, useReproducibility } from '../lib/useApi'
import { ProvenancePanel } from '../components/ProvenancePanel'
import {
  Callout,
  CodeBlock,
  EmptyResearchState,
  ErrorState,
  KeyValueList,
  LoadingState,
  PageHeader,
  ResearchSection,
  ScientificCard,
} from '../components/ui'

function scalarEntries(obj: Record<string, unknown> | null | undefined) {
  return Object.entries(obj ?? {})
    .filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v))
    .map(([label, v]) => ({ label, value: String(v) }))
}

export function RunInfo() {
  const repro = useReproducibility()
  const list = useExperiments().data

  // Software versions are recorded per run; read them from the first executed one.
  let first: [string, string] | null = null
  if (list) {
    outer: for (const e of EXPERIMENTS) {
      for (const m of MODELS) {
        if (list.experiments[e.key]?.models[m]?.executed) {
          first = [e.key, m]
          break outer
        }
      }
    }
  }
  const detail = useExperimentDetail(first?.[0] ?? null, first?.[1] ?? null).data
  const software = detail?.status === 'ok' ? ((detail.metadata?.software_versions ?? {}) as Record<string, unknown>) : {}
  const r = repro.data
  const run = r?.last_benchmark_run ?? null

  return (
    <div>
      <PageHeader
        eyebrow="Reproducibility · Run information"
        title="Run information"
        description="Everything needed to repeat the benchmark: source, seed, split strategy, software versions and the commands to run."
      />
      {repro.loading && <LoadingState variant="page" />}
      {repro.error && <ErrorState />}
      {r && (
        <div className="space-y-2 divide-y divide-line">
          <ResearchSection id="record" eyebrow="Appendix A" title="Run record">
            <ScientificCard>
              <KeyValueList
                columns="sm:grid-cols-2 lg:grid-cols-3"
                items={[
                  { label: 'Data source', value: 'NASA / JPL / CNEOS — NeoWs' },
                  { label: 'Retrieval date', value: 'Not exposed by the API' },
                  { label: 'Git commit', value: 'Not recorded in artifacts' },
                  { label: 'Python version', value: str(software.python) },
                  { label: 'scikit-learn', value: str(software.scikit_learn) },
                  { label: 'XGBoost', value: str(software.xgboost) },
                  { label: 'Random seed', value: String(r.random_seed) },
                  { label: 'CV strategy', value: `${r.n_cv_folds}-fold stratified` },
                  { label: 'Outer holdout', value: `${r.outer_test_size * 100}%` },
                  { label: 'Feature sets', value: r.feature_sets.join(', ') },
                  { label: 'Models', value: r.models.map(modelLabel).join(', ') },
                  { label: 'Last benchmark run', value: fmtUtc(run?.run_at_utc) },
                ]}
              />
            </ScientificCard>
          </ResearchSection>

          <ResearchSection id="summary" eyebrow="Appendix B" title="Last benchmark run">
            {run ? (
              <ScientificCard>
                <KeyValueList columns="sm:grid-cols-2 lg:grid-cols-3" items={scalarEntries(run)} />
              </ScientificCard>
            ) : (
              <EmptyResearchState compact title="NO BENCHMARK RUN RECORDED">
                <p>The research benchmark has not produced a run summary yet.</p>
              </EmptyResearchState>
            )}
          </ResearchSection>

          <ResearchSection id="reproduce" eyebrow="Appendix C" title="Reproduce this experiment">
            <div className="space-y-3">
              <CodeBlock label="Documented commands" lines={r.reproduce_with} />
              <p className="text-xs text-muted">Shown for reference. This interface never executes commands on the backend.</p>
            </div>
          </ResearchSection>
        </div>
      )}
    </div>
  )
}

export function ProvenancePage() {
  const source = useDataSource()
  const repro = useReproducibility()
  const features = useFeatures()
  const report = repro.data?.dataset_provenance ?? null

  return (
    <div>
      <PageHeader
        eyebrow="Reproducibility · Data provenance"
        title="Data provenance"
        description="Where every row came from, what validation did to it, and how each derived feature is defined."
      />
      <div className="space-y-2 divide-y divide-line">
        <ResearchSection id="source" eyebrow="Source" title="Provenance record">
          {source.loading && <LoadingState variant="chart" />}
          {source.error && <ErrorState />}
          {source.data && <ProvenancePanel source={source.data} report={report} />}
        </ResearchSection>

        <ResearchSection id="report" eyebrow="Validation" title="Validation report">
          {report ? (
            <details className="rounded-panel border border-line bg-surface">
              <summary className="cursor-pointer px-4 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted hover:text-ink">
                View raw validation_report.json
              </summary>
              <pre className="overflow-x-auto border-t border-line p-4 font-mono text-[11px] leading-relaxed text-ink">
                {JSON.stringify(report, null, 2)}
              </pre>
            </details>
          ) : (
            <EmptyResearchState compact title="VALIDATION REPORT NOT AVAILABLE">
              <p>No dataset has been validated yet.</p>
            </EmptyResearchState>
          )}
        </ResearchSection>

        <ResearchSection
          id="features"
          eyebrow="Features"
          title="Derived features"
          description={features.data ? `Target column: ${features.data.target_column}. Each formula is the code's own definition.` : undefined}
        >
          {features.data && (
            <div className="overflow-x-auto rounded-panel border border-line bg-surface">
              <table className="w-full min-w-[40rem] text-left text-xs">
                <caption className="sr-only">Derived features with formula, unit and rationale</caption>
                <thead className="bg-raised text-muted">
                  <tr>
                    {['Name', 'Formula', 'Unit', 'Rationale'].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {features.data.derived_features.map((f) => (
                    <tr key={f.name} className="border-t border-line align-top">
                      <th scope="row" className="px-3 py-2 font-mono font-normal text-ink">{f.name}</th>
                      <td className="px-3 py-2 font-mono text-muted">{f.formula}</td>
                      <td className="px-3 py-2 text-muted">{f.unit}</td>
                      <td className="max-w-md px-3 py-2 leading-relaxed text-muted">{f.rationale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ResearchSection>
      </div>
    </div>
  )
}

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Target',
    body: "The label is NASA/JPL's own is_potentially_hazardous_asteroid flag, passed through unmodified. The project studies how well that label can be recovered; it never redefines it.",
  },
  {
    title: 'Data',
    body: 'Objects come from the NASA NeoWs browse endpoint. Each object becomes one row; rows without an identifier or label, and repeated identifiers, are dropped and counted in the validation report. Missing values are never invented.',
  },
  {
    title: 'Leakage control',
    body: 'A feature audit classifies every field. Fields that define the label, or are NASA-side transforms of them, are removed in the leakage-aware experiments, and automated checks assert that none re-enter.',
  },
  {
    title: 'Splits',
    body: 'A stratified outer holdout is set aside once. Hyperparameter tuning and cross-validation use only the remaining training split, with stratified folds.',
  },
  {
    title: 'Preprocessing',
    body: 'Imputation, scaling and one-hot encoding are fit on the training portion inside each model pipeline, so no statistic from held-out rows reaches training.',
  },
  {
    title: 'Metrics',
    body: 'Accuracy, precision, recall, F1, ROC-AUC and PR-AUC are computed with scikit-learn. Threshold sweeps use out-of-fold predictions; calibration, permutation importance and SHAP (tree models) use the holdout.',
  },
  {
    title: 'Class imbalance',
    body: 'Logistic regression and random forest use balanced class weights. Each model’s handling is documented in docs/METHODOLOGY.md; the dummy baseline ignores features entirely.',
  },
]

export function Methodology() {
  const repro = useReproducibility().data
  return (
    <div>
      <PageHeader
        eyebrow="Reproducibility · Methodology"
        title="Methodology"
        description="A summary of how experiments are built and evaluated. The written source of truth is docs/METHODOLOGY.md."
        meta={
          repro
            ? [
                { label: 'Random seed', value: String(repro.random_seed) },
                { label: 'CV folds', value: String(repro.n_cv_folds) },
                { label: 'Holdout', value: `${repro.outer_test_size * 100}%` },
              ]
            : undefined
        }
      />
      <ol className="space-y-3">
        {SECTIONS.map((s, i) => (
          <li key={s.title}>
            <ScientificCard eyebrow={`Step ${String(i + 1).padStart(2, '0')}`} title={s.title}>
              <p className="text-sm leading-relaxed text-muted">{s.body}</p>
            </ScientificCard>
          </li>
        ))}
      </ol>
      <div className="mt-6">
        <Callout tone="info" title="Semantics">
          Results describe one dataset snapshot and one seed. They are not fixed benchmarks, and re-running against a
          larger ingestion will produce different real numbers.
        </Callout>
      </div>
    </div>
  )
}
