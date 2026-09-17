import { useEffect, useMemo, useState } from 'react'
import { api, EXPERIMENT_LABEL, MODEL_LABEL, type ComparisonRow, type ExperimentsIndexResponse } from '../api/client'
import { UnavailableNotice } from '../components/UnavailableNotice'
import { ResearchNotes } from '../components/research/ResearchNotes'
import { EXPERIMENT_COLOR } from '../components/charts/theme'

type SortKey = keyof ComparisonRow
const NUMERIC_COLUMNS: { key: SortKey; label: string; format: (v: number | null) => string }[] = [
  { key: 'accuracy', label: 'Accuracy', format: (v) => (v != null ? v.toFixed(3) : '—') },
  { key: 'precision', label: 'Precision', format: (v) => (v != null ? v.toFixed(3) : '—') },
  { key: 'recall', label: 'Recall', format: (v) => (v != null ? v.toFixed(3) : '—') },
  { key: 'f1', label: 'F1', format: (v) => (v != null ? v.toFixed(3) : '—') },
  { key: 'roc_auc', label: 'ROC-AUC', format: (v) => (v != null ? v.toFixed(3) : '—') },
  { key: 'pr_auc', label: 'PR-AUC', format: (v) => (v != null ? v.toFixed(3) : '—') },
]

export function Experiments() {
  const [index, setIndex] = useState<ExperimentsIndexResponse | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('f1')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [experimentFilter, setExperimentFilter] = useState<string>('all')
  const [modelFilter, setModelFilter] = useState<string>('all')

  useEffect(() => {
    api
      .experiments()
      .then(setIndex)
      .catch(() => setIndex({ status: 'unavailable', detail: 'Backend unreachable.' }))
  }, [])

  const definitions = index?.experiment_definitions ?? index?.experiments ?? {}

  const rows = useMemo(() => {
    let table = index?.comparison_table ?? []
    if (experimentFilter !== 'all') table = table.filter((r) => r.experiment_id === experimentFilter)
    if (modelFilter !== 'all') table = table.filter((r) => r.model_name === modelFilter)
    return [...table].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const an = typeof av === 'number' ? av : -Infinity
      const bn = typeof bv === 'number' ? bv : -Infinity
      return sortDir === 'asc' ? an - bn : bn - an
    })
  }, [index, sortKey, sortDir, experimentFilter, modelFilter])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Experiment Design &amp; Comparison</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Two experiments, run identically apart from their feature set. This page presents both; it does not
          declare a "winner" — see the research notes below.
        </p>
      </div>

      {index?.status === 'unavailable' && (
        <UnavailableNotice detail={index.detail ?? 'Run `python -m src.experiments.run_all`.'} />
      )}

      {Object.keys(definitions).length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2">
          {Object.values(definitions).map((exp) => (
            <div
              key={exp.id}
              className="rounded-lg border p-5"
              style={{ borderColor: `color-mix(in oklab, ${EXPERIMENT_COLOR[exp.id] ?? '#3987e5'} 35%, transparent)` }}
            >
              <p className="text-sm font-semibold" style={{ color: EXPERIMENT_COLOR[exp.id] ?? '#3987e5' }}>
                {exp.name}
              </p>
              <p className="mt-2 text-sm text-slate-300">{exp.purpose}</p>
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <p>
                  Numeric features: <span className="font-mono text-slate-300">{exp.numeric_features.length}</span>{' '}
                  · Categorical: <span className="font-mono text-slate-300">{exp.categorical_features.length}</span>
                </p>
                <p>
                  Excluded features:{' '}
                  {exp.excluded_features.length > 0 ? (
                    exp.excluded_features.map((f) => (
                      <code key={f} className="mr-1 rounded bg-black/30 px-1 text-amber-300/90">
                        {f}
                      </code>
                    ))
                  ) : (
                    <span className="text-slate-600">none</span>
                  )}
                </p>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">{exp.rationale}</p>
            </div>
          ))}
        </section>
      )}

      {index?.status === 'ok' && (
        <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Shared methodology</p>
          <div className="grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
            <p>
              Dataset: <span className="font-mono text-slate-200">{index.dataset_row_count} rows</span>
            </p>
            <p>
              Split: <span className="font-mono text-slate-200">{index.split_strategy}</span>
            </p>
            <p>
              CV folds: <span className="font-mono text-slate-200">{index.cv_folds}</span>
            </p>
            <p>
              Random seed: <span className="font-mono text-slate-200">{index.random_seed}</span>
            </p>
            <p>
              Test size: <span className="font-mono text-slate-200">{index.test_size}</span>
            </p>
            <p>
              Generated: <span className="font-mono text-slate-200">{index.generated_at_utc ? new Date(index.generated_at_utc).toUTCString() : 'n/a'}</span>
            </p>
          </div>
        </section>
      )}

      {rows.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Model comparison</p>
            <select
              value={experimentFilter}
              onChange={(e) => setExperimentFilter(e.target.value)}
              className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200"
            >
              <option value="all">All experiments</option>
              {Object.keys(definitions).map((id) => (
                <option key={id} value={id}>
                  {EXPERIMENT_LABEL[id as keyof typeof EXPERIMENT_LABEL] ?? id}
                </option>
              ))}
            </select>
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200"
            >
              <option value="all">All models</option>
              {(index?.models ?? []).map((m) => (
                <option key={m} value={m}>
                  {MODEL_LABEL[m as keyof typeof MODEL_LABEL] ?? m}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-600">Click a column header to sort.</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Experiment</th>
                  {NUMERIC_COLUMNS.map((col) => (
                    <th key={col.key} className="cursor-pointer select-none px-3 py-2 hover:text-slate-200" onClick={() => toggleSort(col.key)}>
                      {col.label} {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ))}
                  <th className="px-3 py-2">CV F1 (mean ± std)</th>
                  <th className="px-3 py-2">Final test (accuracy)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.experiment_id}-${row.model_name}`} className="border-t border-white/5">
                    <td className="px-3 py-2 font-medium text-slate-200">{MODEL_LABEL[row.model_name as keyof typeof MODEL_LABEL] ?? row.model_name}</td>
                    <td className="px-3 py-2">
                      <span style={{ color: EXPERIMENT_COLOR[row.experiment_id] }}>
                        {EXPERIMENT_LABEL[row.experiment_id as keyof typeof EXPERIMENT_LABEL] ?? row.experiment_id}
                      </span>
                    </td>
                    {NUMERIC_COLUMNS.map((col) => (
                      <td key={col.key} className="px-3 py-2 font-mono text-slate-300">
                        {col.format(row[col.key] as number | null)}
                      </td>
                    ))}
                    <td className="px-3 py-2 font-mono text-slate-300">
                      {row.cv_f1_mean != null ? `${row.cv_f1_mean.toFixed(3)} ± ${(row.cv_f1_std ?? 0).toFixed(3)}` : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-300">{row.accuracy.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ResearchNotes
        notes={[
          'Experiment A is primarily useful for understanding and recovering NASA/JPL\'s existing classification boundary — it includes the two features that boundary is a threshold function of.',
          'Experiment B tests whether the remaining orbital, physical, and close-approach features contain useful predictive signal without directly supplying the label-defining variables. It is a narrower, harder question, not automatically a "better" experiment.',
          'This page does not declare a winning model. Compare the numbers above in light of each experiment\'s purpose, in the Model Comparison Matrix or on the Model Performance page.',
        ]}
      />
    </div>
  )
}
