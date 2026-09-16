// Thin fetch wrapper for the NEO-Hazard-AI backend. Every call returns real
// data from the FastAPI backend (see ../../../backend/main.py) — this file
// contains no hardcoded statistics or placeholder numbers. When the backend
// itself has nothing to report (data not ingested, model not trained), it
// returns { status: "unavailable", detail: "..." } and the pages below
// render that state explicitly.

const BASE_URL = '/api'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`)
  if (!response.ok && response.status !== 404 && response.status !== 503) {
    throw new Error(`Request to ${path} failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

export interface DataSourceInfo {
  source_name: string
  source_url: string
  documentation_url: string
  ingestion_has_run: boolean
  raw_files_present: string[]
  note: string
}

export interface StatisticsResponse {
  status: 'ok' | 'unavailable'
  detail?: string
  row_count?: number
  hazardous_count?: number
  non_hazardous_count?: number
  null_percentage_by_column?: Record<string, number>
}

export interface NeoListResponse {
  status: 'ok' | 'unavailable'
  detail?: string
  total_count?: number
  limit?: number
  offset?: number
  results: Record<string, unknown>[]
}

export interface ModelsResponse {
  status: 'ok' | 'unavailable'
  models: Record<string, unknown>[]
}

export interface ModelMetricsResponse {
  status: 'ok' | 'unavailable'
  detail?: string
  model?: string
  metrics?: Record<string, unknown>
}

export interface FeaturesResponse {
  target_column: string
  nasa_provided_features: string[]
  categorical_features: string[]
  derived_features: {
    name: string
    formula: string
    source_fields: string[]
    unit: string
    rationale: string
  }[]
}

export interface LimitationsResponse {
  is_operational_hazard_system: boolean
  predicts_impacts: boolean
  replaces_nasa_jpl_assessment: boolean
  summary: string
}

export const api = {
  health: () => getJson<{ status: string }>('/health'),
  dataSource: () => getJson<DataSourceInfo>('/data-source'),
  statistics: () => getJson<StatisticsResponse>('/statistics'),
  neos: (params: { limit?: number; offset?: number; hazardousOnly?: boolean } = {}) => {
    const query = new URLSearchParams()
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    if (params.offset !== undefined) query.set('offset', String(params.offset))
    if (params.hazardousOnly) query.set('hazardous_only', 'true')
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return getJson<NeoListResponse>(`/neos${suffix}`)
  },
  models: () => getJson<ModelsResponse>('/models'),
  modelMetrics: (modelName: string) => getJson<ModelMetricsResponse>(`/models/${modelName}/metrics`),
  features: () => getJson<FeaturesResponse>('/features'),
  limitations: () => getJson<LimitationsResponse>('/limitations'),
}
