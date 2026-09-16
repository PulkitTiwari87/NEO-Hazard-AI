"""Feature-space anomaly detection over the NEO dataset.

Usage:
    python -m src.anomaly.detect

IMPORTANT terminology (see docs/LIMITATIONS.md): this module produces an
*ML anomaly score* — how unusual a record is relative to the statistical
distribution of the other records in the engineered feature space, as seen
by an Isolation Forest. It is NOT a hazard score, impact-risk score, or any
form of NASA/JPL assessment. An object can score as a statistical outlier
because of a data-quality issue (e.g. an unusually short observation arc)
just as easily as because of a genuinely unusual orbit.

This is unsupervised: it does not use the `is_potentially_hazardous_asteroid`
label at all.
"""
from __future__ import annotations

import json
import logging

import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer

from src.config import PROCESSED_DATASET_PATH, settings
from src.features.engineering import ALL_NUMERIC_FEATURES, CATEGORICAL_FEATURES, add_derived_features
from src.models.registry import model_dir

logger = logging.getLogger(__name__)


class AnomalyDetectionError(RuntimeError):
    pass


def build_pipeline(random_seed: int) -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]),
                ALL_NUMERIC_FEATURES,
            ),
            (
                "categorical",
                Pipeline([("impute", SimpleImputer(strategy="most_frequent")), ("encode", OneHotEncoder(handle_unknown="ignore"))]),
                CATEGORICAL_FEATURES,
            ),
        ]
    )
    model = IsolationForest(random_state=random_seed, contamination="auto")
    return Pipeline(steps=[("preprocess", preprocessor), ("model", model)])


def run() -> pd.DataFrame:
    if not PROCESSED_DATASET_PATH.exists():
        raise AnomalyDetectionError(
            f"Processed dataset not found at {PROCESSED_DATASET_PATH}. "
            "Run ingestion and validation first."
        )
    df = pd.read_csv(PROCESSED_DATASET_PATH)
    df_features = add_derived_features(df)
    feature_columns = ALL_NUMERIC_FEATURES + CATEGORICAL_FEATURES
    x = df_features[feature_columns]

    pipeline = build_pipeline(settings.random_seed)
    pipeline.fit(x)

    scores = pipeline.named_steps["model"].decision_function(
        pipeline.named_steps["preprocess"].transform(x)
    )
    is_outlier = pipeline.predict(x) == -1

    result = df[["neo_id", "name"]].copy()
    result["ml_anomaly_score"] = scores
    result["ml_flagged_outlier"] = is_outlier

    registry_dir = model_dir("isolation_forest")
    registry_dir.mkdir(parents=True, exist_ok=True)
    import joblib

    joblib.dump(pipeline, registry_dir / "model.joblib")
    (registry_dir / "metadata.json").write_text(
        json.dumps(
            {
                "model_name": "isolation_forest",
                "purpose": "Unsupervised feature-space anomaly detection (not a hazard score).",
                "random_seed": settings.random_seed,
                "feature_columns": feature_columns,
                "row_count": len(df),
                "flagged_outlier_count": int(is_outlier.sum()),
            },
            indent=2,
        )
    )
    return result


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    result = run()
    settings.results_path.mkdir(parents=True, exist_ok=True)
    output_path = settings.results_path / "anomaly_scores.csv"
    result.to_csv(output_path, index=False)
    print(f"Wrote anomaly scores for {len(result)} objects -> {output_path}")
    print(f"Flagged as statistical outliers: {int(result['ml_flagged_outlier'].sum())}")


if __name__ == "__main__":
    main()
