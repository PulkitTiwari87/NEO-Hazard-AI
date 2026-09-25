import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { CHART_COLORS, fmt, fmtInt, fmtPct, METRIC_KEYS, METRIC_LABEL, foldValue } from '../lib/research'

// Dependency-free SVG charts. Every coordinate plotted here comes straight
// from a backend artifact (ROC/PR points, threshold-sweep rows, confusion
// counts, fold metrics) — nothing is smoothed, interpolated or invented.
// Each chart exposes an aria-label and a keyboard-operable readout.

const W = 520
const H = 340
const M = { l: 50, r: 16, t: 14, b: 44 }
const PLOT_W = W - M.l - M.r
const PLOT_H = H - M.t - M.b

function tickFmt(v: number): string {
  if (Math.abs(v) >= 10) return v.toFixed(0)
  return v.toFixed(2).replace(/\.?0+$/, '') || '0'
}

function ticks(min: number, max: number, n = 5): number[] {
  const step = (max - min) / n
  return Array.from({ length: n + 1 }, (_, i) => min + i * step)
}

export interface Series {
  name: string
  color: string
  points: [number, number][]
  dashed?: boolean
}

interface LinePlotProps {
  series: Series[]
  xLabel: string
  yLabel: string
  ariaLabel: string
  xDomain?: [number, number]
  yDomain?: [number, number]
  /** Draw the y = x reference line (ROC chance / perfect calibration). */
  diagonal?: string
  /** Vertical marker at an x value (e.g. selected threshold). */
  marker?: number
  /** Plot points as dots too (sparse data such as calibration bins). */
  dots?: boolean
  /** Horizontal reference line, e.g. class prevalence. */
  hLine?: { y: number; label: string }
}

