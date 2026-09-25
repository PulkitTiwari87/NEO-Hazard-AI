import { useMemo, useState } from 'react'
import type { FeatureAuditResponse, FeaturesResponse } from '../api/client'
import { EXPERIMENTS, unitFromName } from '../lib/research'
import { Callout, MetricCard, MetricGrid, MonoTag } from './ui'

type Cat = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

interface Band {
  cat: Cat
  title: string
  blurb: string
  rule: string // border-l color
  glyph: string // glyph box color
  status: string
  rationale: string
}

// Category names and rationale text mirror docs/FEATURE_AUDIT.md (the source of
// truth). Which features fall in A, B and F comes from /api/feature-audit.
const BANDS: Band[] = [
  {
    cat: 'A',
    title: 'Direct label-defining',
    blurb: "NASA/JPL's PHA rule is a direct threshold over these fields.",
    rule: 'border-l-danger',
    glyph: 'border-danger/60 text-danger',
    status: 'LABEL-DEFINING',
    rationale: 'The target is a threshold rule over this field; supplying it lets a model recover the rule rather than learn signal.',
  },
  {
    cat: 'B',
    title: 'Derived from label-defining',
    blurb: 'A NASA-side transform of a Category-A field, not an independent measurement.',
    rule: 'border-l-warn',
    glyph: 'border-warn/60 text-warn',
    status: 'DERIVED FROM A',
    rationale: 'Diameter is computed by NASA from absolute magnitude plus an assumed albedo, so it carries the same information as a Category-A field.',
  },
  {
    cat: 'C',
    title: 'Potential proxies',
    blurb: 'Features that may indirectly encode the label.',
    rule: 'border-l-accent',
    glyph: 'border-accent/60 text-accent',
    status: 'NOT CLASSIFIED',
    rationale: '',
  },
  {
    cat: 'D',
    title: 'Retained in leakage-aware sets',
    blurb: 'Used by at least one leakage-aware experiment. Retention is not proof of independence.',
    rule: 'border-l-ok',
    glyph: 'border-ok/60 text-ok',
    status: 'RETAINED',
    rationale: 'Not label-defining, not derived from a label-defining field, and not epoch-dependent. Possible proxies are discussed in docs/FEATURE_AUDIT.md.',
  },
  {
    cat: 'E',
    title: 'Metadata',
    blurb: 'Identifiers and descriptive fields.',
    rule: 'border-l-line-strong',
    glyph: 'border-line-strong text-muted',
    status: 'NOT CLASSIFIED',
    rationale: '',
  },
  {
    cat: 'F',
    title: 'Excluded / invalid',
    blurb: 'Not a fixed property of the object.',
    rule: 'border-l-line-strong',
    glyph: 'border-line-strong text-muted',
    status: 'EXCLUDED',
    rationale: 'Epoch-dependent orbital phase at catalog time, not a fixed property of the object.',
  },
]

interface Row {
  feature: string
  cat: Cat
  unit: string
  rationale: string
  used: Record<string, boolean>
}

const BADGE_TONE: Partial<Record<Cat, string>> = {
  A: 'border-danger/50 text-danger',
  B: 'border-warn/50 text-warn',
  F: 'border-line-strong text-faint line-through',
}

