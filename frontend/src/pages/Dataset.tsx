import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { asRecord, fmt, fmtInt, fmtPct, fmtUtc, str } from '../lib/research'
import { useApi, useDataSource, useReproducibility, useStatistics } from '../lib/useApi'
import { Histogram, PercentBars } from '../components/charts'
import { ProvenancePanel } from '../components/ProvenancePanel'
import {
  Callout,
  ChartContainer,
  EmptyResearchState,
  ErrorState,
  KeyValueList,
  LoadingState,
  MetricCard,
  MetricGrid,
  PageHeader,
  ResearchSection,
} from '../components/ui'

function useDatasetState() {
  const stats = useStatistics()
  const source = useDataSource()
  const repro = useReproducibility()
  const report = repro.data?.dataset_provenance ?? null
  return { stats, source, repro, report }
}

export function Dataset() {
  const { stats, source, report } = useDatasetState()
  const s = stats.data
  const cleaning = asRecord(report?.cleaning)
  const nullCols = s?.status === 'ok' ? Object.entries(s.null_percentage_by_column ?? {}) : []
  const colsWithMissing = nullCols.filter(([, v]) => v > 0).length

  return (
    <div>
      <PageHeader
        eyebrow="Data · Dataset"
        title="Dataset"
        description="The validated NASA NeoWs table the experiments are trained on: one row per NEO after identifier de-duplication."
        meta={[
          { label: 'Source', value: 'NASA / JPL / CNEOS' },
          { label: 'Validated', value: fmtUtc(report?.validated_at_utc) },
          { label: 'Target', value: 'is_potentially_hazardous_asteroid' },
        ]}
      />

      {stats.loading && <LoadingState variant="metrics" />}
      {stats.error && <ErrorState />}
      {s?.status === 'unavailable' && (
        <EmptyResearchState title="DATASET NOT AVAILABLE">
          <p>No validated dataset exists yet.</p>
          {s.detail && <p className="mt-2 font-mono text-[11px] text-faint">{s.detail}</p>}
        </EmptyResearchState>
      )}
      {s?.status === 'ok' && (
        <ResearchSection id="summary" eyebrow="Summary" title="Dataset summary">
          <MetricGrid className="sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total records" value={fmtInt(s.row_count)} sub="one row per unique NEO" />
            <MetricCard label="Positive class" value={fmtInt(s.hazardous_count)} sub="NASA: potentially hazardous" tone="warn" />
            <MetricCard label="Negative class" value={fmtInt(s.non_hazardous_count)} sub="NASA: not hazardous" />
            <MetricCard
              label="Positive prevalence"
              value={s.row_count ? fmtPct((s.hazardous_count ?? 0) / s.row_count) : null}
              sub="class imbalance"
            />
            <MetricCard label="Columns with missing values" value={colsWithMissing} sub={`of ${nullCols.length} columns`} />
            <MetricCard
              label="Duplicates dropped"
              value={cleaning ? fmtInt(typeof cleaning.dropped_duplicate_id === 'number' ? cleaning.dropped_duplicate_id : null) : null}
              sub="repeated NEO identifiers"
            />
            <MetricCard label="Validated" value={report ? str(String(report.validated_at_utc).slice(0, 10)) : null} sub="UTC date" />
          </MetricGrid>
        </ResearchSection>
      )}

      <ResearchSection id="provenance" eyebrow="Provenance" title="Where this data comes from">
        <ProvenancePanel source={source.data} report={report} />
        <p className="mt-3 text-xs text-muted">
          More on{' '}
          <Link to="/data-quality" className="text-accent underline underline-offset-2">data quality</Link> and{' '}
          <Link to="/provenance" className="text-accent underline underline-offset-2">full provenance</Link>.
        </p>
      </ResearchSection>
    </div>
  )
}

