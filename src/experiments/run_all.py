"""Two-experiment ML research pipeline: cross-validation, holdout evaluation,
threshold analysis, calibration, and error analysis for every
(experiment, model) combination.

Usage:
    python -m src.experiments.run_all

This is the single command that reproduces every research artifact the
frontend's Experiment Comparison / Cross-Validation / Confusion Matrix Lab /
ROC & PR / Threshold / Calibration / Error Analysis pages read from. It
fails loudly (never fabricates results) if data/processed/neo_dataset.csv
does not exist yet — run `python -m src.data.ingestion` then
`python -m src.data.validation` first.

Per (experiment, model) combination this script:
  1. Takes a single stratified 80/20 train/holdout split (fixed seed). The
     holdout fold is touched exactly once, at the very end, for the final
     reported metrics — never used for threshold selection.
  2. Runs 5-fold StratifiedKFold cross-validation *within the training
     pool only*, fitting a fresh pipeline per fold (preprocessing included,
     so no fold's statistics leak into another). Reports real per-fold
     metrics and confusion matrices, plus mean +/- std across folds.
  3. Runs a threshold sweep (0.05-0.95) against the out-of-fold CV
     probabilities collected in step 2 — never against the holdout set.
  4. Fits a final pipeline on the whole training pool and evaluates it once
     on the untouched holdout fold (accuracy/precision/recall/F1/ROC-AUC/
     PR-AUC/confusion matrix/ROC & PR curves).
  5. Computes a calibration curve + Brier score from the holdout
     probabilities, and extracts full false-positive/false-negative records
     (with real feature values) from the holdout predictions.

Results are written to results/experiments/<experiment_id>/<model_name>/ and
summarized in results/experiments/index.json. Trained pipelines are
registered under model_registry/<experiment_id>/<model_name>/.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, f1_score, precision_score, recall_score
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

from src.config import PROCESSED_DATASET_PATH, settings
from src.features.engineering import EXPERIMENTS, MODEL_NAMES, TARGET_COLUMN, build_feature_matrix
from src.models.evaluate import compute_classification_metrics
from src.models.registry import ModelMetadata, save_model

logger = logging.getLogger(__name__)

TEST_SIZE = 0.2
CV_FOLDS = 5
THRESHOLD_GRID = [round(float(t), 2) for t in np.arange(0.05, 1.0, 0.05)]


class ExperimentRunError(RuntimeError):
    pass


def load_processed_dataset() -> pd.DataFrame:
    if not PROCESSED_DATASET_PATH.exists():
        raise ExperimentRunError(
            f"Processed dataset not found at {PROCESSED_DATASET_PATH}. "
            "Run `python -m src.data.ingestion` then `python -m src.data.validation` first."
        )
    return pd.read_csv(PROCESSED_DATASET_PATH)


def _native(value):
    """Convert a numpy scalar (from a pandas cell) to a native JSON-safe type."""
    if value is None:
        return None
    if isinstance(value, float) and np.isnan(value):
        return None
    if isinstance(value, np.generic):
        return value.item()
    return value


def build_preprocessor(numeric_features: list[str], categorical_features: list[str]) -> ColumnTransformer:
    numeric_pipeline = Pipeline(
        steps=[("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]
    )
    categorical_pipeline = Pipeline(
        steps=[("impute", SimpleImputer(strategy="most_frequent")), ("encode", OneHotEncoder(handle_unknown="ignore"))]
    )
    return ColumnTransformer(
        transformers=[
            ("numeric", numeric_pipeline, numeric_features),
            ("categorical", categorical_pipeline, categorical_features),
        ]
    )


def build_estimator(model_name: str, y_train: pd.Series, random_seed: int):
    positive = int(y_train.sum())
    negative = int(len(y_train) - positive)
    scale_pos_weight = (negative / positive) if positive > 0 else 1.0
    if model_name == "logistic_regression":
        return LogisticRegression(max_iter=1000, class_weight="balanced", random_state=random_seed)
    if model_name == "random_forest":
        return RandomForestClassifier(n_estimators=200, class_weight="balanced", random_state=random_seed)
    if model_name == "xgboost":
        return XGBClassifier(random_state=random_seed, eval_metric="logloss", scale_pos_weight=scale_pos_weight)
    raise ExperimentRunError(f"Unknown model '{model_name}'.")


def combo_dir(experiment_id: str, model_name: str) -> Path:
    d = settings.results_path / "experiments" / experiment_id / model_name
    d.mkdir(parents=True, exist_ok=True)
    return d


def _strip_curves(metrics: dict) -> dict:
    return {k: v for k, v in metrics.items() if k not in ("roc_curve", "pr_curve")}


def run_cross_validation(pipeline_factory, x_train: pd.DataFrame, y_train: pd.Series, random_seed: int):
    """Manual StratifiedKFold loop (not cross_val_predict) so real per-fold
    metrics/confusion matrices can be reported, and out-of-fold probabilities
    returned for threshold analysis — all derived strictly from the training
    pool, never the held-out test fold."""
    skf = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=random_seed)
    fold_results = []
    x_train_reset = x_train.reset_index(drop=True)
    y_train_reset = y_train.reset_index(drop=True)
    oof_proba = np.full(len(x_train_reset), np.nan)

    for fold_index, (train_idx, val_idx) in enumerate(skf.split(x_train_reset, y_train_reset), start=1):
        fold_pipeline = pipeline_factory(y_train_reset.iloc[train_idx])
        fold_pipeline.fit(x_train_reset.iloc[train_idx], y_train_reset.iloc[train_idx])
        y_val = y_train_reset.iloc[val_idx]
        y_val_pred = fold_pipeline.predict(x_train_reset.iloc[val_idx])
        y_val_proba = (
            fold_pipeline.predict_proba(x_train_reset.iloc[val_idx])[:, 1]
            if hasattr(fold_pipeline, "predict_proba")
            else None
        )
        metrics = _strip_curves(compute_classification_metrics(y_val, y_val_pred, y_val_proba))
        metrics["fold"] = fold_index
        metrics["train_rows"] = int(len(train_idx))
        metrics["val_rows"] = int(len(val_idx))
        fold_results.append(metrics)
        if y_val_proba is not None:
            oof_proba[val_idx] = y_val_proba

    def _mean_std(key: str) -> dict:
        values = [f[key] for f in fold_results if f.get(key) is not None]
        if not values:
            return {"mean": None, "std": None}
        return {
            "mean": float(np.mean(values)),
            "std": float(np.std(values, ddof=1)) if len(values) > 1 else 0.0,
        }

    summary = {
        "folds": CV_FOLDS,
        "strategy": "StratifiedKFold(shuffle=True) over the training pool only (holdout test fold untouched)",
        "random_seed": random_seed,
        "fold_results": fold_results,
        "accuracy": _mean_std("accuracy"),
        "precision": _mean_std("precision"),
        "recall": _mean_std("recall"),
        "f1": _mean_std("f1"),
        "roc_auc": _mean_std("roc_auc"),
        "pr_auc": _mean_std("pr_auc"),
    }
    return summary, oof_proba


def compute_threshold_sweep(y_true, y_proba: np.ndarray) -> dict:
    mask = ~np.isnan(y_proba)
    y_true_arr = np.asarray(y_true)[mask].astype(int)
    y_proba_arr = y_proba[mask]
    rows = []
    for threshold in THRESHOLD_GRID:
        y_pred = (y_proba_arr >= threshold).astype(int)
        rows.append(
            {
                "threshold": float(threshold),
                "precision": float(precision_score(y_true_arr, y_pred, zero_division=0)),
                "recall": float(recall_score(y_true_arr, y_pred, zero_division=0)),
                "f1": float(f1_score(y_true_arr, y_pred, zero_division=0)),
                "predicted_positive_count": int(y_pred.sum()),
            }
        )
    return {
        "source": (
            "Out-of-fold cross-validation probabilities on the training pool "
            "(the holdout test fold was not used for threshold selection)."
        ),
        "n_samples": int(mask.sum()),
        "thresholds": rows,
    }


def compute_calibration(y_true: np.ndarray, y_proba) -> dict | None:
    if y_proba is None or len(np.unique(y_true)) < 2:
        return None
    n_bins = 10 if len(y_true) >= 40 else max(2, len(y_true) // 5)
    try:
        fraction_of_positives, mean_predicted_value = calibration_curve(
            y_true, y_proba, n_bins=n_bins, strategy="quantile"
        )
    except ValueError:
        fraction_of_positives, mean_predicted_value = calibration_curve(
            y_true, y_proba, n_bins=n_bins, strategy="uniform"
        )
    return {
        "n_bins_requested": n_bins,
        "n_bins_actual": len(mean_predicted_value),
        "mean_predicted_value": mean_predicted_value.tolist(),
        "fraction_of_positives": fraction_of_positives.tolist(),
        "brier_score": float(brier_score_loss(y_true, y_proba)),
        "note": (
            "Raw classifier probabilities, not independently recalibrated. "
            "A well-calibrated curve tracks the diagonal; deviations mean "
            "predicted probabilities should not be read as literal "
            "real-world frequencies."
        ),
    }


def compute_error_analysis(
    df_holdout: pd.DataFrame,
    feature_columns: list[str],
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_proba,
    experiment_id: str,
    model_name: str,
) -> dict:
    y_true = np.asarray(y_true).astype(bool)
    y_pred = np.asarray(y_pred).astype(bool)
    tp_mask = y_true & y_pred
    tn_mask = (~y_true) & (~y_pred)
    fp_mask = (~y_true) & y_pred
    fn_mask = y_true & (~y_pred)

    def _records(mask: np.ndarray) -> list[dict]:
        records = []
        for i in np.where(mask)[0]:
            row = df_holdout.iloc[i]
            records.append(
                {
                    "neo_id": _native(row.get("neo_id")),
                    "name": _native(row.get("name")),
                    "true_label": bool(y_true[i]),
                    "predicted_label": bool(y_pred[i]),
                    "predicted_probability": float(y_proba[i]) if y_proba is not None else None,
                    "features": {col: _native(row.get(col)) for col in feature_columns},
                }
            )
        return records

    fn_count = int(fn_mask.sum())
    return {
        "experiment_id": experiment_id,
        "model_name": model_name,
        "holdout_rows": int(len(df_holdout)),
        "counts": {
            "true_positive": int(tp_mask.sum()),
            "true_negative": int(tn_mask.sum()),
            "false_positive": int(fp_mask.sum()),
            "false_negative": fn_count,
        },
        "false_positives": _records(fp_mask),
        "false_negatives": _records(fn_mask),
        "false_negative_note": "No false negatives in this evaluated split." if fn_count == 0 else None,
    }


def run_experiment_model(df: pd.DataFrame, experiment_id: str, model_name: str, random_seed: int) -> dict:
    spec = EXPERIMENTS[experiment_id]
    numeric_features = list(spec["numeric_features"])
    categorical_features = list(spec["categorical_features"])
    feature_columns = numeric_features + categorical_features

    x, y = build_feature_matrix(df, numeric_features, categorical_features)
    x_train, x_holdout, y_train, y_holdout = train_test_split(
        x, y, test_size=TEST_SIZE, random_state=random_seed, stratify=y
    )
    holdout_df = df.loc[x_holdout.index].reset_index(drop=True)
    x_holdout = x_holdout.reset_index(drop=True)
    y_holdout = y_holdout.reset_index(drop=True)

    def pipeline_factory(y_for_weights: pd.Series) -> Pipeline:
        preprocessor = build_preprocessor(numeric_features, categorical_features)
        estimator = build_estimator(model_name, y_for_weights, random_seed)
        return Pipeline(steps=[("preprocess", preprocessor), ("model", estimator)])

    cv_summary, oof_proba = run_cross_validation(pipeline_factory, x_train, y_train, random_seed)
    threshold_summary = compute_threshold_sweep(y_train.reset_index(drop=True).to_numpy(), oof_proba)

    final_pipeline = pipeline_factory(y_train)
    final_pipeline.fit(x_train, y_train)
    y_holdout_pred = final_pipeline.predict(x_holdout)
    y_holdout_proba = (
        final_pipeline.predict_proba(x_holdout)[:, 1] if hasattr(final_pipeline, "predict_proba") else None
    )
    holdout_metrics = compute_classification_metrics(y_holdout, y_holdout_pred, y_holdout_proba)
    calibration = compute_calibration(y_holdout.to_numpy(), y_holdout_proba)
    error_analysis = compute_error_analysis(
        holdout_df, feature_columns, y_holdout.to_numpy(), y_holdout_pred, y_holdout_proba, experiment_id, model_name
    )

    trained_at = datetime.now(timezone.utc).isoformat()
    metadata = ModelMetadata(
        model_name=f"{experiment_id}/{model_name}",
        model_version=trained_at,
        trained_at_utc=trained_at,
        dataset_path=str(PROCESSED_DATASET_PATH),
        dataset_row_count=len(df),
        feature_columns=feature_columns,
        categorical_features=categorical_features,
        numeric_features=numeric_features,
        target_column=TARGET_COLUMN,
        random_seed=random_seed,
        test_size=TEST_SIZE,
        hyperparameters={k: str(v) for k, v in final_pipeline.named_steps["model"].get_params().items()},
        metrics=holdout_metrics,
    )
    save_model(final_pipeline, metadata)

    out_dir = combo_dir(experiment_id, model_name)
    (out_dir / "holdout.json").write_text(
        json.dumps(
            {
                "experiment_id": experiment_id,
                "model_name": model_name,
                "train_rows": int(len(x_train)),
                "holdout_rows": int(len(x_holdout)),
                "random_seed": random_seed,
                "test_size": TEST_SIZE,
                "trained_at_utc": trained_at,
                "metrics": holdout_metrics,
            },
            indent=2,
        )
    )
    (out_dir / "cv.json").write_text(
        json.dumps({"experiment_id": experiment_id, "model_name": model_name, **cv_summary}, indent=2)
    )
    (out_dir / "threshold.json").write_text(
        json.dumps({"experiment_id": experiment_id, "model_name": model_name, **threshold_summary}, indent=2)
    )
    (out_dir / "calibration.json").write_text(
        json.dumps({"experiment_id": experiment_id, "model_name": model_name, "calibration": calibration}, indent=2)
    )
    (out_dir / "errors.json").write_text(json.dumps(error_analysis, indent=2, default=str))

    return {
        "experiment_id": experiment_id,
        "model_name": model_name,
        "accuracy": holdout_metrics["accuracy"],
        "precision": holdout_metrics["precision"],
        "recall": holdout_metrics["recall"],
        "f1": holdout_metrics["f1"],
        "roc_auc": holdout_metrics["roc_auc"],
        "pr_auc": holdout_metrics["pr_auc"],
        "cv_accuracy_mean": cv_summary["accuracy"]["mean"],
        "cv_accuracy_std": cv_summary["accuracy"]["std"],
        "cv_f1_mean": cv_summary["f1"]["mean"],
        "cv_f1_std": cv_summary["f1"]["std"],
        "cv_roc_auc_mean": cv_summary["roc_auc"]["mean"],
        "cv_roc_auc_std": cv_summary["roc_auc"]["std"],
        "cv_pr_auc_mean": cv_summary["pr_auc"]["mean"],
        "cv_pr_auc_std": cv_summary["pr_auc"]["std"],
    }


def run_all() -> dict:
    df = load_processed_dataset()
    random_seed = settings.random_seed
    comparison_rows = []
    for experiment_id in EXPERIMENTS:
        for model_name in MODEL_NAMES:
            logger.info("Running experiment=%s model=%s", experiment_id, model_name)
            comparison_rows.append(run_experiment_model(df, experiment_id, model_name, random_seed))

    index = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset_path": str(PROCESSED_DATASET_PATH),
        "dataset_row_count": len(df),
        "random_seed": random_seed,
        "test_size": TEST_SIZE,
        "cv_folds": CV_FOLDS,
        "split_strategy": (
            "Single stratified 80/20 train/holdout split (fixed seed); "
            "StratifiedKFold(5, shuffle=True) cross-validation within the "
            "training pool only; threshold analysis from out-of-fold CV "
            "probabilities; holdout fold touched once for final metrics."
        ),
        "models": MODEL_NAMES,
        "experiments": EXPERIMENTS,
        "comparison_table": comparison_rows,
    }
    settings.results_path.mkdir(parents=True, exist_ok=True)
    (settings.results_path / "experiments").mkdir(parents=True, exist_ok=True)
    (settings.results_path / "experiments" / "index.json").write_text(json.dumps(index, indent=2, default=str))
    return index


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    index = run_all()
    print(f"Ran {len(index['comparison_table'])} experiment/model combinations on {index['dataset_row_count']} rows.")
    print(json.dumps(index["comparison_table"], indent=2))


if __name__ == "__main__":
    main()