/** Feature name chip; carries its audit category as a letter, not only a color. */
export function FeatureBadge({ name, category }: { name: string; category?: 'A' | 'B' | 'F' }) {
  return (
    <span
      title={category ? `Category ${category}` : undefined}
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[11px] ${category ? BADGE_TONE[category] : 'border-line text-muted'}`}
    >
      {category && <span className="font-semibold no-underline">{category}</span>}
      {name}
    </span>
  )
}

export function FeatureAuditMatrix({ audit, features }: { audit: FeatureAuditResponse; features: FeaturesResponse | null }) {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<Cat | 'all'>('all')

  const { rows, unclassified } = useMemo(() => {
    const sets = audit.feature_sets
    const used = (feature: string) =>
      Object.fromEntries(
        EXPERIMENTS.map((e) => {
          const fs = sets[e.key]
          return [e.key, Boolean(fs && (fs.numeric_features.includes(feature) || fs.categorical_features.includes(feature)))]
        }),
      )
    const derived = new Map((features?.derived_features ?? []).map((d) => [d.name, d]))
    const A = new Set(audit.label_defining_features)
    const B = new Set(audit.label_derived_features)
    const F = new Set(audit.epoch_dependent_excluded_features)

    // Category D = features that appear in a leakage-aware experiment set (B/C/D) but not in A/B/F.
    const retained = new Set<string>()
    for (const e of EXPERIMENTS) {
      if (e.key === 'original') continue
      const fs = sets[e.key]
      if (fs) [...fs.numeric_features, ...fs.categorical_features].forEach((f) => !A.has(f) && !B.has(f) && !F.has(f) && retained.add(f))
    }

    const make = (feature: string, c: Cat): Row => {
      const band = BANDS.find((b) => b.cat === c)!
      const d = derived.get(feature)
      return {
        feature,
        cat: c,
        unit: d?.unit ?? unitFromName(feature),
        rationale: d?.rationale ?? band.rationale,
        used: used(feature),
      }
    }
    return {
      rows: [
        ...audit.label_defining_features.map((f) => make(f, 'A')),
        ...audit.label_derived_features.map((f) => make(f, 'B')),
        ...[...retained].sort().map((f) => make(f, 'D')),
        ...audit.epoch_dependent_excluded_features.map((f) => make(f, 'F')),
      ],
      unclassified: { C: true, E: true },
    }
  }, [audit, features])

  const q = query.trim().toLowerCase()
  const visible = rows.filter((r) => (cat === 'all' || r.cat === cat) && (!q || r.feature.toLowerCase().includes(q)))
  const count = (c: Cat) => rows.filter((r) => r.cat === c).length

  return (
    <div className="space-y-6">
      <MetricGrid className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {BANDS.map((b) => (
          <MetricCard
            key={b.cat}
            label={`Category ${b.cat}`}
            value={b.cat === 'C' || b.cat === 'E' ? '—' : count(b.cat)}
            sub={b.cat === 'C' || b.cat === 'E' ? 'Not classified by the API' : b.title}
          />
        ))}
      </MetricGrid>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <label htmlFor="feature-search" className="sr-only">Search features</label>
          <input
            id="feature-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search feature…"
            className="w-56 rounded-sm border border-line bg-surface px-3 py-1.5 font-mono text-xs text-ink placeholder:text-faint"
          />
        </div>
        <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-1.5">
          {(['all', ...BANDS.map((b) => b.cat)] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
              className={`rounded-sm border px-2.5 py-1 font-mono text-[11px] uppercase ${cat === c ? 'border-accent/60 bg-accent-soft text-ink' : 'border-line text-muted hover:text-ink'}`}
            >
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>
        <p className="ml-auto font-mono text-[11px] text-faint" aria-live="polite">
          {visible.length} of {rows.length} features
        </p>
      </div>

      {BANDS.map((band) => {
        if (cat !== 'all' && cat !== band.cat) return null
        const bandRows = visible.filter((r) => r.cat === band.cat)
        const isUnclassified = band.cat in unclassified
        if (!isUnclassified && bandRows.length === 0 && (q || cat !== 'all')) return null
        return (
          <section
            key={band.cat}
            aria-labelledby={`band-${band.cat}`}
            className={`overflow-hidden rounded-panel border border-line border-l-[3px] bg-surface ${band.rule}`}
          >
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
              <span aria-hidden="true" className={`flex h-8 w-8 items-center justify-center rounded-sm border font-display text-base font-semibold ${band.glyph}`}>
                {band.cat}
              </span>
              <div className="min-w-0">
                <h2 id={`band-${band.cat}`} className="font-display text-sm font-semibold text-ink">
                  Category {band.cat} — {band.title}
                </h2>
                <p className="text-xs text-muted">{band.blurb}</p>
              </div>
              <MonoTag className="ml-auto">{isUnclassified ? 'n/a' : `${count(band.cat)} features`}</MonoTag>
            </header>
            {isUnclassified ? (
              <p className="px-4 py-3 text-xs leading-relaxed text-muted">
                The audit endpoint does not classify features into this category, so none are listed. See{' '}
                <code className="font-mono">docs/FEATURE_AUDIT.md</code> for the written audit.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] text-left text-xs">
                  <caption className="sr-only">Category {band.cat} features</caption>
                  <thead className="text-muted">
                    <tr>
                      {['Feature', 'Category', 'Unit', 'Status', 'Rationale', 'Used in experiments'].map((h) => (
                        <th key={h} scope="col" className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.1em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bandRows.map((r) => (
                      <tr key={r.feature} className="border-t border-line align-top">
                        <th scope="row" className="whitespace-nowrap px-3 py-2 font-mono font-normal text-ink">{r.feature}</th>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] ${band.glyph}`}>{r.cat}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-muted">{r.unit}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">{band.status}</td>
                        <td className="max-w-md px-3 py-2 leading-relaxed text-muted">{r.rationale}</td>
                        <td className="px-3 py-2">
                          <ul className="flex gap-1" aria-label="Used in experiments">
                            {EXPERIMENTS.map((e) => (
                              <li
                                key={e.key}
                                title={`${e.tag}: ${r.used[e.key] ? 'used' : 'not used'}`}
                                className={`flex h-5 w-5 items-center justify-center rounded-sm border font-mono text-[10px] ${r.used[e.key] ? 'border-accent/60 bg-accent-soft text-ink' : 'border-line text-faint'}`}
                              >
                                {e.letter}
                                <span className="sr-only">{r.used[e.key] ? ' used' : ' not used'}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}

      <Callout tone="info" title="How to read this audit">
        Categories A, B and F come directly from the backend's feature audit; category D is derived as the set of features
        the leakage-aware experiments retain. Units are inferred from column-name suffixes. Full per-feature reasoning:{' '}
        <code className="font-mono">{audit.documentation}</code>.
      </Callout>
    </div>
  )
}
