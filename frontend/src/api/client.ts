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

export interface FeatureAuditResponse {
  label_defining_features: string[]
  label_derived_features: string[]
  epoch_dependent_excluded_features: string[]
  documentation: string
  feature_sets: Record<
    string,
    {
      display_name: string
      purpose: string
      numeric_features: string[]
      categorical_features: string[]
    }
  >
}

export interface ExperimentModelStatus {
  executed: boolean
  trained_at_utc?: string
  cv_f1_mean?: number | null
  cv_f1_std?: number | null
  test_f1?: number | null
  test_precision?: number | null
  test_recall?: number | null
  test_accuracy?: number | null
  test_roc_auc?: number | null
  test_pr_auc?: number | null
}

export interface ExperimentsListResponse {
  status: 'ok' | 'unavailable'
  experiments: Record<
    string,
    {
      display_name: string
      purpose: string
      feature_columns: string[]
      models: Record<string, ExperimentModelStatus>
    }
  >
}

export interface ExperimentDetailResponse {
  status: 'ok' | 'unavailable'
  detail?: string
  metadata?: Record<string, unknown>
  cv_metrics?: Record<string, { mean: number | null; std: number | null; n_folds: number }>
  fold_metrics?: Record<string, unknown>[]
  test_metrics?: Record<string, unknown> & {
    confusion_matrix?: { labels: string[]; matrix: number[][]; tn: number; fp: number; fn: number; tp: number }
    f1_bootstrap_ci?: { point_estimate: number; ci_low: number; ci_high: number; ci_level: number }
  }
  confusion_matrix?: { labels: string[]; matrix: number[][]; tn: number; fp: number; fn: number; tp: number }
  roc_curve?: { fpr: number[]; tpr: number[]; thresholds: number[] } | null
  pr_curve?: { precision: number[]; recall: number[]; average_precision: number } | null
  threshold_analysis?: {
    grid: { threshold: number; precision: number; recall: number; f1: number }[]
    best_by_f1: { threshold: number; precision: number; recall: number; f1: number } | null
  }
  calibration?: { brier_score: number; prob_true: number[]; prob_pred: number[] } | null
  feature_importance?: {
    feature_names: string[]
    model_specific: Record<string, number> | null
    permutation_importance: { features: string[]; mean: number[]; std: number[] }
  }
  shap_summary?: { global_mean_abs_shap: Record<string, number>; sample_size: number } | null
  error_summary?: Record<string, { n_rows: number; feature_stats: Record<string, Record<string, number>> }>
  false_positives_sample?: Record<string, unknown>[]
  false_negatives_sample?: Record<string, unknown>[]
}

export interface ReproducibilityResponse {
  random_seed: number
  n_cv_folds: number
  outer_test_size: number
  feature_sets: string[]
  models: string[]
  dataset_provenance: Record<string, unknown> | null
  last_benchmark_run: Record<string, unknown> | null
  reproduce_with: string[]
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
  featureAudit: () => getJson<FeatureAuditResponse>('/feature-audit'),
  experiments: () => getJson<ExperimentsListResponse>('/experiments'),
  experimentDetail: (experiment: string, modelName: string) =>
    getJson<ExperimentDetailResponse>(`/experiments/${experiment}/${modelName}`),
  reproducibility: () => getJson<ReproducibilityResponse>('/reproducibility'),
}
