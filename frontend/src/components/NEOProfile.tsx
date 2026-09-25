import { fmt, str } from '../lib/research'
import { EmptyResearchState, KeyValueList, MonoTag, ResearchSection, ScientificCard, StatusBadge } from './ui'

type NeoRecord = Record<string, unknown>

const ORBITAL = [
  'eccentricity',
  'semi_major_axis_au',
  'inclination_deg',
  'ascending_node_longitude_deg',
  'perihelion_distance_au',
  'aphelion_distance_au',
  'orbital_period_days',
  'mean_motion_deg_per_day',
  'mean_anomaly_deg',
  'moid_au',
  'orbit_class_type',
  'data_arc_in_days',
  'observations_used',
]
const PHYSICAL = ['absolute_magnitude_h', 'estimated_diameter_km_min', 'estimated_diameter_km_max']
const APPROACH = [
  'num_recorded_close_approaches',
  'closest_approach_date',
  'closest_miss_distance_km',
  'closest_relative_velocity_km_s',
]

const present = (r: NeoRecord, k: string) => r[k] !== null && r[k] !== undefined && r[k] !== ''

function show(value: unknown): string {
  return typeof value === 'number' ? (Number.isInteger(value) ? String(value) : fmt(value, 6)) : str(value)
}

/** Only fields the record actually carries are rendered; nothing is filled in. */
function fieldList(record: NeoRecord, keys: string[]) {
  // Column names already carry their unit suffix (_au, _deg, _km…), so they are shown as-is.
  return keys.filter((k) => present(record, k)).map((k) => ({ label: k, value: show(record[k]) }))
}

function Group({ id, title, eyebrow, items }: { id: string; title: string; eyebrow: string; items: { label: string; value: string }[] }) {
  return (
    <ResearchSection id={id} title={title} eyebrow={eyebrow}>
      {items.length ? (
        <ScientificCard>
          <KeyValueList items={items} columns="sm:grid-cols-2 lg:grid-cols-3" />
        </ScientificCard>
      ) : (
        <EmptyResearchState compact title="NOT IN THIS RECORD">
          <p>The dataset row for this object carries none of these fields.</p>
        </EmptyResearchState>
      )}
    </ResearchSection>
  )
}

export function NEOProfile({ record }: { record: NeoRecord }) {
  const hazardous = record.is_potentially_hazardous_asteroid
  const id = String(record.neo_id)

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {typeof hazardous === 'boolean' && (
          <StatusBadge tone={hazardous ? 'warn' : 'idle'}>
            {hazardous ? 'Potentially hazardous (NASA/JPL label)' : 'Not potentially hazardous (NASA/JPL label)'}
          </StatusBadge>
        )}
        {record.is_sentry_object === true && <StatusBadge tone="warn">Sentry object</StatusBadge>}
      </div>
      <p className="mb-6 max-w-2xl text-xs leading-relaxed text-muted">
        The hazard label is NASA/JPL's own geometric screening classification carried through the dataset. It is not an
        impact forecast and not a model output.
      </p>

      <Group id="orbital" eyebrow="Section 01" title="Orbital profile" items={fieldList(record, ORBITAL)} />
      <Group id="physical" eyebrow="Section 02" title="Physical properties" items={fieldList(record, PHYSICAL)} />
      <Group id="approach" eyebrow="Section 03" title="Close approaches" items={fieldList(record, APPROACH)} />

      <ResearchSection id="model" eyebrow="Section 04" title="Model predictions and explanations">
        <EmptyResearchState compact title="NOT EXPOSED BY THE API">
          <p>
            Per-object model predictions and SHAP explanations are stored in the experiment artifacts but not exposed by
            the API. Where an object appears among a run's recorded false positives or false negatives, it is linked from
            the Error Analysis page.
          </p>
        </EmptyResearchState>
      </ResearchSection>

      <ResearchSection id="anomaly" eyebrow="Section 05" title="Anomaly status">
        <EmptyResearchState compact title="NOT EXPOSED BY THE API">
          <p>Anomaly scores are not exposed by the API. An anomaly score is in any case not a hazard classification.</p>
        </EmptyResearchState>
      </ResearchSection>

      <ResearchSection id="provenance" eyebrow="Section 06" title="Raw provenance">
        <details className="rounded-panel border border-line bg-surface">
          <summary className="cursor-pointer px-4 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted hover:text-ink">
            Full dataset record for {id} ({Object.keys(record).length} fields)
          </summary>
          <div className="border-t border-line p-4">
            <MonoTag className="mb-3 block">Validated dataset row · data/processed/neo_dataset.csv</MonoTag>
            <KeyValueList
              columns="sm:grid-cols-2 lg:grid-cols-3"
              items={Object.entries(record).map(([k, v]) => ({ label: k, value: show(v) }))}
            />
          </div>
        </details>
      </ResearchSection>
    </div>
  )
}
