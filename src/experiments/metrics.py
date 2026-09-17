"""Metric computation shared by every experiment/model combination.

Every number here comes from `sklearn.metrics`/`sklearn.calibration` (or a
direct, auditable computation over model output) — nothing is hand-typed
or approximated. See docs/METHODOLOGY.md.
"""
from __future__ import annotations

import numpy as np
from sklearn.calibration import calibration_curve
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)

CONFUSION_MATRIX_LABELS = ["not_hazardous", "potentially_hazardous"]

# Grid used for threshold sensitivity analysis (section 21). Never applied
# to the outer holdout test set — see run_all.py, which only ever calls
# threshold_sweep() on CV validation-fold predictions.
THRESHOLD_GRID = [round(t, 2) for t in np.arange(0.05, 0.96, 0.05)]


def compute_classification_metrics(y_true, y_pred, y_proba=None) -> dict:
    metrics = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
    }
    cm = confusion_matrix(y_true, y_pred, labels=[False, True])
    tn, fp, fn, tp = cm.ravel()
    metrics["confusion_matrix"] = {
        "labels": CONFUSION_MATRIX_LABELS,
        "matrix": cm.tolist(),
        "tn": int(tn),
        "fp": int(fp),
        "fn": int(fn),
        "tp": int(tp),
    }
    if y_proba is not None and len(np.unique(y_true)) > 1:
        metrics["roc_auc"] = float(roc_auc_score(y_true, y_proba))
        metrics["pr_auc"] = float(average_precision_score(y_true, y_proba))
    else:
        metrics["roc_auc"] = None
        metrics["pr_auc"] = None
    return metrics


def roc_curve_points(y_true, y_proba) -> dict | None:
    if y_proba is None or len(np.unique(y_true)) < 2:
        return None
    fpr, tpr, thresholds = roc_curve(y_true, y_proba)
    return {
        "fpr": fpr.tolist(),
        "tpr": tpr.tolist(),
        "thresholds": [float(t) for t in thresholds],
    }


def pr_curve_points(y_true, y_proba) -> dict | None:
    if y_proba is None or len(np.unique(y_true)) < 2:
        return None
    precision, recall, thresholds = precision_recall_curve(y_true, y_proba)
    return {
        "precision": precision.tolist(),
        "recall": recall.tolist(),
        "thresholds": [float(t) for t in thresholds],
        "average_precision": float(average_precision_score(y_true, y_proba)),
    }


def threshold_sweep(y_true, y_proba, thresholds: list[float] | None = None) -> list[dict]:
    """Precision/recall/F1 at each threshold in the grid. Callers must only
    pass CV validation-fold (or training-fold) probabilities here — never
    the outer holdout test set, or threshold selection would leak into the
    final evaluation. See docs/METHODOLOGY.md and run_all.py.
    """
    if y_proba is None:
        return []
    thresholds = thresholds if thresholds is not None else THRESHOLD_GRID
    y_true_arr = np.asarray(y_true)
    rows = []
    for threshold in thresholds:
        y_pred = (np.asarray(y_proba) >= threshold).astype(bool)
        rows.append(
            {
                "threshold": float(threshold),
                "precision": float(precision_score(y_true_arr, y_pred, zero_division=0)),
                "recall": float(recall_score(y_true_arr, y_pred, zero_division=0)),
                "f1": float(f1_score(y_true_arr, y_pred, zero_division=0)),
            }
        )
    return rows


def best_threshold_by_f1(sweep_rows: list[dict]) -> dict | None:
    if not sweep_rows:
        return None
    return max(sweep_rows, key=lambda row: row["f1"])


def calibration_summary(y_true, y_proba, n_bins: int = 10) -> dict | None:
    if y_proba is None or len(np.unique(y_true)) < 2:
        return None
    prob_true, prob_pred = calibration_curve(y_true, y_proba, n_bins=n_bins, strategy="quantile")
    return {
        "brier_score": float(brier_score_loss(y_true, y_proba)),
        "prob_true": prob_true.tolist(),
        "prob_pred": prob_pred.tolist(),
        "n_bins_requested": n_bins,
    }


def bootstrap_metric_ci(
    y_true,
    y_pred,
    metric_fn,
    n_bootstrap: int = 1000,
    ci: float = 0.95,
    random_seed: int = 42,
) -> dict:
    """Nonparametric bootstrap CI for a metric computed from (y_true, y_pred)
    pairs on the outer holdout test set. Resamples (true, pred) pairs
    jointly with replacement.
    """
    rng = np.random.RandomState(random_seed)
    y_true_arr = np.asarray(y_true)
    y_pred_arr = np.asarray(y_pred)
    n = len(y_true_arr)
    if n == 0:
        return {"point_estimate": None, "ci_low": None, "ci_high": None, "n_bootstrap": n_bootstrap}

    point_estimate = float(metric_fn(y_true_arr, y_pred_arr))
    samples = []
    for _ in range(n_bootstrap):
        idx = rng.randint(0, n, size=n)
        samples.append(metric_fn(y_true_arr[idx], y_pred_arr[idx]))
    samples = np.array(samples)
    alpha = (1.0 - ci) / 2.0
    return {
        "point_estimate": point_estimate,
        "ci_low": float(np.quantile(samples, alpha)),
        "ci_high": float(np.quantile(samples, 1.0 - alpha)),
        "ci_level": ci,
        "n_bootstrap": n_bootstrap,
    }
