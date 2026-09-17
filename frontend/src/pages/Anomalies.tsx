import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type AnomaliesResponse } from '../api/client'
import { ChartCard } from '../components/ChartCard'
import { UnavailableNotice } from '../components/UnavailableNotice'
import { ResearchNotes } from '../components/research/ResearchNotes'
import { GRID, TOOLTIP_STYLE, tickStyle } from '../components/charts/theme'

const TOP_OPTIONS = [10, 25, 50] as const

const KEY_FEATURES = ['moid_au', 'absolute_magnitude_h', 'eccentricity', 'closest_relative_velocity_km_s']

export function Anomalies() {
  const [top, setTop] = useState<(typeof TOP_OPTIONS)[number]>(10)
  const [data, setData] = useState<AnomaliesResponse | null>(null)

  useEffect(() => {
    api
      .anomalies(top)
      .then(setData)
      .catch(() => setData({ status: 'unavailable', detail: 'Backend unreachable.' }))
  }, [top])

  const histogram = data?.status === 'ok' && data.score_distribution
    ? data.score_distribution.counts.map((count, i) => ({
        bin: `${data.score_distribution!.bin_edges[i].toFixed(2)}`,
        count,
      }))
    : []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Anomaly Detection</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Unsupervised Isolation Forest over the engineered feature space — this does not use the hazard label.
        </p>
      </div>

      {data?.status === 'unavailable' && <UnavailableNotice detail={data.detail} />}

      {data?.status === 'ok' && (
        <>
          <ResearchNotes notes={[data.terminology_note ?? '']} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Records analyzed</p>
              <p className="mt-1 font-mono text-2xl text-slate-100">{data.row_count}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Flagged outliers</p>
              <p className="mt-1 font-mono text-2xl text-amber-300">{data.flagged_outlier_count}</p>
            </div>
          </div>

          {data.score_distribution && (
            <ChartCard title="Anomaly score distribution" description="Lower (more negative) scores are more unusual relative to the rest of this dataset.">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={histogram} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="bin" tick={{ fill: '#898781', fontSize: 9 }} axisLine={{ stroke: GRID }} tickLine={false} interval={1} />
                  <YAxis tick={tickStyle()} axisLine={{ stroke: GRID }} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `score ≥ ${v}`} />
                  <Bar dataKey="count" name="Records" fill="#c9539a" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          <section>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top anomalous records</p>
              <div className="flex gap-1 rounded-md border border-white/10 bg-black/20 p-1 text-xs">
                {TOP_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTop(n)}
                    className={`rounded px-3 py-1 ${top === n ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-100'}`}
                  >
                    Top {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.04] text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Rank</th>
                    <th className="px-3 py-2">NEO ID</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Anomaly score</th>
                    <th className="px-3 py-2">Flagged outlier</th>
                    {KEY_FEATURES.map((f) => (
                      <th key={f} className="px-3 py-2">
                        {f} <span className="text-slate-600">(median)</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.top_anomalies ?? []).map((rec) => (
                    <tr key={String(rec.neo_id)} className="border-t border-white/5">
                      <td className="px-3 py-2">{rec.rank}</td>
                      <td className="px-3 py-2 font-mono">{rec.neo_id}</td>
                      <td className="px-3 py-2">{rec.name ?? 'N/A'}</td>
                      <td className="px-3 py-2 font-mono">{rec.ml_anomaly_score.toFixed(4)}</td>
                      <td className="px-3 py-2">{rec.ml_flagged_outlier ? 'yes' : 'no'}</td>
                      {KEY_FEATURES.map((f) => {
                        const value = rec.features[f]
                        return (
                          <td key={f} className="px-3 py-2 font-mono text-slate-400">
                            {typeof value === 'number' ? value.toPrecision(4) : value != null ? String(value) : 'n/a'}
                            <span className="text-slate-600"> ({data.dataset_medians?.[f]?.toPrecision(3) ?? 'n/a'})</span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Requested top {data.requested_top}, {data.top_anomalies?.length ?? 0} of {data.flagged_outlier_count} flagged
              outliers / {data.row_count} total records exist to show.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
