"""Train and evaluate classifiers for the NEO potentially-hazardous label.

**Legacy single-experiment pipeline — this is "Experiment A / Original /
Label-Defining Feature Experiment" only.** It trains on every feature in
`src/features/engineering.py`, including `moid_au` and
`absolute_magnitude_h`, which are the two fields NASA/JPL's own PHA
screening rule thresholds directly — see `docs/FEATURE_AUDIT.md`. Its
near-perfect scores demonstrate that ML can recover NASA's existing
classification boundary when given the variables that define it; they are
**not** evidence of novel predictive capability (`docs/LIMITATIONS.md`).

Kept (not deleted) for two reasons: it reproduces that specific historical
result, and `model_registry/random_forest` from this script is still what
`POST /api/predict` serves. The primary research benchmark — four
leakage-audited feature sets (A/B/C/D) x four models, 5-fold CV, a held-out
test set, and full error/explainability analysis — is
`python -m src.experiments.run_all` (`src/experiments/run_all.py`); see
`docs/RESULTS.md` for its output and `docs/FEATURE_AUDIT.md` for the
feature-by-feature reasoning behind each experiment.

Usage:
    python -m src.models.train

Requires data/processed/neo_dataset.csv to already exist (produced by
`python -m src.data.ingestion` followed by `python -m src.data.validation`).
Fails with a clear error if that file is missing — it does not train on
synthetic or placeholder data.

Split strategy (documented, see docs/METHODOLOGY.md): each row is a unique
NEO object (deduplicated by NASA's `id` during validation), so there is no
object-level leakage risk from splitting rows independently. A single
stratified train/test split (80/20, fixed random seed) is used because the
dataset has no temporal ordering requirement for this task definition.
Preprocessing (imputation, scaling, encoding) is fit only on the training
fold, inside the scikit-learn Pipeline, so the test fold is never used to
compute preprocessing statistics.

Class imbalance handling: `class_weight="balanced"` / `scale_pos_weight`
are computed from the actual training-fold label distribution at fit time
rather than assumed in advance — see docs/METHODOLOGY.md for the observed
distribution once real data has been ingested.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

from src.config import PROCESSED_DATASET_PATH, settings
from src.features.engineering import ALL_NUMERIC_FEATURES, CATEGORICAL_FEATURES, build_feature_matrix
from src.models.evaluate import compute_classification_metrics
from src.models.registry import ModelMetadata, save_model

logger = logging.getLogger(__name__)

TEST_SIZE = 0.2


class TrainingError(RuntimeError):
    pass


def load_processed_dataset() -> pd.DataFrame:
    if not PROCESSED_DATASET_PATH.exists():
        raise TrainingError(
            f"Processed dataset not found at {PROCESSED_DATASET_PATH}. "
            "Run `python -m src.data.ingestion` then `python -m src.data.validation` first."
        )
    return pd.read_csv(PROCESSED_DATASET_PATH)


def build_preprocessor() -> ColumnTransformer:
    numeric_pipeline = Pipeline(
        steps=[
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
        ]
    )
    categorical_pipeline = Pipeline(
        steps=[
            ("impute", SimpleImputer(strategy="most_frequent")),
            ("encode", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("numeric", numeric_pipeline, ALL_NUMERIC_FEATURES),
            ("categorical", categorical_pipeline, CATEGORICAL_FEATURES),
        ]
    )


def build_model_specs(y_train, random_seed: int) -> dict[str, object]:
    positive = int(y_train.sum())
    negative = int(len(y_train) - positive)
    scale_pos_weight = (negative / positive) if positive > 0 else 1.0

    return {
        "logistic_regression": LogisticRegression(
            max_iter=1000, class_weight="balanced", random_state=random_seed
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=200, class_weight="balanced", random_state=random_seed
        ),
        "xgboost": XGBClassifier(
            random_state=random_seed,
            eval_metric="logloss",
            scale_pos_weight=scale_pos_weight,
        ),
    }


def train_and_evaluate() -> dict:
    df = load_processed_dataset()
    x, y = build_feature_matrix(df)

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=TEST_SIZE, random_state=settings.random_seed, stratify=y
    )

    preprocessor = build_preprocessor()
    model_specs = build_model_specs(y_train, settings.random_seed)

    all_metrics = {}
    trained_at = datetime.now(timezone.utc).isoformat()

    for name, estimator in model_specs.items():
        pipeline = Pipeline(steps=[("preprocess", preprocessor), ("model", estimator)])
        pipeline.fit(x_train, y_train)

        y_pred = pipeline.predict(x_test)
        y_proba = pipeline.predict_proba(x_test)[:, 1] if hasattr(pipeline, "predict_proba") else None
        metrics = compute_classification_metrics(y_test, y_pred, y_proba)
        all_metrics[name] = metrics

        metadata = ModelMetadata(
            model_name=name,
            model_version=trained_at,
            trained_at_utc=trained_at,
            dataset_path=str(PROCESSED_DATASET_PATH),
            dataset_row_count=len(df),
            feature_columns=ALL_NUMERIC_FEATURES + CATEGORICAL_FEATURES,
            categorical_features=CATEGORICAL_FEATURES,
            numeric_features=ALL_NUMERIC_FEATURES,
            target_column="is_potentially_hazardous_asteroid",
            random_seed=settings.random_seed,
            test_size=TEST_SIZE,
            hyperparameters={k: str(v) for k, v in estimator.get_params().items()},
            metrics=metrics,
        )
        save_model(pipeline, metadata)
        logger.info("Trained and registered model '%s'.", name)

    return {
        "trained_at_utc": trained_at,
        "dataset_row_count": len(df),
        "train_rows": len(x_train),
        "test_rows": len(x_test),
        "random_seed": settings.random_seed,
        "test_size": TEST_SIZE,
        "metrics_by_model": all_metrics,
    }


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    summary = train_and_evaluate()

    settings.results_path.mkdir(parents=True, exist_ok=True)
    (settings.results_path / "model_metrics.json").write_text(
        json.dumps(summary["metrics_by_model"], indent=2)
    )
    (settings.results_path / "experiment_metadata.json").write_text(json.dumps(summary, indent=2))

    print(f"Trained {len(summary['metrics_by_model'])} model(s) on {summary['dataset_row_count']} rows.")
    print(json.dumps(summary["metrics_by_model"], indent=2))


if __name__ == "__main__":
    main()
