import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CHART_COLORS,
  METRIC_KEYS,
  METRIC_LABEL,
  MODELS,
  MODEL_COLOR,
  experimentMeta,
  fmt,
  modelLabel,
  num,
  type MetricKey,
} from '../lib/research'
import { useExperimentDetails, useExperiments } from '../lib/useApi'
import { useSelection } from '../lib/useSelection'
import { ExperimentSelector } from '../components/Selectors'
import {
  Callout,
  ChartContainer,
  EmptyResearchState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '../components/ui'

interface DotRow {
  model: string
  test: number | null
  cvMean: number | null
  cvStd: number | null
}

/** Test value (dot) against CV mean ± std (whisker) for one metric. Fixed model order, no ranking. */
function MetricDotPlot({ rows, metric }: { rows: DotRow[]; metric: MetricKey }) {
  const left = 132
  const width = 560
  const track = width - left - 20
  const rowH = 44
  const x = (v: number) => left + Math.min(1, Math.max(0, v)) * track
  return (
    <svg
      viewBox={`0 0 ${width} ${rows.length * rowH + 34}`}
      role="img"
      aria-label={`${METRIC_LABEL[metric]} per model: test-set value and cross-validation mean with standard deviation`}
      className="w-full"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={6} y2={rows.length * rowH + 6} stroke="rgb(255 255 255 / 0.06)" />
          <text x={x(t)} y={rows.length * rowH + 22} textAnchor="middle" className="fill-faint font-mono text-[10px]">
            {t}
          </text>
        </g>
      ))}
      {rows.map((r, i) => {
        const cy = 6 + i * rowH + rowH / 2
        const color = MODEL_COLOR[r.model] ?? CHART_COLORS.accent
        return (
          <g key={r.model}>
            <text x={0} y={cy + 4} className="fill-ink text-[11px]">{modelLabel(r.model)}</text>
            {r.cvMean !== null && (
              <>
                {r.cvStd !== null && (
                  <line x1={x(r.cvMean - r.cvStd)} x2={x(r.cvMean + r.cvStd)} y1={cy} y2={cy} stroke={color} strokeWidth={2} opacity="0.6" />
                )}
                <rect x={x(r.cvMean) - 4} y={cy - 4} width={8} height={8} transform={`rotate(45 ${x(r.cvMean)} ${cy})`} fill="#05070d" stroke={color} strokeWidth={1.5}>
                  <title>{`CV mean ${fmt(r.cvMean)} ± ${fmt(r.cvStd)}`}</title>
                </rect>
              </>
            )}
            {r.test !== null && (
              <circle cx={x(r.test)} cy={cy} r={5} fill={color}>
                <title>{`Test ${fmt(r.test)}`}</title>
              </circle>
            )}
            {r.test === null && r.cvMean === null && (
              <text x={left} y={cy + 4} className="fill-faint font-mono text-[10px]">not computed</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function ModelComparison() {
  const { experiment, setExperiment } = useSelection()
  const list = useExperiments()
  const [metric, setMetric] = useState<MetricKey>('f1')

  const executed = MODELS.filter((m) => list.data?.experiments[experiment]?.models[m]?.executed)
  const details = useExperimentDetails(experiment, [...executed])
  const meta = experimentMeta(experiment)

  const rows: DotRow[] = MODELS.filter((m) => executed.includes(m)).map((m) => {
    const d = details.data?.[m]
    return {
      model: m,
      test: d?.status === 'ok' ? num(d.test_metrics?.[metric]) : null,
      cvMean: d?.status === 'ok' ? (d.cv_metrics?.[metric]?.mean ?? null) : null,
      cvStd: d?.status === 'ok' ? (d.cv_metrics?.[metric]?.std ?? null) : null,
    }
  })

  return (
    <div>
      <PageHeader
        eyebrow="Research · Model comparison"
        title="Model comparison"
        description="Four model families under the same feature set, splits and seed. Models are shown side by side and are not ranked: the methodology defines no selection criterion."
        meta={[{ label: 'Experiment', value: meta?.tag ?? experiment, copy: meta?.tag ?? experiment }]}
      />
      <div className="mb-6">
        <ExperimentSelector value={experiment} onChange={setExperiment} />
      </div>

      {list.loading && <LoadingState variant="page" />}
      {list.error && <ErrorState />}
      {list.data && executed.length === 0 && (
        <EmptyResearchState meta={[{ label: 'Experiment', value: meta?.tag ?? experiment }]}>
          <p>No model has been executed for this experiment against the current NASA dataset.</p>
          <p className="mt-1">Run the experiment to populate this comparison.</p>
        </EmptyResearchState>
      )}

      {executed.length > 0 && (
        <div className="space-y-6">
          {details.loading && <LoadingState variant="table" />}
          {details.error && <ErrorState />}
          {details.data && (
            <>
              <div className="overflow-x-auto rounded-panel border border-line bg-surface">
                <table className="w-full min-w-[44rem] text-left text-xs">
                  <caption className="sr-only">Test-set metrics with cross-validation mean and standard deviation, per model</caption>
                  <thead className="bg-raised text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em]">Model</th>
                      {METRIC_KEYS.map((k) => (
                        <th key={k} scope="col" className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.1em]">{METRIC_LABEL[k]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MODELS.map((m) => {
                      const d = details.data?.[m]
                      if (!executed.includes(m) || d?.status !== 'ok') {
                        return (
                          <tr key={m} className="border-t border-line">
                            <th scope="row" className="px-3 py-2 font-normal text-ink">{modelLabel(m)}</th>
                            <td colSpan={METRIC_KEYS.length} className="px-3 py-2 font-mono text-[11px] text-faint">— Not yet executed</td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={m} className="border-t border-line align-top">
                          <th scope="row" className="px-3 py-2 font-normal">
                            <Link to={`/experiments/${experiment}/${m}`} className="text-ink hover:text-accent hover:underline">{modelLabel(m)}</Link>
                          </th>
                          {METRIC_KEYS.map((k) => (
                            <td key={k} className="px-3 py-2 text-right font-mono tabular-nums">
                              <span className="block text-ink">{fmt(num(d.test_metrics?.[k]))}</span>
                              <span className="block text-[10px] text-faint">CV {fmt(d.cv_metrics?.[k]?.mean ?? null)} ± {fmt(d.cv_metrics?.[k]?.std ?? null)}</span>
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <ChartContainer
                eyebrow="Interactive"
                title={`${METRIC_LABEL[metric]} by model`}
                legend={
                  <div role="radiogroup" aria-label="Metric" className="flex flex-wrap gap-1">
                    {METRIC_KEYS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={metric === k}
                        onClick={() => setMetric(k)}
                        className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${metric === k ? 'border-accent/60 bg-accent-soft text-ink' : 'border-line text-muted hover:text-ink'}`}
                      >
                        {METRIC_LABEL[k]}
                      </button>
                    ))}
                  </div>
                }
                note="● test-set value (single fixed holdout) · ◇ cross-validation mean with ±1 std whisker. Overlapping whiskers mean the difference between models is within split-to-split variation."
              >
                <MetricDotPlot rows={rows} metric={metric} />
              </ChartContainer>
            </>
          )}
          <Callout tone="info" title="No ranking">
            The order of models is fixed and carries no meaning. No model is labelled best, because no selection criterion
            is defined by the methodology.
          </Callout>
        </div>
      )}
    </div>
  )
}
