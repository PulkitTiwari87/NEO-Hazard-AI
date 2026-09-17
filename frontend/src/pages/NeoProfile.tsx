import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  api,
  MODEL_LABEL,
  MODEL_NAMES,
  type ExperimentExplainabilityResponse,
  type ExperimentId,
  type ModelName,
} from '../api/client'
import { UnavailableNotice } from '../components/UnavailableNotice'
import { ChartCard } from '../components/ChartCard'
import { ExperimentSelector } from '../components/research/ExperimentSelector'
import { ModelSelector } from '../components/research/ModelSelector'
import { SignedBarChart } from '../components/charts/SignedBarChart'

const PREDICT_FIELDS = [
  'absolute_magnitude_h',
  'eccentricity',
  'semi_major_axis_au',
  'inclination_deg',
  'ascending_node_longitude_deg',
  'orbital_period_days',
  'perihelion_distance_au',
  'aphelion_distance_au',
  'mean_anomaly_deg',
  'mean_motion_deg_per_day',
  'moid_au',
  'data_arc_in_days',
  'observations_used',
  'num_recorded_close_approaches',
  'closest_miss_distance_km',
  'closest_relative_velocity_km_s',
  'estimated_diameter_km_min',
  'estimated_diameter_km_max',
  'orbit_class_type',
] as const

function Field({ label, value, unit }: { label: string; value: unknown; unit?: string }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex justify-between gap-3 border-b border-white/5 py-1.5 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-200">
        {String(value)}
        {unit ? ` ${unit}` : ''}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {children}
    </div>
  )
}

