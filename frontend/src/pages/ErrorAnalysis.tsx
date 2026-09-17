import { useEffect, useMemo, useState } from 'react'
import { api, type ErrorRecord, type ErrorsResponse, type ExperimentId, type ModelName } from '../api/client'
import { ChartCard } from '../components/ChartCard'
import { UnavailableNotice } from '../components/UnavailableNotice'
import { ExperimentSelector } from '../components/research/ExperimentSelector'
import { ModelSelector } from '../components/research/ModelSelector'
import { ResearchNotes } from '../components/research/ResearchNotes'

function CountTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold" style={{ color: tone }}>
        {value}
      </p>
    </div>
  )
}

function GroupMeansTable({
  featureNames,
  groupA,
  groupB,
  labelA,
  labelB,
}: {
  featureNames: string[]
  groupA: Record<string, number | null>
  groupB: Record<string, number | null>
  labelA: string
  labelB: string
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-left text-xs">
        <thead className="bg-white/[0.04] text-slate-400">
          <tr>
            <th className="px-3 py-2">Feature</th>
            <th className="px-3 py-2">{labelA} (mean)</th>
            <th className="px-3 py-2">{labelB} (mean)</th>
          </tr>
        </thead>
        <tbody>
          {featureNames.map((f) => (
            <tr key={f} className="border-t border-white/5">
              <td className="px-3 py-2 font-mono">{f}</td>
              <td className="px-3 py-2 font-mono text-slate-300">{groupA[f] != null ? groupA[f]!.toPrecision(4) : 'n/a'}</td>
              <td className="px-3 py-2 font-mono text-slate-300">{groupB[f] != null ? groupB[f]!.toPrecision(4) : 'n/a'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RecordTable({ records }: { records: ErrorRecord[] }) {
  if (records.length === 0) return <p className="text-sm text-slate-500">None in this evaluated split.</p>
  const featureKeys = Object.keys(records[0].features).slice(0, 5)
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-left text-xs">
        <thead className="bg-white/[0.04] text-slate-400">
          <tr>
            <th className="px-3 py-2">NEO ID</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">True label</th>
            <th className="px-3 py-2">Predicted</th>
            <th className="px-3 py-2">Probability</th>
            {featureKeys.map((k) => (
              <th key={k} className="px-3 py-2">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={String(r.neo_id)} className="border-t border-white/5">
              <td className="px-3 py-2 font-mono">{r.neo_id}</td>
              <td className="px-3 py-2">{r.name ?? 'N/A'}</td>
              <td className="px-3 py-2">{r.true_label ? 'hazardous' : 'not hazardous'}</td>
              <td className="px-3 py-2">{r.predicted_label ? 'hazardous' : 'not hazardous'}</td>
              <td className="px-3 py-2 font-mono">{r.predicted_probability != null ? r.predicted_probability.toFixed(3) : 'n/a'}</td>
              {featureKeys.map((k) => {
                const value = r.features[k]
                return (
                  <td key={k} className="px-3 py-2 font-mono text-slate-400">
                    {typeof value === 'number' ? value.toPrecision(4) : value != null ? String(value) : 'n/a'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ErrorAnalysis() {
  const [experimentId, setExperimentId] = useState<ExperimentId>('experiment_a_original')
  const [modelName, setModelName] = useState<ModelName>('random_forest')
  const [errors, setErrors] = useState<ErrorsResponse | null>(null)
  const [recordTab, setRecordTab] = useState<'fp' | 'fn'>('fn')

  useEffect(() => {
    setErrors(null)
    api.experimentErrors(experimentId, modelName).then(setErrors).catch(() => null)
  }, [experimentId, modelName])

  const featureNames = useMemo(() => {
    const means = errors?.group_feature_means
    if (!means) return []
    return Array.from(new Set([...Object.keys(means.false_positive), ...Object.keys(means.true_negative)]))
  }, [errors])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Error Analysis</h2>
          <p className="mt-1 text-sm text-slate-400">Where the model gets it wrong, on the untouched holdout split.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExperimentSelector value={experimentId} onChange={setExperimentId} />
          <ModelSelector value={modelName} onChange={setModelName} />
        </div>
      </div>

      {errors?.status === 'unavailable' && <UnavailableNotice detail={errors.detail} />}

      {errors?.status === 'ok' && errors.counts && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CountTile label="True positives" value={errors.counts.true_positive} tone="#199e70" />
            <CountTile label="True negatives" value={errors.counts.true_negative} tone="#3987e5" />
            <CountTile label="False positives" value={errors.counts.false_positive} tone="#e0af3c" />
            <CountTile label="False negatives" value={errors.counts.false_negative} tone="#d95926" />
          </div>

          <ResearchNotes
            notes={[
              errors.false_negative_note ?? `${errors.counts.false_negative} false negative(s) in this evaluated split — inspected below.`,
              'This project never claims the model "will never miss a hazardous object" — these counts describe one holdout split of one dataset snapshot, not a guarantee.',
            ]}
          />

          {featureNames.length > 0 && errors.group_feature_means && (
            <section className="space-y-4">
              <ChartCard
                title="False positives vs. true negatives"
                description="Mean feature values, same holdout split."
                note={errors.group_feature_means_note}
              >
                <GroupMeansTable
                  featureNames={featureNames}
                  groupA={errors.group_feature_means.false_positive}
                  groupB={errors.group_feature_means.true_negative}
                  labelA="False positive"
                  labelB="True negative"
                />
              </ChartCard>
              <ChartCard title="False negatives vs. true positives" description="Mean feature values, same holdout split.">
                <GroupMeansTable
                  featureNames={featureNames}
                  groupA={errors.group_feature_means.false_negative}
                  groupB={errors.group_feature_means.true_positive}
                  labelA="False negative"
                  labelB="True positive"
                />
              </ChartCard>
            </section>
          )}

          <section>
            <div className="mb-3 flex gap-1 rounded-md border border-white/10 bg-black/20 p-1 text-xs w-fit">
              <button
                type="button"
                onClick={() => setRecordTab('fn')}
                className={`rounded px-3 py-1.5 ${recordTab === 'fn' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-100'}`}
              >
                False negatives ({errors.counts.false_negative})
              </button>
              <button
                type="button"
                onClick={() => setRecordTab('fp')}
                className={`rounded px-3 py-1.5 ${recordTab === 'fp' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-100'}`}
              >
                False positives ({errors.counts.false_positive})
              </button>
            </div>
            <RecordTable records={recordTab === 'fn' ? errors.false_negatives ?? [] : errors.false_positives ?? []} />
          </section>
        </>
      )}
    </div>
  )
}
