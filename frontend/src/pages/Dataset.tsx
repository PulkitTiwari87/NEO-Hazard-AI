import { useEffect, useState } from 'react'
import {
  api,
  type DataSourceInfo,
  type DatasetQualityResponse,
  type FeaturesResponse,
} from '../api/client'
import { ChartCard } from '../components/ChartCard'
import { UnavailableNotice } from '../components/UnavailableNotice'
import { FeatureImportanceChart } from '../components/charts/FeatureImportanceChart'

function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: 'amber' | 'default' }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold ${tone === 'amber' ? 'text-amber-300' : 'text-slate-100'}`}>
        {value}
      </p>
    </div>
  )
}

export function Dataset() {
  const [quality, setQuality] = useState<DatasetQualityResponse | null>(null)
  const [source, setSource] = useState<DataSourceInfo | null>(null)
  const [features, setFeatures] = useState<FeaturesResponse | null>(null)

  useEffect(() => {
    api.datasetQuality().then(setQuality).catch(() => setQuality({ status: 'unavailable', detail: 'Backend unreachable.' }))
    api.dataSource().then(setSource).catch(() => null)
    api.features().then(setFeatures).catch(() => null)
  }, [])

  const numericFeatureCount = features
    ? features.nasa_provided_features.length + features.derived_features.length
    : null
  const categoricalFeatureCount = features?.categorical_features.length ?? null

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Dataset &amp; Data Quality</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Every number on this page is computed live from{' '}
          <code className="rounded bg-black/30 px-1">data/processed/neo_dataset.csv</code> — nothing is
          hardcoded. Data-quality problems (missing values, drops, duplicates) are shown, not hidden.
        </p>
      </div>

      {quality?.status === 'unavailable' && <UnavailableNotice detail={quality.detail} />}

      {quality?.status === 'ok' && (
        <>
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Dataset overview</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Total records" value={quality.row_count ?? 'N/A'} />
              <StatTile label="Unique NEOs" value={quality.unique_neo_count ?? 'N/A'} />
              <StatTile label="Positive samples (hazardous)" value={quality.class_distribution?.hazardous_count ?? 'N/A'} />
              <StatTile label="Negative samples" value={quality.class_distribution?.non_hazardous_count ?? 'N/A'} />
              <StatTile
                label="Duplicate records (post-clean)"
                value={quality.duplicate_neo_id_count ?? 'N/A'}
                tone={quality.duplicate_neo_id_count ? 'amber' : 'default'}
              />
              <StatTile label="Numerical features" value={numericFeatureCount ?? 'N/A'} />
              <StatTile label="Categorical features" value={categoricalFeatureCount ?? 'N/A'} />
              <StatTile
                label="Class balance (hazardous)"
                value={quality.class_distribution?.hazardous_percentage != null ? `${quality.class_distribution.hazardous_percentage}%` : 'N/A'}
              />
            </div>
          </section>

          {quality.cleaning_report && (
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Preprocessing decisions (from validation)
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                <StatTile label="Rows before cleaning" value={quality.cleaning_report.rows_before} />
                <StatTile label="Rows after cleaning" value={quality.cleaning_report.rows_after} />
                <StatTile label="Dropped: missing id" value={quality.cleaning_report.dropped_missing_id} />
                <StatTile label="Dropped: missing target" value={quality.cleaning_report.dropped_missing_target} />
                <StatTile label="Dropped: duplicate id" value={quality.cleaning_report.dropped_duplicate_id} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Rows missing an identifier or the target label are dropped and counted; every other row is
                preserved with nulls left as nulls (never imputed at this stage) — see{' '}
                <code>docs/METHODOLOGY.md</code>.
              </p>
            </section>
          )}

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Missing values by feature
            </h3>
            {quality.missing_value_percentages && (
              <ChartCard
                title="Missing value percentage"
                note="Computed from data/processed/neo_dataset.csv, including derived features. 0% bars are omitted from the ranked list below the chart if all values are present."
              >
                <FeatureImportanceChart
                  importance={Object.entries(quality.missing_value_percentages)
                    .filter(([, v]) => v > 0)
                    .map(([feature, v]) => ({ feature, value: v }))
                    .sort((a, b) => b.value - a.value)}
                  valueLabel="% missing"
                  color="#e0af3c"
                  top={20}
                />
                {Object.values(quality.missing_value_percentages).every((v) => v === 0) && (
                  <p className="text-sm text-slate-400">No missing values in any column of this dataset snapshot.</p>
                )}
              </ChartCard>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Numeric feature ranges</h3>
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.04] text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Feature</th>
                    <th className="px-3 py-2">Min</th>
                    <th className="px-3 py-2">Max</th>
                    <th className="px-3 py-2">Mean</th>
                    <th className="px-3 py-2">Median</th>
                    <th className="px-3 py-2">Std</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(quality.numeric_ranges ?? {}).map(([feature, range]) => (
                    <tr key={feature} className="border-t border-white/5">
                      <td className="px-3 py-2 font-mono">{feature}</td>
                      {range ? (
                        <>
                          <td className="px-3 py-2 font-mono text-slate-400">{range.min.toPrecision(4)}</td>
                          <td className="px-3 py-2 font-mono text-slate-400">{range.max.toPrecision(4)}</td>
                          <td className="px-3 py-2 font-mono text-slate-400">{range.mean.toPrecision(4)}</td>
                          <td className="px-3 py-2 font-mono text-slate-400">{range.median.toPrecision(4)}</td>
                          <td className="px-3 py-2 font-mono text-slate-400">{range.std.toPrecision(4)}</td>
                        </>
                      ) : (
                        <td className="px-3 py-2 text-slate-600" colSpan={5}>
                          all values missing
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {quality.categorical_cardinality && Object.keys(quality.categorical_cardinality).length > 0 && (
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Categorical feature cardinality
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.entries(quality.categorical_cardinality).map(([feature, info]) => (
                  <div key={feature} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-medium text-slate-200">
                      {feature} <span className="text-slate-500">({info.unique_count} unique values)</span>
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-400">
                      {Object.entries(info.value_counts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([value, count]) => (
                          <li key={value} className="flex justify-between">
                            <span className="font-mono">{value}</span>
                            <span>{count}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Data source &amp; provenance</h3>
        {source ? (
          <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] px-5 py-4 text-sm">
            <p>
              <span className="text-slate-500">Source: </span>
              {source.source_name}
            </p>
            <p>
              <span className="text-slate-500">Endpoint: </span>
              <code className="rounded bg-black/30 px-1">{source.source_url}</code>
            </p>
            <p>
              <span className="text-slate-500">Ingestion has run: </span>
              <span className={source.ingestion_has_run ? 'text-emerald-400' : 'text-amber-400'}>
                {source.ingestion_has_run ? 'yes' : 'no'}
              </span>
            </p>
            <p>
              <span className="text-slate-500">Dataset version / hash: </span>
              <span className="text-slate-400">
                not computed — this project tracks the raw ingestion filename (timestamped) and dataset row
                count as the version signal; no content hash is generated. See <code>docs/DATA_SOURCE.md</code>.
              </span>
            </p>
            <p className="text-slate-400">{source.note}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Loading…</p>
        )}
      </section>

      {features && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Feature definitions</h3>
          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Formula</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Rationale</th>
                </tr>
              </thead>
              <tbody>
                {features.derived_features.map((f) => (
                  <tr key={f.name} className="border-t border-white/5 align-top">
                    <td className="px-3 py-2 font-mono">{f.name}</td>
                    <td className="px-3 py-2 font-mono text-slate-400">{f.formula}</td>
                    <td className="px-3 py-2 text-slate-400">{f.unit}</td>
                    <td className="px-3 py-2 text-slate-500">{f.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {features.nasa_provided_features.length} NASA-provided passthrough features + {features.derived_features.length}{' '}
            derived features listed above. Full rationale: <code>docs/FEATURES.md</code>.
          </p>
        </section>
      )}
    </div>
  )
}
