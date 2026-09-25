import type { ExperimentDetailResponse } from '../api/client'

// Labels only — never values. Experiment keys/names mirror
// src/features/feature_sets.py; model keys mirror src/experiments/tuning.py.
export const EXPERIMENTS = [
  { key: 'original', letter: 'A', tag: 'EXP-A-ORIGINAL', title: 'Original / NASA Rule-Recovery' },
  { key: 'leakage_aware', letter: 'B', tag: 'EXP-B-LEAKAGE-AWARE', title: 'Leakage-Aware' },
  { key: 'physical_kinematic_only', letter: 'C', tag: 'EXP-C-PHYSICAL-KINEMATIC', title: 'Physical/Kinematic' },
  { key: 'orbital_only', letter: 'D', tag: 'EXP-D-ORBITAL-ONLY', title: 'Orbital-Only' },
] as const

export const MODELS = ['dummy_most_frequent', 'logistic_regression', 'random_forest', 'xgboost'] as const

export const MODEL_LABEL: Record<string, string> = {
  dummy_most_frequent: 'Dummy Classifier',
  logistic_regression: 'Logistic Regression',
  random_forest: 'Random Forest',
  xgboost: 'XGBoost',
}

// Fixed categorical order, CVD-safe on the dark surface. Never reassigned
// per filter, and never used to imply a ranking.
export const MODEL_COLOR: Record<string, string> = {
  dummy_most_frequent: '#8b97ab',
  logistic_regression: '#3987e5',
  random_forest: '#e0803e',
  xgboost: '#2fb886',
}

export const METRIC_KEYS = ['accuracy', 'precision', 'recall', 'f1', 'roc_auc', 'pr_auc'] as const
export type MetricKey = (typeof METRIC_KEYS)[number]
export const METRIC_LABEL: Record<MetricKey, string> = {
  accuracy: 'Accuracy',
  precision: 'Precision',
  recall: 'Recall',
  f1: 'F1',
  roc_auc: 'ROC-AUC',
  pr_auc: 'PR-AUC',
}

export function experimentMeta(key: string) {
  return EXPERIMENTS.find((e) => e.key === key)
}

export function modelLabel(key: string): string {
  return MODEL_LABEL[key] ?? key
}

const DASH = '—'

export function fmt(value: number | null | undefined, digits = 3): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : DASH
}

export function fmtPct(value: number | null | undefined, digits = 1): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : DASH
}

export function fmtInt(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : DASH
}

export function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function str(value: unknown): string {
  if (value === null || value === undefined || value === '') return DASH
  return String(value)
}

/** YYYY-MM-DD from an ISO timestamp, or an em dash. */
export function fmtDate(iso: unknown): string {
  if (typeof iso !== 'string' || iso.length < 10) return DASH
  return iso.slice(0, 10)
}

/** "YYYY-MM-DD HH:MM UTC" from an ISO timestamp, or an em dash. */
export function fmtUtc(iso: unknown): string {
  if (typeof iso !== 'string' || iso.length < 16) return DASH
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
}

export function foldValue(fold: Record<string, unknown>, key: string): number | null {
  return num(fold[key])
}

/**
 * Unit inferred from the column-name suffix (the dataset's naming convention:
 * `_au`, `_deg`, `_km`, `_days`, `_km_s`). Returns an em dash when the name
 * carries no unit — never a guess.
 */
export function unitFromName(name: string): string {
  if (name.endsWith('_deg_per_day')) return 'deg/day'
  if (name.endsWith('_km_s')) return 'km/s'
  if (name.endsWith('_au')) return 'au'
  if (name.endsWith('_deg')) return 'deg'
  if (name.endsWith('_km') || name.endsWith('_km_min') || name.endsWith('_km_max')) return 'km'
  if (name.endsWith('_days')) return 'days'
  return DASH
}

export const CHART_COLORS = {
  accent: '#38bdf8',
  green: '#2fb886',
  orange: '#e0803e',
  blue: '#3987e5',
  muted: '#8b97ab',
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

/** Strips the sklearn ColumnTransformer prefix from a transformed feature name. */
export const cleanFeature = (name: string) => name.replace(/^(num|cat)__/, '')

/** The experiment/model/date facts every analysis page shows in its header. */
export function metaStrip(detail: ExperimentDetailResponse, experiment: string, model: string) {
  const m = detail.metadata ?? {}
  const meta = experimentMeta(experiment)
  return [
    { label: 'Experiment', value: meta?.tag ?? experiment, copy: meta?.tag ?? experiment },
    { label: 'Model', value: modelLabel(model), copy: model },
    { label: 'CV strategy', value: `${str(m.n_cv_folds)}-fold stratified` },
    { label: 'Random seed', value: str(m.random_seed) },
    { label: 'Trained', value: fmtUtc(m.trained_at_utc) },
  ]
}

export function humanize(name: string): string {
  return name.replace(/__/g, ' · ').replace(/_/g, ' ')
}

export interface ConfusionCounts {
  tn: number
  fp: number
  fn: number
  tp: number
  total: number
  prevalence: number
}

/** Counts and test-set prevalence, derived only from the artifact's own confusion matrix. */
export function confusionCounts(detail: ExperimentDetailResponse): ConfusionCounts | null {
  const cm = detail.confusion_matrix ?? detail.test_metrics?.confusion_matrix
  if (!cm) return null
  const total = cm.tn + cm.fp + cm.fn + cm.tp
  return { tn: cm.tn, fp: cm.fp, fn: cm.fn, tp: cm.tp, total, prevalence: total ? (cm.fn + cm.tp) / total : 0 }
}
