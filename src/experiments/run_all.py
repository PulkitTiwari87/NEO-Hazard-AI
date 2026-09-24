"""Primary research benchmark entrypoint — runs every experiment x model
combination end to end and writes every artifact under
results/experiments/<experiment>/<model>/.

Usage:
    python -m src.experiments.run_all

Pipeline per experiment (docs/METHODOLOGY.md, docs/FEATURE_AUDIT.md):

    real data (data/processed/neo_dataset.csv, produced by
    src.data.ingestion + src.data.validation — never fabricated)
        |
        +-- outer holdout test set (20%, stratified, fixed seed) -- UNTOUCHED
        |   until final evaluation: never used for tuning, feature
        |   selection, or threshold selection.
        |
        +-- training set (80%)
               |
               +-- RandomizedSearchCV over a 5-fold StratifiedKFold
               |   (scoring="f1") picks hyperparameters
               |
               +-- the same 5-fold split is re-run with the tuned
                   hyperparameters to report actual per-fold metrics and
                   out-of-fold probabilities (used only for the threshold
                   sweep — never the test set)

This module does not decide what a "good" score is. If a model scores
F1 = 1.0 in the Original experiment or F1 = 0.55 in the Leakage-Aware
experiment, both are written verbatim — see docs/FEATURE_AUDIT.md and
docs/LIMITATIONS.md for how to interpret either outcome.
"""
from __future__ import annotations

import json
import logging
import platform
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import sklearn
import xgboost
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from src.config import PROCESSED_DATASET_PATH, VALIDATION_REPORT_PATH, settings
from src.experiments import error_analysis as error_mod
from src.experiments import metrics as metrics_mod
from src.experiments.splits import (
    N_CV_FOLDS,
    OUTER_TEST_SIZE,
    make_cv_splitter,
    make_outer_holdout,
    verify_object_level_grain,
)
from src.experiments.tuning import build_estimators, tunable_model_names, tune_pipeline
from src.features.engineering import add_derived_features
from src.features.feature_sets import FEATURE_SETS, FeatureSet, build_feature_matrix_for

logger = logging.getLogger(__name__)

RUN_SHAP_MODELS = {"random_forest"}  # bounded on purpose — see docs/METHODOLOGY.md


class ExperimentRunError(RuntimeError):
    pass


def load_dataset() -> pd.DataFrame:
    if not PROCESSED_DATASET_PATH.exists():
        raise ExperimentRunError(
            f"Processed dataset not found at {PROCESSED_DATASET_PATH}. "
            "Run `python -m src.data.ingestion` then `python -m src.data.validation` first."
        )
    df = pd.read_csv(PROCESSED_DATASET_PATH)
    verify_object_level_grain(df)
    return add_derived_features(df)


