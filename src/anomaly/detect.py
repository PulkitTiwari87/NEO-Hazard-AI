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
from datetime import datetime, timezone

import numpy as np
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

MAX_TOP_ANOMALIES = 50


def _native(value):
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    if isinstance(value, np.generic):
        return value.item()
    return value


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

    analysis = build_anomaly_analysis(df, df_features, feature_columns, scores, is_outlier)

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
    return result, analysis


def build_anomaly_analysis(
    df: pd.DataFrame,
    df_features: pd.DataFrame,
    feature_columns: list[str],
    scores,
    is_outlier,
) -> dict:
    """Score distribution, dataset medians (for comparison), and the most
    anomalous records with their full feature profile. Lower
    `ml_anomaly_score` (IsolationForest's decision_function) means more
    unusual relative to the rest of the dataset's feature space — it is not
    a hazard, risk, or danger score, see docs/LIMITATIONS.md."""
    counts, bin_edges = np.histogram(scores, bins=20)
    order = np.argsort(scores)  # ascending: most anomalous first

    numeric_columns = [c for c in feature_columns if c in ALL_NUMERIC_FEATURES]
    dataset_medians = {col: _native(df_features[col].median()) for col in numeric_columns}

    top_records = []
    for rank, i in enumerate(order[:MAX_TOP_ANOMALIES], start=1):
        row = df.iloc[i]
        feature_row = df_features.iloc[i]
        top_records.append(
            {
                "rank": rank,
                "neo_id": _native(row.get("neo_id")),
                "name": _native(row.get("name")),
                "ml_anomaly_score": _native(scores[i]),
                "ml_flagged_outlier": bool(is_outlier[i]),
                "features": {col: _native(feature_row.get(col)) for col in feature_columns},
            }
        )

    return {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "row_count": int(len(df)),
        "flagged_outlier_count": int(np.sum(is_outlier)),
        "feature_columns": feature_columns,
        "dataset_medians": dataset_medians,
        "score_distribution": {
            "bin_edges": [float(x) for x in bin_edges],
            "counts": [int(x) for x in counts],
        },
        "terminology_note": (
            "ml_anomaly_score reflects how unusual a record's feature vector is "
            "relative to the rest of this dataset, as seen by an unsupervised "
            "Isolation Forest. Lower (more negative) scores are more unusual. "
            "It does not use the hazard label, is not a risk/danger/impact "
            "score, and an object can score as an outlier purely due to a "
            "data-quality issue (e.g. a short observation arc)."
        ),
        "top_anomalies": top_records,
    }


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    result, analysis = run()
    settings.results_path.mkdir(parents=True, exist_ok=True)
    output_path = settings.results_path / "anomaly_scores.csv"
    result.to_csv(output_path, index=False)
    analysis_path = settings.results_path / "anomaly_analysis.json"
    analysis_path.write_text(json.dumps(analysis, indent=2, default=str))
    print(f"Wrote anomaly scores for {len(result)} objects -> {output_path}")
    print(f"Wrote anomaly analysis -> {analysis_path}")
    print(f"Flagged as statistical outliers: {int(result['ml_flagged_outlier'].sum())}")


if __name__ == "__main__":
    main()