export function LinePlot({
  series,
  xLabel,
  yLabel,
  ariaLabel,
  xDomain = [0, 1],
  yDomain = [0, 1],
  diagonal,
  marker,
  dots = false,
  hLine,
}: LinePlotProps) {
  const [hx, setHx] = useState<number | null>(null)
  const [x0, x1] = xDomain
  const [y0, y1] = yDomain
  const sx = (v: number) => M.l + ((v - x0) / (x1 - x0)) * PLOT_W
  const sy = (v: number) => M.t + PLOT_H - ((v - y0) / (y1 - y0)) * PLOT_H
  const clamp = (v: number) => Math.min(x1, Math.max(x0, v))

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) * W) / rect.width
    setHx(clamp(x0 + ((px - M.l) / PLOT_W) * (x1 - x0)))
  }

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    const step = ((x1 - x0) / 100) * (e.shiftKey ? 10 : 1)
    if (e.key === 'ArrowRight') setHx((h) => clamp((h ?? x0) + step))
    else if (e.key === 'ArrowLeft') setHx((h) => clamp((h ?? x0) - step))
    else if (e.key === 'Escape') setHx(null)
    else return
    e.preventDefault()
  }

  const nearest = (s: Series, x: number) =>
    s.points.reduce<[number, number] | null>((best, p) => (best === null || Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best), null)

  const readout = hx === null ? [] : series.map((s) => ({ s, p: nearest(s, hx) })).filter((r) => r.p !== null)

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${ariaLabel}. Focus and use the left and right arrow keys to read values.`}
        tabIndex={0}
        className="w-full touch-none select-none"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHx(null)}
        onBlur={() => setHx(null)}
        onKeyDown={onKeyDown}
      >
        {ticks(y0, y1).map((t) => (
          <g key={`y${t}`}>
            <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke="rgb(255 255 255 / 0.06)" />
            <text x={M.l - 8} y={sy(t) + 3} textAnchor="end" className="fill-faint font-mono text-[10px]">
              {tickFmt(t)}
            </text>
          </g>
        ))}
        {ticks(x0, x1).map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} x2={sx(t)} y1={M.t + PLOT_H} y2={M.t + PLOT_H + 4} stroke="rgb(255 255 255 / 0.25)" />
            <text x={sx(t)} y={M.t + PLOT_H + 16} textAnchor="middle" className="fill-faint font-mono text-[10px]">
              {tickFmt(t)}
            </text>
          </g>
        ))}
        <line x1={M.l} x2={M.l} y1={M.t} y2={M.t + PLOT_H} stroke="rgb(255 255 255 / 0.25)" />
        <line x1={M.l} x2={W - M.r} y1={M.t + PLOT_H} y2={M.t + PLOT_H} stroke="rgb(255 255 255 / 0.25)" />
        <text x={M.l + PLOT_W / 2} y={H - 6} textAnchor="middle" className="fill-muted text-[11px]">
          {xLabel}
        </text>
        <text transform={`translate(13 ${M.t + PLOT_H / 2}) rotate(-90)`} textAnchor="middle" className="fill-muted text-[11px]">
          {yLabel}
        </text>

        {diagonal && (
          <line x1={sx(x0)} y1={sy(y0)} x2={sx(x1)} y2={sy(y1)} stroke={CHART_COLORS.muted} strokeDasharray="4 4" opacity="0.6">
            <title>{diagonal}</title>
          </line>
        )}
        {hLine && (
          <g>
            <line x1={M.l} x2={W - M.r} y1={sy(hLine.y)} y2={sy(hLine.y)} stroke={CHART_COLORS.muted} strokeDasharray="4 4" opacity="0.7" />
            <text x={W - M.r - 4} y={sy(hLine.y) - 5} textAnchor="end" className="fill-muted font-mono text-[10px]">
              {hLine.label}
            </text>
          </g>
        )}
        {marker !== undefined && (
          <line x1={sx(marker)} x2={sx(marker)} y1={M.t} y2={M.t + PLOT_H} stroke={CHART_COLORS.accent} strokeDasharray="2 3" opacity="0.8" />
        )}

        {series.map((s) => (
          <g key={s.name}>
            <path
              d={s.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              strokeLinejoin="round"
              pathLength={s.dashed ? undefined : 1}
              className={s.dashed ? undefined : 'draw-in'}
            />
            {dots &&
              s.points.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={3} fill={s.color} />)}
          </g>
        ))}

        {hx !== null && (
          <g pointerEvents="none">
            <line x1={sx(hx)} x2={sx(hx)} y1={M.t} y2={M.t + PLOT_H} stroke="rgb(255 255 255 / 0.35)" />
            {readout.map(({ s, p }) => (
              <circle key={s.name} cx={sx(p![0])} cy={sy(p![1])} r={4} fill={s.color} stroke="#05070d" strokeWidth={1.5} />
            ))}
          </g>
        )}
      </svg>
      <p aria-live="polite" className="mt-2 min-h-[2.5rem] font-mono text-[11px] leading-relaxed text-muted">
        {readout.length === 0
          ? 'Hover, or focus the chart and use ← → to read exact values.'
          : readout.map(({ s, p }) => (
              <span key={s.name} className="mr-4 inline-block">
                <span style={{ color: s.color }}>{s.name}</span> x={fmt(p![0])} y={fmt(p![1])}
              </span>
            ))}
      </p>
    </div>
  )
}

export function Legend({ items }: { items: { name: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden="true">
            <line x1="0" x2="18" y1="3" y2="3" stroke={i.color} strokeWidth="2" strokeDasharray={i.dashed ? '4 3' : undefined} />
          </svg>
          {i.name}
        </li>
      ))}
    </ul>
  )
}

export function RocChart({ fpr, tpr, auc }: { fpr: number[]; tpr: number[]; auc?: number | null }) {
  return (
    <LinePlot
      series={[{ name: 'ROC', color: CHART_COLORS.accent, points: fpr.map((f, i) => [f, tpr[i]]) }]}
      xLabel="False positive rate"
      yLabel="True positive rate"
      diagonal="Chance level (AUC = 0.5)"
      ariaLabel={`ROC curve on the held-out test set, ${fpr.length} points, ROC-AUC ${fmt(auc)}`}
    />
  )
}

export function PrChart({
  precision,
  recall,
  ap,
  prevalence,
}: {
  precision: number[]
  recall: number[]
  ap?: number | null
  prevalence?: number | null
}) {
  return (
    <LinePlot
      series={[{ name: 'PR', color: CHART_COLORS.green, points: recall.map((r, i) => [r, precision[i]]) }]}
      xLabel="Recall"
      yLabel="Precision"
      hLine={typeof prevalence === 'number' ? { y: prevalence, label: `prevalence ${fmt(prevalence)}` } : undefined}
      ariaLabel={`Precision-recall curve on the held-out test set, ${precision.length} points, average precision ${fmt(ap)}`}
    />
  )
}

export function ThresholdChart({
  rows,
  selected,
}: {
  rows: { threshold: number; precision: number; recall: number; f1: number }[]
  selected?: number
}) {
  const s = (key: 'precision' | 'recall' | 'f1', color: string, name: string): Series => ({
    name,
    color,
    points: rows.map((r) => [r.threshold, r[key]]),
  })
  return (
    <LinePlot
      series={[
        s('precision', CHART_COLORS.blue, 'precision'),
        s('recall', CHART_COLORS.orange, 'recall'),
        s('f1', CHART_COLORS.green, 'F1'),
      ]}
      xDomain={[0, 1]}
      xLabel="Decision threshold"
      yLabel="Score"
      marker={selected}
      dots
      ariaLabel={`Threshold sweep of precision, recall and F1 across ${rows.length} thresholds`}
    />
  )
}

export function CalibrationChart({ probPred, probTrue }: { probPred: number[]; probTrue: number[] }) {
  return (
    <LinePlot
      series={[{ name: 'observed', color: CHART_COLORS.accent, points: probPred.map((p, i) => [p, probTrue[i]]) }]}
      xLabel="Mean predicted probability (per quantile bin)"
      yLabel="Observed fraction positive"
      diagonal="Perfect calibration"
      dots
      ariaLabel={`Calibration curve with ${probPred.length} quantile bins`}
    />
  )
}

// ---------------------------------------------------------------------------

type CellKey = 'tn' | 'fp' | 'fn' | 'tp'

const CELL_TEXT: Record<CellKey, { title: string; body: string; correct: boolean }> = {
  tn: {
    title: 'True negative',
    body: 'NASA/JPL labelled these objects not potentially hazardous, and the model predicted the same.',
    correct: true,
  },
  fp: {
    title: 'False positive',
    body: 'NASA/JPL labelled these objects not potentially hazardous, but the model predicted potentially hazardous.',
    correct: false,
  },
  fn: {
    title: 'False negative',
    body: 'NASA/JPL labelled these objects potentially hazardous, but the model predicted not hazardous — the label was not recovered.',
    correct: false,
  },
  tp: {
    title: 'True positive',
    body: 'NASA/JPL labelled these objects potentially hazardous, and the model predicted the same.',
    correct: true,
  },
}

export function ConfusionMatrix({ tn, fp, fn, tp }: { tn: number; fp: number; fn: number; tp: number }) {
  const [sel, setSel] = useState<CellKey>('fn')
  const total = tn + fp + fn + tp
  const counts: Record<CellKey, number> = { tn, fp, fn, tp }
  const rowTotal: Record<CellKey, number> = { tn: tn + fp, fp: tn + fp, fn: fn + tp, tp: fn + tp }
  const max = Math.max(tn, fp, fn, tp, 1)
  const layout: CellKey[][] = [
    ['tn', 'fp'],
    ['fn', 'tp'],
  ]

  return (
    <div>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 text-xs" role="group" aria-label="Confusion matrix, held-out test set">
        <div />
        <div className="pb-1 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Predicted negative</div>
        <div className="pb-1 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Predicted positive</div>
        {layout.map((row, ri) => (
          <div key={ri} className="contents">
            <div className="flex items-center pr-2 font-mono text-[10px] uppercase tracking-[0.1em] text-faint [writing-mode:vertical-rl] rotate-180">
              {ri === 0 ? 'Actual negative' : 'Actual positive'}
            </div>
            {row.map((key) => {
              const info = CELL_TEXT[key]
              const alpha = 0.08 + (counts[key] / max) * 0.4
              const bg = info.correct ? `rgb(56 189 248 / ${alpha})` : `rgb(245 158 11 / ${alpha})`
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSel(key)}
                  aria-pressed={sel === key}
                  aria-label={`${info.title}: ${counts[key]} objects, ${fmtPct(total ? counts[key] / total : null)} of all`}
                  style={{ backgroundColor: bg }}
                  className={`rounded-panel border p-3 text-left transition-colors ${sel === key ? 'border-ink/70' : 'border-line hover:border-line-strong'}`}
                >
                  <span className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-ink/80">
                    {info.title}
                    <span aria-hidden="true">{info.correct ? '✓' : '✕'}</span>
                  </span>
                  <span className="mt-1 block font-display text-3xl font-semibold tabular-nums text-ink">{fmtInt(counts[key])}</span>
                  <span className="mt-0.5 block font-mono text-[10px] text-ink/70">
                    {fmtPct(total ? counts[key] / total : null)} of all · {fmtPct(rowTotal[key] ? counts[key] / rowTotal[key] : null)} of actual class
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <p aria-live="polite" className="mt-3 rounded-panel border border-line bg-raised px-3 py-2 text-xs leading-relaxed text-muted">
        <span className="font-medium text-ink">{CELL_TEXT[sel].title}.</span> {CELL_TEXT[sel].body}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------

/** One row per metric: individual fold values as dots, min–max range as a bar, mean as a tick. */
export function FoldStrip({ folds }: { folds: Record<string, unknown>[] }) {
  const rowH = 38
  const left = 96
  const width = 520
  const track = width - left - 16
  const x = (v: number) => left + v * track
  return (
    <svg
      viewBox={`0 0 ${width} ${METRIC_KEYS.length * rowH + 28}`}
      role="img"
      aria-label={`Per-fold values for ${METRIC_KEYS.length} metrics across ${folds.length} cross-validation folds`}
      className="w-full"
    >
      {ticks(0, 1).map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={6} y2={METRIC_KEYS.length * rowH + 6} stroke="rgb(255 255 255 / 0.06)" />
          <text x={x(t)} y={METRIC_KEYS.length * rowH + 22} textAnchor="middle" className="fill-faint font-mono text-[10px]">
            {tickFmt(t)}
          </text>
        </g>
      ))}
      {METRIC_KEYS.map((key, r) => {
        const values = folds.map((f) => foldValue(f, key))
        const present = values.filter((v): v is number => v !== null)
        const cy = 6 + r * rowH + rowH / 2
        const mean = present.length ? present.reduce((a, b) => a + b, 0) / present.length : null
        return (
          <g key={key}>
            <text x={0} y={cy + 4} className="fill-muted text-[11px]">
              {METRIC_LABEL[key]}
            </text>
            {present.length === 0 ? (
              <text x={left} y={cy + 4} className="fill-faint font-mono text-[10px]">
                not computed
              </text>
            ) : (
              <>
                <rect
                  x={x(Math.min(...present))}
                  y={cy - 6}
                  width={Math.max(2, x(Math.max(...present)) - x(Math.min(...present)))}
                  height={12}
                  rx={2}
                  fill="rgb(56 189 248 / 0.14)"
                />
                {mean !== null && <line x1={x(mean)} x2={x(mean)} y1={cy - 10} y2={cy + 10} stroke="#e6ebf2" strokeWidth={1.5} />}
                {values.map((v, i) =>
                  v === null ? null : (
                    <g key={i}>
                      <circle cx={x(v)} cy={cy} r={4.5} fill={CHART_COLORS.accent} stroke="#05070d" strokeWidth={1.5}>
                        <title>{`Fold ${i + 1}: ${METRIC_LABEL[key]} ${fmt(v)}`}</title>
                      </circle>
                    </g>
                  ),
                )}
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------

export interface BarEntry {
  name: string
  value: number
  err?: number | null
}

/** Horizontal bars around a zero line, with optional ±std whiskers. Handles negative values. */
export function ImportanceBars({ entries, color = CHART_COLORS.accent, unit }: { entries: BarEntry[]; color?: string; unit?: string }) {
  if (!entries.length) return <p className="text-xs text-muted">No values in this artifact.</p>
  const lo = Math.min(0, ...entries.map((e) => e.value - (e.err ?? 0)))
  const hi = Math.max(0, ...entries.map((e) => e.value + (e.err ?? 0)), 1e-12)
  const span = hi - lo || 1
  const pos = (v: number) => `${((v - lo) / span) * 100}%`
  return (
    <ul className="space-y-1.5" aria-label={unit ? `Bar chart, ${unit}` : 'Bar chart'}>
      {entries.map((e) => {
        const a = Math.min(0, e.value)
        const b = Math.max(0, e.value)
        return (
          <li key={e.name} className="grid grid-cols-[minmax(6rem,11rem)_1fr_4.5rem] items-center gap-2 text-xs">
            <span className="truncate font-mono text-muted" title={e.name}>
              {e.name}
            </span>
            <div className="relative h-4 rounded-sm bg-white/[0.03]">
              <div className="absolute top-0 h-full w-px bg-white/25" style={{ left: pos(0) }} />
              <div
                className="absolute top-0.5 h-3 rounded-sm"
                style={{ left: pos(a), width: `${((b - a) / span) * 100}%`, backgroundColor: color, opacity: 0.75 }}
              />
              {typeof e.err === 'number' && e.err > 0 && (
                <div
                  className="absolute top-[7px] h-0.5 bg-ink/80"
                  style={{ left: pos(e.value - e.err), width: `${((2 * e.err) / span) * 100}%` }}
                  title={`±${fmt(e.err, 4)} (std)`}
                />
              )}
            </div>
            <span className="text-right font-mono tabular-nums text-ink">{e.value.toFixed(4)}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** Plain percentage bars (0–100) — missing-value rates, class balance. */
export function PercentBars({ rows }: { rows: { label: string; value: number; text?: string; tone?: 'accent' | 'warn' }[] }) {
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(6rem,14rem)_1fr_4rem] items-center gap-2 text-xs">
          <span className="truncate font-mono text-muted" title={r.label}>
            {r.label}
          </span>
          <div className="h-2.5 rounded-sm bg-white/[0.04]">
            <div
              className="h-full rounded-sm"
              style={{
                width: `${Math.min(100, Math.max(r.value > 0 ? 1 : 0, r.value))}%`,
                backgroundColor: r.tone === 'warn' ? '#f59e0b' : CHART_COLORS.accent,
                opacity: 0.8,
              }}
            />
          </div>
          <span className="text-right font-mono tabular-nums text-ink">{r.text ?? `${r.value.toFixed(1)}%`}</span>
        </li>
      ))}
    </ul>
  )
}

/** Stacked two-class histogram computed from real records supplied by the caller. */
export function Histogram({
  bins,
  labels,
  xLabel,
}: {
  bins: { x0: number; x1: number; a: number; b: number }[]
  labels: [string, string]
  xLabel: string
}) {
  const hh = 220
  const ww = 520
  const ml = 44
  const mb = 34
  const max = Math.max(...bins.map((b) => b.a + b.b), 1)
  const bw = (ww - ml - 10) / bins.length
  return (
    <div>
      <svg viewBox={`0 0 ${ww} ${hh}`} role="img" aria-label={`Histogram of ${xLabel}, ${bins.length} bins`} className="w-full">
        {ticks(0, max, 4).map((t) => (
          <g key={t}>
            <line x1={ml} x2={ww - 10} y1={hh - mb - (t / max) * (hh - mb - 10)} y2={hh - mb - (t / max) * (hh - mb - 10)} stroke="rgb(255 255 255 / 0.06)" />
            <text x={ml - 6} y={hh - mb - (t / max) * (hh - mb - 10) + 3} textAnchor="end" className="fill-faint font-mono text-[10px]">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {bins.map((b, i) => {
          const ha = (b.a / max) * (hh - mb - 10)
          const hb = (b.b / max) * (hh - mb - 10)
          const x = ml + i * bw
          return (
            <g key={i}>
              <rect x={x + 1} y={hh - mb - ha} width={bw - 2} height={ha} fill={CHART_COLORS.accent} opacity="0.75">
                <title>{`${labels[0]}: ${b.a} (${fmt(b.x0, 3)} – ${fmt(b.x1, 3)})`}</title>
              </rect>
              <rect x={x + 1} y={hh - mb - ha - hb} width={bw - 2} height={hb} fill="#f59e0b" opacity="0.85">
                <title>{`${labels[1]}: ${b.b} (${fmt(b.x0, 3)} – ${fmt(b.x1, 3)})`}</title>
              </rect>
            </g>
          )
        })}
        <line x1={ml} x2={ww - 10} y1={hh - mb} y2={hh - mb} stroke="rgb(255 255 255 / 0.25)" />
        <text x={ml} y={hh - 16} className="fill-faint font-mono text-[10px]">
          {fmt(bins[0]?.x0, 3)}
        </text>
        <text x={ww - 10} y={hh - 16} textAnchor="end" className="fill-faint font-mono text-[10px]">
          {fmt(bins[bins.length - 1]?.x1, 3)}
        </text>
        <text x={(ml + ww) / 2} y={hh - 3} textAnchor="middle" className="fill-muted text-[11px]">
          {xLabel}
        </text>
      </svg>
      <Legend
        items={[
          { name: labels[0], color: CHART_COLORS.accent },
          { name: labels[1], color: '#f59e0b' },
        ]}
      />
    </div>
  )
}

export function ChartFallback({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted">{children}</p>
}