export function DataQuality() {
  const { stats, report } = useDatasetState()
  const s = stats.data
  const schema = asRecord(report?.schema_validation)
  const missingRequired = asRecord(schema?.missing_required_field_counts)
  const cleaning = asRecord(report?.cleaning)

  const missingRows =
    s?.status === 'ok'
      ? Object.entries(s.null_percentage_by_column ?? {})
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([label, value]) => ({ label, value, tone: value >= 25 ? ('warn' as const) : ('accent' as const) }))
      : []

  const pos = s?.status === 'ok' && s.row_count ? ((s.hazardous_count ?? 0) / s.row_count) * 100 : null

  return (
    <div>
      <PageHeader
        eyebrow="Data · Data quality"
        title="Data quality"
        description="Missing values, class balance, and what validation removed. Values are computed by the backend over the processed dataset."
      />
      {stats.loading && <LoadingState variant="chart" />}
      {stats.error && <ErrorState />}
      {s?.status === 'unavailable' && (
        <EmptyResearchState title="DATASET NOT AVAILABLE">
          <p>Data quality can only be assessed once a dataset has been ingested and validated.</p>
        </EmptyResearchState>
      )}
      {s?.status === 'ok' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartContainer
            eyebrow="Per column"
            title="Missing values"
            note="Share of rows with a null value. Nulls are never imputed at the dataset level; imputation happens inside each model's training pipeline."
          >
            {missingRows.length ? (
              <PercentBars rows={missingRows} />
            ) : (
              <p className="text-sm text-muted">No column has missing values in the processed dataset.</p>
            )}
          </ChartContainer>

          <ChartContainer eyebrow="Target" title="Class balance" note="A rare positive class is why PR-AUC and recall are reported alongside accuracy.">
            {pos !== null && (
              <PercentBars
                rows={[
                  { label: 'Not hazardous (NASA)', value: 100 - pos, text: `${fmtInt(s.non_hazardous_count)} · ${(100 - pos).toFixed(1)}%` },
                  { label: 'Potentially hazardous (NASA)', value: pos, text: `${fmtInt(s.hazardous_count)} · ${pos.toFixed(1)}%`, tone: 'warn' },
                ]}
              />
            )}
          </ChartContainer>

          <ChartContainer eyebrow="Validation" title="Invalid & duplicate records">
            {cleaning || missingRequired ? (
              <KeyValueList
                columns="sm:grid-cols-1"
                items={[
                  { label: 'Dropped: missing identifier', value: str(cleaning?.dropped_missing_id) },
                  { label: 'Dropped: missing target label', value: str(cleaning?.dropped_missing_target) },
                  { label: 'Dropped: duplicate identifier', value: str(cleaning?.dropped_duplicate_id) },
                  ...Object.entries(missingRequired ?? {}).map(([k, v]) => ({ label: `Raw records missing ${k}`, value: str(v) })),
                ]}
              />
            ) : (
              <EmptyResearchState compact title="VALIDATION REPORT NOT AVAILABLE">
                <p>No validation report was found for this dataset.</p>
              </EmptyResearchState>
            )}
          </ChartContainer>

          <ChartContainer eyebrow="Numeric distributions" title="Distributions">
            <p className="text-sm text-muted">
              Per-feature distributions, split by NASA label, are on the{' '}
              <Link to="/exploratory" className="text-accent underline underline-offset-2">Exploratory Analysis</Link> page.
            </p>
          </ChartContainer>
        </div>
      )}
    </div>
  )
}

const SKIP = new Set(['neo_id', 'is_potentially_hazardous_asteroid', 'is_sentry_object'])

