import { useEffect, useMemo, useState } from 'react'
import { api, type DatasetCorrelationsResponse, type DatasetFullResponse, type FeaturesResponse } from '../api/client'
import { ChartCard } from '../components/ChartCard'
import { UnavailableNotice } from '../components/UnavailableNotice'
import { DistributionChart } from '../components/charts/DistributionChart'
import { CorrelationMatrix } from '../components/charts/CorrelationMatrix'
import { ScatterPlot } from '../components/charts/ScatterPlot'
import { BoxPlot } from '../components/charts/BoxPlot'
import { TARGET_COLOR } from '../components/charts/theme'

const TABS = ['distributions', 'correlation', 'bivariate', 'target'] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL: Record<Tab, string> = {
  distributions: 'Distributions',
  correlation: 'Correlation',
  bivariate: 'Bivariate',
  target: 'Target analysis',
}

const HEADLINE_FEATURES = [
  'absolute_magnitude_h',
  'diameter_km_mean',
  'closest_relative_velocity_km_s',
  'closest_miss_distance_km',
  'eccentricity',
  'inclination_deg',
  'semi_major_axis_au',
  'moid_au',
]

function numericValues(rows: Record<string, unknown>[], feature: string): number[] {
  return rows
    .map((r) => r[feature])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
}

export function Explore() {
  const [tab, setTab] = useState<Tab>('distributions')
  const [dataset, setDataset] = useState<DatasetFullResponse | null>(null)
  const [correlations, setCorrelations] = useState<DatasetCorrelationsResponse | null>(null)
  const [corrMethod, setCorrMethod] = useState<'pearson' | 'spearman'>('pearson')
  const [features, setFeatures] = useState<FeaturesResponse | null>(null)
  const [distFeature, setDistFeature] = useState(HEADLINE_FEATURES[0])
  const [xFeature, setXFeature] = useState('moid_au')
  const [yFeature, setYFeature] = useState('eccentricity')
  const [targetFeature, setTargetFeature] = useState(HEADLINE_FEATURES[0])

  useEffect(() => {
    api.datasetFull(2000).then(setDataset).catch(() => setDataset({ status: 'unavailable', detail: 'Backend unreachable.', results: [] }))
    api.features().then(setFeatures).catch(() => null)
  }, [])

  useEffect(() => {
    api.datasetCorrelations(corrMethod).then(setCorrelations).catch(() => null)
  }, [corrMethod])

  const numericFeatureNames = useMemo(() => {
    if (!features) return HEADLINE_FEATURES
    return [...features.nasa_provided_features, ...features.derived_features.map((f) => f.name)]
  }, [features])

  const rows = dataset?.status === 'ok' ? dataset.results : []
  const groups = rows.map((r) => Boolean(r.is_potentially_hazardous_asteroid))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Exploratory Analysis</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Distributions, correlations, and feature relationships computed from real observations in the
          processed dataset.
        </p>
      </div>

      <div className="flex gap-1 rounded-md border border-white/10 bg-black/20 p-1 text-xs w-fit">
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

      {dataset?.status === 'unavailable' && <UnavailableNotice detail={dataset.detail} />}
      {dataset?.status === 'ok' && dataset.sampled && (
        <p className="text-xs text-amber-300/80">{dataset.sample_note}</p>
      )}

      {dataset?.status === 'ok' && tab === 'distributions' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-500">Feature:</label>
            <select
              value={distFeature}
              onChange={(e) => setDistFeature(e.target.value)}
              className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200"
            >
              {numericFeatureNames.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <ChartCard
            title={`Distribution — ${distFeature}`}
            description="Split by target class. Histogram bin count fixed at 20."
          >
            <DistributionChart values={numericValues(rows, distFeature)} groups={groups} />
          </ChartCard>
          <ChartCard title="Headline feature distributions" description="Fixed set of physically/orbitally meaningful features.">
            <div className="grid gap-4 sm:grid-cols-2">
              {HEADLINE_FEATURES.map((f) => (
                <div key={f}>
                  <p className="mb-1 text-xs text-slate-500">{f}</p>
                  <DistributionChart values={numericValues(rows, f)} groups={groups} bins={14} />
                </div>
              ))}
            </div>
          </ChartCard>
        </section>
      )}

      {tab === 'correlation' && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Method:</label>
            <div className="flex gap-1 rounded-md border border-white/10 bg-black/20 p-1 text-xs">
              {(['pearson', 'spearman'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCorrMethod(m)}
                  className={`rounded px-3 py-1 capitalize ${corrMethod === m ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-100'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {correlations?.status === 'unavailable' && <UnavailableNotice detail={correlations.detail} />}
          {correlations?.status === 'ok' && correlations.features && correlations.matrix && (
            <ChartCard
              title={`${corrMethod === 'pearson' ? 'Pearson' : 'Spearman'} correlation matrix`}
              description={correlations.missing_value_handling}
              note="Correlation does not establish causation."
            >
              <CorrelationMatrix features={correlations.features} matrix={correlations.matrix} />
            </ChartCard>
          )}
        </section>
      )}

      {dataset?.status === 'ok' && tab === 'bivariate' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-500">
              X:
              <select value={xFeature} onChange={(e) => setXFeature(e.target.value)} className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200">
                {numericFeatureNames.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Y:
              <select value={yFeature} onChange={(e) => setYFeature(e.target.value)} className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200">
                {numericFeatureNames.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs text-slate-600">Color = target class</span>
          </div>
          <ChartCard title={`${xFeature} vs ${yFeature}`} description="Real observations; color = NASA/JPL's own target label.">
            <ScatterPlot
              points={rows
                .filter((r) => typeof r[xFeature] === 'number' && typeof r[yFeature] === 'number')
                .map((r) => ({
                  x: r[xFeature] as number,
                  y: r[yFeature] as number,
                  hazardous: Boolean(r.is_potentially_hazardous_asteroid),
                  id: r.neo_id as string | number,
                }))}
              xLabel={xFeature}
              yLabel={yFeature}
            />
          </ChartCard>
        </section>
      )}

      {dataset?.status === 'ok' && tab === 'target' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-500">Feature:</label>
            <select
              value={targetFeature}
              onChange={(e) => setTargetFeature(e.target.value)}
              className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200"
            >
              {numericFeatureNames.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <ChartCard
            title={`${targetFeature} by target class`}
            description="Box plot: min / Q1 / median / Q3 / max, computed from real per-record values."
            note="A visual separation between classes describes association in this dataset, not a causal or physical mechanism."
          >
            <BoxPlot
              groups={[
                {
                  label: 'Potentially hazardous',
                  values: rows.filter((r) => r.is_potentially_hazardous_asteroid).map((r) => r[targetFeature] as number).filter((v) => typeof v === 'number'),
                  color: TARGET_COLOR.hazardous,
                },
                {
                  label: 'Not hazardous',
                  values: rows.filter((r) => !r.is_potentially_hazardous_asteroid).map((r) => r[targetFeature] as number).filter((v) => typeof v === 'number'),
                  color: TARGET_COLOR.not_hazardous,
                },
              ]}
            />
          </ChartCard>
        </section>
      )}
    </div>
  )
}
