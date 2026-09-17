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

export interface ModelRegistryEntry {
  model_name: string
  model_version: string
  trained_at_utc: string
  dataset_path: string
  dataset_row_count: number
  feature_columns: string[]
  categorical_features: string[]
  numeric_features: string[]
  target_column: string
  random_seed: number
  test_size: number
  hyperparameters: Record<string, string>
}

export interface ModelsResponse {
  status: 'ok' | 'unavailable'
  models: ModelRegistryEntry[]
}

export interface ConfusionMatrix {
  labels: [string, string]
  matrix: [[number, number], [number, number]]
}

export interface ClassificationMetrics {
  accuracy: number
  precision: number
  recall: number
  f1: number
  confusion_matrix: ConfusionMatrix
  roc_auc: number | null
  pr_auc: number | null
  roc_curve: { fpr: number[]; tpr: number[] } | null
  pr_curve: { precision: number[]; recall: number[] } | null
}

export interface ModelMetricsResponse {
  status: 'ok' | 'unavailable'
  detail?: string
  model?: string
  metrics?: ClassificationMetrics
}

export interface ExplainabilityResponse {
  status: 'ok' | 'unavailable'
  detail?: string
  model?: string
  global_importance?: { feature: string; mean_abs_shap: number }[]
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

// ---------------------------------------------------------------------------
// Dataset / data-quality / EDA
// ---------------------------------------------------------------------------

export interface NumericRange {
  min: number
  max: number
  mean: number
  median: number
  std: number
}

export interface CleaningReport {
  rows_before: number
  rows_after: number
  dropped_missing_id: number
  dropped_missing_target: number
  dropped_duplicate_id: number
  null_percentage_by_column: Record<string, number>
}

export interface DatasetQualityResponse {
  status: 'ok' | 'unavailable'
  detail?: string
  row_count?: number
  unique_neo_count?: number
  duplicate_neo_id_count?: number
  class_distribution?: {
    hazardous_count: number
    non_hazardous_count: number
    hazardous_percentage: number | null
  }
  missing_value_counts?: Record<string, number>
  missing_value_percentages?: Record<string, number>
  numeric_ranges?: Record<string, NumericRange | null>
  categorical_cardinality?: Record<string, { unique_count: number; value_counts: Record<string, number> }>
  cleaning_report?: CleaningReport | null
  schema_validation_report?: { total_records: number; missing_required_field_counts: Record<string, number> } | null
  note?: string
}

export interface DatasetCorrelationsResponse {
  status: 'ok' | 'unavailable'
  detail?: string
  method?: 'pearson' | 'spearman'
  features?: string[]
  matrix?: (number | null)[][]
  missing_value_handling?: string
  note?: string
}

export interface DatasetFullResponse {
  status: 'ok' | 'unavailable'
  detail?: string
  total_count?: number
  returned_count?: number
  sampled?: boolean
  sample_note?: string | null
  results: Record<string, unknown>[]
}

// ---------------------------------------------------------------------------
// Experiments (Experiment A / Experiment B research pipeline)
// ---------------------------------------------------------------------------

export interface ExperimentDefinition {
  id: string
  name: string
  short_name: string
  numeric_features: string[]
  categorical_features: string[]
  excluded_features: string[]
  purpose: string
  rationale: string
}

export interface ComparisonRow {
  experiment_id: string
  model_name: string
  accuracy: number
  precision: number
  recall: number
  f1: number
  roc_auc: number | null
  pr_auc: number | null
  cv_accuracy_mean: number | null
  cv_accuracy_std: number | null
  cv_f1_mean: number | null
  cv_f1_std: number | null
  cv_roc_auc_mean: number | null
  cv_roc_auc_std: number | null
  cv_pr_auc_mean: number | null
  cv_pr_auc_std: number | null
}

export interface ExperimentsIndexResponse {
  status: 'ok' | 'unavailable'
  detail?: string
  experiment_definitions?: Record<string, ExperimentDefinition>
  generated_at_utc?: string
  dataset_path?: string
  dataset_row_count?: number
  random_seed?: number
  test_size?: number
  cv_folds?: number
  split_strategy?: string
  models?: string[]
  experiments?: Record<string, ExperimentDefinition>
  comparison_table?: ComparisonRow[]
}

export interface HoldoutResponse {
  status: 'ok' | 'unavailable'
  detail?: string
  experiment_id?: string
  model_name?: string
  train_rows?: number
  holdout_rows?: number
  random_seed?: number
  test_size?: number
  trained_at_utc?: string
  metrics?: ClassificationMetrics
}

export interface FoldResult {
  fold: number
  train_rows: number
  val_rows: number
  accuracy: number
  precision: number
  recall: number
  f1: number
  confusion_matrix: ConfusionMatrix
  roc_auc: number | null
  pr_auc: number | null
}

export interface MeanStd {
  mean: number | null
  std: number | null
}

export interface CvResponse {
  status: 'ok' | 'unavailable'
  detail?: string
  experiment_id?: string
  model_name?: string
  folds?: number
  strategy?: string
  random_seed?: number
  fold_results?: FoldResult[]
  accuracy?: MeanStd
  precision?: MeanStd
  recall?: MeanStd
  f1?: MeanStd
  roc_auc?: MeanStd
  pr_auc?: MeanStd
}

export interface ThresholdRow {
  threshold: number
  precision: number
  recall: number
  f1: number
  predicted_positive_count: number
}

export interface ThresholdResponse {
  status: 'ok' | 'unavailable'
  detail?: string
  experiment_id?: string
  model_name?: string
  source?: string
  n_samples?: number
  thresholds?: ThresholdRow[]
}

export interface CalibrationCurveData {
  n_bins_requested: number
  n_bins_actual: number
  mean_predicted_value: number[]
  fraction_of_positives: number[]
  brier_score: number
  note: string
}

export interface CalibrationResponse {
  status: 'ok' | 'unavailable'
  detail?: string
  experiment_id?: string
  model_name?: string
  calibration?: CalibrationCurveData | null
}

export interface ErrorRecord {
  neo_id: string | number
  name: string | null
  true_label: boolean
  predicted_label: boolean
  predicted_probability: number | null
  features: Record<string, unknown>
}

export interface ErrorsResponse {
  status: 'ok' | 'unavailable'
  detail?: string
  experiment_id?: string
  model_name?: string
  holdout_rows?: number
  counts?: {
    true_positive: number
    true_negative: number
    false_positive: number
    false_negative: number
  }
  false_positives?: ErrorRecord[]
  false_negatives?: ErrorRecord[]
  false_negative_note?: string | null
  group_feature_means?: {
    true_positive: Record<string, number | null>
    true_negative: Record<string, number | null>
    false_positive: Record<string, number | null>
    false_negative: Record<string, number | null>
  }
  group_feature_means_note?: string
}

export interface LocalShapExample {
  neo_id: string | number
  top_contributing_features: { feature: string; shap_value: number }[]
}

export interface ExperimentExplainabilityResponse {
  status: 'ok' | 'unavailable'
  detail?: string
  experiment_id?: string
  model_name?: string
  global_importance?: { feature: string; mean_abs_shap: number }[]
  local_examples?: LocalShapExample[] | null
}

// ---------------------------------------------------------------------------
// Anomaly detection
// ---------------------------------------------------------------------------

export interface AnomalyRecord {
  rank: number
  neo_id: string | number
  name: string | null
  ml_anomaly_score: number
  ml_flagged_outlier: boolean
  features: Record<string, unknown>
}

export interface AnomaliesResponse {
  status: 'ok' | 'unavailable'
  detail?: string
  generated_at_utc?: string
  row_count?: number
  flagged_outlier_count?: number
  feature_columns?: string[]
  dataset_medians?: Record<string, number | null>
  score_distribution?: { bin_edges: number[]; counts: number[] }
  terminology_note?: string
  top_anomalies?: AnomalyRecord[]
  requested_top?: number
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
  neo: (neoId: string) => getJson<Record<string, unknown>>(`/neo/${encodeURIComponent(neoId)}`),
  neoAnomaly: (neoId: string) =>
    getJson<{ status: 'ok' | 'unavailable'; detail?: string; ml_anomaly_score?: number; ml_flagged_outlier?: boolean }>(
      `/neo/${encodeURIComponent(neoId)}/anomaly`,
    ),
  predict: (request: Record<string, unknown>) =>
    fetch(`${BASE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }).then(async (r) => ({ httpStatus: r.status, body: await r.json() })),
  models: () => getJson<ModelsResponse>('/models'),
  modelMetrics: (modelName: string) => getJson<ModelMetricsResponse>(`/models/${modelName}/metrics`),
  modelExplainability: (modelName: string) =>
    getJson<ExplainabilityResponse>(`/models/${modelName}/explainability`),
  features: () => getJson<FeaturesResponse>('/features'),
  limitations: () => getJson<LimitationsResponse>('/limitations'),

  datasetQuality: () => getJson<DatasetQualityResponse>('/dataset/quality'),
  datasetCorrelations: (method: 'pearson' | 'spearman' = 'pearson') =>
    getJson<DatasetCorrelationsResponse>(`/dataset/correlations?method=${method}`),
  datasetFull: (limit = 2000) => getJson<DatasetFullResponse>(`/dataset/full?limit=${limit}`),

  experiments: () => getJson<ExperimentsIndexResponse>('/experiments'),
  experimentHoldout: (experimentId: string, modelName: string) =>
    getJson<HoldoutResponse>(`/experiments/${experimentId}/models/${modelName}/holdout`),
  experimentCv: (experimentId: string, modelName: string) =>
    getJson<CvResponse>(`/experiments/${experimentId}/models/${modelName}/cv`),
  experimentThreshold: (experimentId: string, modelName: string) =>
    getJson<ThresholdResponse>(`/experiments/${experimentId}/models/${modelName}/threshold`),
  experimentCalibration: (experimentId: string, modelName: string) =>
    getJson<CalibrationResponse>(`/experiments/${experimentId}/models/${modelName}/calibration`),
  experimentErrors: (experimentId: string, modelName: string) =>
    getJson<ErrorsResponse>(`/experiments/${experimentId}/models/${modelName}/errors`),
  experimentExplainability: (experimentId: string, modelName: string) =>
    getJson<ExperimentExplainabilityResponse>(`/experiments/${experimentId}/models/${modelName}/explainability`),

  anomalies: (top = 10) => getJson<AnomaliesResponse>(`/anomalies?top=${top}`),
}

export const EXPERIMENT_IDS = ['experiment_a_original', 'experiment_b_leakage_aware'] as const
export type ExperimentId = (typeof EXPERIMENT_IDS)[number]

export const MODEL_NAMES = ['logistic_regression', 'random_forest', 'xgboost'] as const
export type ModelName = (typeof MODEL_NAMES)[number]

export const MODEL_LABEL: Record<ModelName, string> = {
  logistic_regression: 'Logistic Regression',
  random_forest: 'Random Forest',
  xgboost: 'XGBoost',
}

// Fixed categorical order, validated CVD-safe against this app's dark surface
// (#05070d) — see the dataviz skill. Never reassigned per filter.
export const MODEL_COLOR: Record<ModelName, string> = {
  logistic_regression: '#3987e5',
  random_forest: '#d95926',
  xgboost: '#199e70',
}

export const EXPERIMENT_LABEL: Record<ExperimentId, string> = {
  experiment_a_original: 'Experiment A — Original',
  experiment_b_leakage_aware: 'Experiment B — Leakage-Aware',
}