export function NeoProfile() {
  const { id } = useParams<{ id: string }>()
  const [record, setRecord] = useState<Record<string, unknown> | null | 'not_found'>(null)
  const [anomaly, setAnomaly] = useState<{ status: string; ml_anomaly_score?: number; ml_flagged_outlier?: boolean; detail?: string } | null>(null)
  const [experimentId, setExperimentId] = useState<ExperimentId>('experiment_a_original')
  const [modelName, setModelName] = useState<ModelName>('random_forest')
  const [explainability, setExplainability] = useState<ExperimentExplainabilityResponse | null>(null)
  const [prediction, setPrediction] = useState<{ httpStatus: number; body: Record<string, unknown> } | null>(null)

  useEffect(() => {
    if (!id) return
    api
      .neo(id)
      .then(setRecord)
      .catch(() => setRecord('not_found'))
    api.neoAnomaly(id).then(setAnomaly).catch(() => null)
  }, [id])

  useEffect(() => {
    api.experimentExplainability(experimentId, modelName).then(setExplainability).catch(() => null)
  }, [experimentId, modelName])

  useEffect(() => {
    if (!record || record === 'not_found') return
    const payload: Record<string, unknown> = { model_name: modelName }
    for (const f of PREDICT_FIELDS) payload[f] = record[f] ?? null
    api.predict(payload).then(setPrediction).catch(() => null)
  }, [record, modelName])

  if (record === 'not_found') {
    return <UnavailableNotice detail={`No NEO found with id '${id}'.`} />
  }
  if (!record) {
    return <p className="text-sm text-slate-500">Loading…</p>
  }

  const localExample = explainability?.local_examples?.find((e) => String(e.neo_id) === String(id))

  return (
    <div className="space-y-6">
      <div>
        <Link to="/explorer" className="text-xs text-sky-400 hover:underline">
          ← back to NEO Explorer
        </Link>
        <h2 className="mt-1 text-lg font-semibold text-slate-100">
          {String(record.name ?? record.neo_id)}
        </h2>
        <p className="text-xs text-slate-500">
          NASA/JPL identifier: <span className="font-mono">{String(record.neo_id)}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Section title="Identification">
          <Field label="NASA/JPL ID" value={record.neo_id} />
          <Field label="Name" value={record.name} />
          <Field label="Designation" value={record.designation} />
        </Section>

        <Section title="Physical properties">
          <Field label="Absolute magnitude (H)" value={record.absolute_magnitude_h} />
          <Field label="Diameter min" value={record.estimated_diameter_km_min} unit="km" />
          <Field label="Diameter max" value={record.estimated_diameter_km_max} unit="km" />
        </Section>

        <Section title="Orbital properties">
          <Field label="Eccentricity" value={record.eccentricity} />
          <Field label="Semi-major axis" value={record.semi_major_axis_au} unit="au" />
          <Field label="Inclination" value={record.inclination_deg} unit="°" />
          <Field label="Ascending node longitude" value={record.ascending_node_longitude_deg} unit="°" />
          <Field label="Orbital period" value={record.orbital_period_days} unit="days" />
          <Field label="Perihelion distance" value={record.perihelion_distance_au} unit="au" />
          <Field label="Aphelion distance" value={record.aphelion_distance_au} unit="au" />
          <Field label="Mean anomaly" value={record.mean_anomaly_deg} unit="°" />
          <Field label="Mean motion" value={record.mean_motion_deg_per_day} unit="°/day" />
          <Field label="MOID" value={record.moid_au} unit="au" />
          <Field label="Orbit class" value={record.orbit_class_type} />
          <Field label="Data arc" value={record.data_arc_in_days} unit="days" />
          <Field label="Observations used" value={record.observations_used} />
        </Section>

        <Section title="Close approach">
          <Field label="Closest approach date" value={record.closest_approach_date} />
          <Field label="Closest miss distance" value={record.closest_miss_distance_km} unit="km" />
          <Field label="Closest relative velocity" value={record.closest_relative_velocity_km_s} unit="km/s" />
          <Field label="Recorded close approaches" value={record.num_recorded_close_approaches} />
        </Section>

        <Section title="NASA/JPL classification">
          <Field label="Potentially hazardous" value={record.is_potentially_hazardous_asteroid ? 'Yes' : 'No'} />
          <Field label="Sentry object" value={record.is_sentry_object ? 'Yes' : 'No'} />
        </Section>

        <Section title="Anomaly analysis">
          {anomaly?.status === 'ok' ? (
            <>
              <Field label="ML anomaly score" value={anomaly.ml_anomaly_score?.toFixed(4)} />
              <Field label="Flagged outlier" value={anomaly.ml_flagged_outlier ? 'Yes' : 'No'} />
              <p className="mt-2 text-[11px] text-slate-500">
                Statistical unusualness in feature space, not a hazard/risk/danger score.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">{anomaly?.detail ?? 'Result not available.'}</p>
          )}
        </Section>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Model output</p>
          <div className="flex flex-wrap gap-2">
            <ExperimentSelector value={experimentId} onChange={setExperimentId} />
            <ModelSelector value={modelName} onChange={setModelName} />
          </div>
        </div>
        {prediction?.httpStatus === 200 ? (
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <Field label="Prediction" value={prediction.body.prediction} />
            <Field label="Model" value={MODEL_LABEL[modelName]} />
            <Field label="Model version" value={prediction.body.model_version} />
            {typeof prediction.body.model_score === 'number' && (
              <Field label="Model score" value={(prediction.body.model_score as number).toFixed(4)} />
            )}
            <p className="col-span-full mt-2 text-xs text-slate-500">{String(prediction.body.interpretation ?? '')}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {prediction ? String(prediction.body.detail ?? 'Prediction unavailable.') : 'Loading…'}
          </p>
        )}
      </div>

      <ChartCard
        title="Explainability — local SHAP contributions"
        description={`Experiment: ${experimentId} · Model: ${MODEL_LABEL[modelName]}`}
        note="SHAP explains this trained model's behavior for this record; it is not a physical causal explanation."
      >
        {localExample ? (
          <SignedBarChart items={localExample.top_contributing_features.map((f) => ({ feature: f.feature, value: f.shap_value }))} />
        ) : (
          <p className="text-sm text-slate-500">
            This record is not in the sampled SHAP local-explanation set for {experimentId}/{modelName} (SHAP is
            computed for a random sample of the holdout set, not every record) — see the{' '}
            <Link to="/explainability" className="text-sky-400 hover:underline">
              Explainability
            </Link>{' '}
            page for the global picture.
          </p>
        )}
      </ChartCard>

      <p className="text-xs text-slate-500">
        Models: {MODEL_NAMES.map((m) => MODEL_LABEL[m]).join(', ')} — select above to compare predictions for this
        record.
      </p>
    </div>
  )
}