def build_preprocessor(feature_set: FeatureSet) -> ColumnTransformer:
    transformers = [
        (
            "numeric",
            Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]),
            feature_set.numeric_features,
        )
    ]
    if feature_set.categorical_features:
        transformers.append(
            (
                "categorical",
                Pipeline(
                    [
                        ("impute", SimpleImputer(strategy="most_frequent")),
                        ("encode", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                feature_set.categorical_features,
            )
        )
    return ColumnTransformer(transformers=transformers)


def _predict_proba_or_none(pipeline, x):
    if hasattr(pipeline, "predict_proba"):
        return pipeline.predict_proba(x)[:, 1]
    return None


def run_one(experiment_key: str, model_name: str, df: pd.DataFrame, random_seed: int) -> dict:
    feature_set = FEATURE_SETS[experiment_key]
    x, y = build_feature_matrix_for(df, feature_set)
    neo_ids = df["neo_id"]

    x_train, x_test, y_train, y_test, id_train, id_test = _split_with_ids(
        x, y, neo_ids, random_seed
    )

    cv = make_cv_splitter(random_seed, N_CV_FOLDS)
    preprocessor = build_preprocessor(feature_set)
    estimator = build_estimators(random_seed)[model_name]
    pipeline = Pipeline(steps=[("preprocess", preprocessor), ("model", estimator)])

    best_pipeline, search_results = tune_pipeline(
        pipeline, model_name, x_train, y_train, cv, random_seed
    )

    fold_rows, oof_proba, oof_pred = _run_cv_folds(best_pipeline, x_train, y_train, cv)
    cv_metrics = _aggregate_folds(fold_rows)
    threshold_rows = metrics_mod.threshold_sweep(y_train, oof_proba)
    best_threshold = metrics_mod.best_threshold_by_f1(threshold_rows)

    y_test_pred = best_pipeline.predict(x_test)
    y_test_proba = _predict_proba_or_none(best_pipeline, x_test)
    test_metrics = metrics_mod.compute_classification_metrics(y_test, y_test_pred, y_test_proba)
    test_metrics["f1_bootstrap_ci"] = metrics_mod.bootstrap_metric_ci(
        y_test,
        y_test_pred,
        lambda yt, yp: metrics_mod.f1_score(yt, yp, zero_division=0),
        random_seed=random_seed,
    )
    roc_curve = metrics_mod.roc_curve_points(y_test, y_test_proba)
    pr_curve = metrics_mod.pr_curve_points(y_test, y_test_proba)
    calibration = metrics_mod.calibration_summary(y_test, y_test_proba)

    error_table = error_mod.build_error_table(id_test, x_test, y_test, y_test_pred, y_test_proba)
    error_summary = error_mod.feature_range_summary(error_table, feature_set.numeric_features)

    importance = _feature_importance(best_pipeline, x_test, y_test, model_name, random_seed)
    shap_summary = None
    if model_name in RUN_SHAP_MODELS:
        shap_summary = _shap_summary(best_pipeline, x_test, random_seed)

    metadata = {
        "experiment_key": feature_set.key,
        "experiment_name": feature_set.display_name,
        "experiment_purpose": feature_set.purpose,
        "model_name": model_name,
        "feature_columns": feature_set.feature_columns,
        "numeric_features": feature_set.numeric_features,
        "categorical_features": feature_set.categorical_features,
        "random_seed": random_seed,
        "n_cv_folds": N_CV_FOLDS,
        "outer_test_size": OUTER_TEST_SIZE,
        "dataset_row_count": len(df),
        "train_rows": len(x_train),
        "test_rows": len(x_test),
        "best_hyperparameters": _model_params(best_pipeline),
        "hyperparameter_search_results": search_results,
        "tuned": model_name in tunable_model_names(),
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset_path": str(PROCESSED_DATASET_PATH),
        "dataset_provenance": _dataset_provenance(),
        "software_versions": {
            "python": platform.python_version(),
            "scikit_learn": sklearn.__version__,
            "xgboost": xgboost.__version__,
        },
    }

    return {
        "metadata": metadata,
        "cv_metrics": cv_metrics,
        "fold_metrics": fold_rows,
        "test_metrics": test_metrics,
        "confusion_matrix": test_metrics["confusion_matrix"],
        "roc_curve": roc_curve,
        "pr_curve": pr_curve,
        "threshold_analysis": {"grid": threshold_rows, "best_by_f1": best_threshold},
        "calibration": calibration,
        "error_analysis": {
            "feature_range_summary": error_summary,
            "false_positives": error_mod.error_records(error_table, "false_positive"),
            "false_negatives": error_mod.error_records(error_table, "false_negative"),
        },
        "feature_importance": importance,
        "shap_summary": shap_summary,
        "predictions": error_table,
        "pipeline": best_pipeline,
    }


def _split_with_ids(x: pd.DataFrame, y: pd.Series, neo_ids: pd.Series, random_seed: int):
    x_train, x_test, y_train, y_test = make_outer_holdout(x, y, random_seed)
    id_train = neo_ids.loc[x_train.index]
    id_test = neo_ids.loc[x_test.index]
    return x_train, x_test, y_train, y_test, id_train, id_test


def _run_cv_folds(best_pipeline, x_train, y_train, cv):
    fold_rows = []
    oof_proba = np.full(len(y_train), np.nan)
    oof_pred = np.full(len(y_train), False, dtype=bool)
    x_arr = x_train.reset_index(drop=True)
    y_arr = y_train.reset_index(drop=True)

    for fold_idx, (train_idx, val_idx) in enumerate(cv.split(x_arr, y_arr), start=1):
        fold_pipeline = clone(best_pipeline)
        fold_pipeline.fit(x_arr.iloc[train_idx], y_arr.iloc[train_idx])
        y_val_pred = fold_pipeline.predict(x_arr.iloc[val_idx])
        y_val_proba = _predict_proba_or_none(fold_pipeline, x_arr.iloc[val_idx])
        fold_metrics = metrics_mod.compute_classification_metrics(
            y_arr.iloc[val_idx], y_val_pred, y_val_proba
        )
        fold_rows.append({"fold": fold_idx, **fold_metrics})
        oof_pred[val_idx] = y_val_pred
        if y_val_proba is not None:
            oof_proba[val_idx] = y_val_proba

    if np.isnan(oof_proba).all():
        oof_proba_out = None
    else:
        oof_proba_out = oof_proba
    return fold_rows, oof_proba_out, oof_pred


def _aggregate_folds(fold_rows: list[dict]) -> dict:
    keys = ["accuracy", "precision", "recall", "f1", "roc_auc", "pr_auc"]
    aggregated = {}
    for key in keys:
        values = [row[key] for row in fold_rows if row.get(key) is not None]
        if not values:
            aggregated[key] = {"mean": None, "std": None, "n_folds": 0}
        else:
            aggregated[key] = {
                "mean": float(np.mean(values)),
                "std": float(np.std(values, ddof=1)) if len(values) > 1 else 0.0,
                "n_folds": len(values),
            }
    return aggregated


def _model_params(pipeline) -> dict:
    model = pipeline.named_steps["model"]
    return {k: str(v) for k, v in model.get_params().items()}


def _feature_importance(pipeline, x_test, y_test, model_name: str, random_seed: int) -> dict:
    preprocessor = pipeline.named_steps["preprocess"]
    model = pipeline.named_steps["model"]
    feature_names = list(preprocessor.get_feature_names_out())

    result: dict = {"feature_names": feature_names}
    if hasattr(model, "feature_importances_"):
        result["model_specific"] = dict(zip(feature_names, [float(v) for v in model.feature_importances_]))
    elif hasattr(model, "coef_"):
        coef = model.coef_.ravel()
        result["model_specific"] = dict(zip(feature_names, [float(v) for v in coef]))
    else:
        result["model_specific"] = None

    perm = permutation_importance(
        pipeline, x_test, y_test, scoring="f1", n_repeats=20, random_state=random_seed, n_jobs=-1
    )
    result["permutation_importance"] = {
        "features": list(x_test.columns),
        "mean": [float(v) for v in perm.importances_mean],
        "std": [float(v) for v in perm.importances_std],
    }
    return result


def _shap_summary(pipeline, x_test, random_seed: int) -> dict | None:
    try:
        import shap
    except ImportError:
        return None

    preprocessor = pipeline.named_steps["preprocess"]
    model = pipeline.named_steps["model"]
    x_transformed = preprocessor.transform(x_test)
    feature_names = list(preprocessor.get_feature_names_out())

    sample_n = min(50, x_transformed.shape[0])
    if sample_n == 0:
        return None
    rng = np.random.RandomState(random_seed)
    sample_idx = rng.choice(x_transformed.shape[0], size=sample_n, replace=False)
    x_sample = x_transformed[sample_idx]

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(x_sample)
    if isinstance(shap_values, list):
        shap_values = shap_values[1]
    elif isinstance(shap_values, np.ndarray) and shap_values.ndim == 3:
        shap_values = shap_values[:, :, 1]

    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    global_importance = {
        name: float(value)
        for name, value in sorted(zip(feature_names, mean_abs_shap), key=lambda p: p[1], reverse=True)
    }
    return {"global_mean_abs_shap": global_importance, "sample_size": sample_n}


def _dataset_provenance() -> dict:
    if VALIDATION_REPORT_PATH.exists():
        return json.loads(VALIDATION_REPORT_PATH.read_text())
    return {"note": "data/processed/validation_report.json not found."}


def _write_artifacts(experiment_key: str, model_name: str, outputs: dict) -> None:
    out_dir = settings.results_path / "experiments" / experiment_key / model_name
    out_dir.mkdir(parents=True, exist_ok=True)

    json_artifacts = {
        "metadata.json": outputs["metadata"],
        "cv_metrics.json": outputs["cv_metrics"],
        "fold_metrics.json": outputs["fold_metrics"],
        "test_metrics.json": outputs["test_metrics"],
        "confusion_matrix.json": outputs["confusion_matrix"],
        "roc_curve.json": outputs["roc_curve"],
        "pr_curve.json": outputs["pr_curve"],
        "threshold_analysis.json": outputs["threshold_analysis"],
        "calibration.json": outputs["calibration"],
        "error_analysis.json": outputs["error_analysis"],
        "feature_importance.json": outputs["feature_importance"],
    }
    if outputs.get("shap_summary") is not None:
        json_artifacts["shap_summary.json"] = outputs["shap_summary"]

    for filename, payload in json_artifacts.items():
        (out_dir / filename).write_text(json.dumps(payload, indent=2, default=str))

    outputs["predictions"].to_csv(out_dir / "predictions.csv", index=False)
    joblib.dump(outputs["pipeline"], out_dir / "model.joblib")


def run_all() -> dict:
    df = load_dataset()
    summary: dict = {
        "run_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset_row_count": len(df),
        "random_seed": settings.random_seed,
        "experiments": {},
    }

    for experiment_key, feature_set in FEATURE_SETS.items():
        summary["experiments"][experiment_key] = {
            "display_name": feature_set.display_name,
            "purpose": feature_set.purpose,
            "feature_columns": feature_set.feature_columns,
            "models": {},
        }
        for model_name in build_estimators(settings.random_seed):
            logger.info("Running experiment=%s model=%s", experiment_key, model_name)
            outputs = run_one(experiment_key, model_name, df, settings.random_seed)
            _write_artifacts(experiment_key, model_name, outputs)
            summary["experiments"][experiment_key]["models"][model_name] = {
                "cv_f1_mean": outputs["cv_metrics"]["f1"]["mean"],
                "cv_f1_std": outputs["cv_metrics"]["f1"]["std"],
                "test_f1": outputs["test_metrics"]["f1"],
                "test_precision": outputs["test_metrics"]["precision"],
                "test_recall": outputs["test_metrics"]["recall"],
                "test_roc_auc": outputs["test_metrics"]["roc_auc"],
                "test_pr_auc": outputs["test_metrics"]["pr_auc"],
            }

    summary_path = settings.results_path / "experiments" / "summary.json"
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summary, indent=2, default=str))
    return summary


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    summary = run_all()
    print(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    main()