export function Exploratory() {
  const neos = useApi('neos:1000', () => api.neos({ limit: 1000 }))
  const [column, setColumn] = useState<string | null>(null)
  const [logScale, setLogScale] = useState(false)

  const rows = useMemo(() => (neos.data?.status === 'ok' ? neos.data.results : []), [neos.data])
  const columns = useMemo(() => {
    const first = rows[0]
    if (!first) return []
    return Object.keys(first).filter((k) => !SKIP.has(k) && rows.some((r) => typeof r[k] === 'number' && Number.isFinite(r[k] as number)))
  }, [rows])
  const active = column && columns.includes(column) ? column : (columns[0] ?? null)

  const analysis = useMemo(() => {
    if (!active) return null
    const pts: { v: number; hz: boolean }[] = []
    for (const r of rows) {
      const v = r[active]
      if (typeof v === 'number' && Number.isFinite(v)) pts.push({ v, hz: r.is_potentially_hazardous_asteroid === true })
    }
    if (!pts.length) return null
    const sorted = pts.map((p) => p.v).sort((a, b) => a - b)
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    const canLog = min > 0
    const useLog = logScale && canLog
    const t = (v: number) => (useLog ? Math.log10(v) : v)
    const lo = t(min)
    const hi = t(max)
    const nb = 20
    const width = (hi - lo) / nb || 1
    const bins = Array.from({ length: nb }, (_, i) => ({ x0: lo + i * width, x1: lo + (i + 1) * width, a: 0, b: 0 }))
    for (const p of pts) {
      const i = Math.min(nb - 1, Math.floor((t(p.v) - lo) / width))
      if (p.hz) bins[i].b += 1
      else bins[i].a += 1
    }
    return { bins, n: pts.length, min, max, median: sorted[Math.floor(sorted.length / 2)], canLog, useLog }
  }, [rows, active, logScale])

  const loaded = rows.length
  const total = neos.data?.status === 'ok' ? (neos.data.total_count ?? loaded) : 0

  return (
    <div>
      <PageHeader
        eyebrow="Data · Exploratory analysis"
        title="Exploratory analysis"
        description="Distribution of each numeric column, split by NASA's hazard label. Histograms are computed in your browser from the real dataset rows the API returns."
      />
      {neos.loading && <LoadingState variant="chart" />}
      {neos.error && <ErrorState />}
      {neos.data?.status === 'unavailable' && (
        <EmptyResearchState title="DATASET NOT AVAILABLE">
          <p>No dataset rows are available to explore yet.</p>
        </EmptyResearchState>
      )}
      {neos.data?.status === 'ok' && (
        <>
          {total > loaded && (
            <div className="mb-4">
              <Callout tone="warn" title="Partial view">
                Showing the first {fmtInt(loaded)} of {fmtInt(total)} records. Distributions describe this subset only.
              </Callout>
            </div>
          )}
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="col" className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Column</label>
              <select
                id="col"
                value={active ?? ''}
                onChange={(e) => setColumn(e.target.value)}
                className="rounded-sm border border-line bg-surface px-2.5 py-1.5 font-mono text-xs text-ink"
              >
                {columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <label className={`flex items-center gap-2 text-xs ${analysis?.canLog ? 'text-muted' : 'text-faint'}`}>
              <input type="checkbox" checked={Boolean(analysis?.useLog)} disabled={!analysis?.canLog} onChange={(e) => setLogScale(e.target.checked)} className="accent-sky-400" />
              log₁₀ scale {analysis && !analysis.canLog && '(needs all values > 0)'}
            </label>
          </div>

          {analysis && active ? (
            <ChartContainer
              eyebrow={`${fmtInt(analysis.n)} records`}
              title={`${active}${analysis.useLog ? ' (log₁₀)' : ''}`}
              note={`min ${fmt(analysis.min, 4)} · median ${fmt(analysis.median, 4)} · max ${fmt(analysis.max, 4)}. Computed client-side from the loaded records; the two class colours are NASA's label, not model output.`}
            >
              <Histogram bins={analysis.bins} labels={['Not hazardous', 'Potentially hazardous']} xLabel={active} />
            </ChartContainer>
          ) : (
            <EmptyResearchState compact title="NO NUMERIC VALUES">
              <p>This column has no numeric values in the loaded rows.</p>
            </EmptyResearchState>
          )}
        </>
      )}
    </div>
  )
}
