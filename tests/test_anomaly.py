"""Unit tests for src/anomaly/detect.py's analysis-building logic, using a
small SYNTHETIC in-memory dataset — never real NASA data.
"""
from __future__ import annotations

import numpy as np

from src.anomaly.detect import build_anomaly_analysis
from src.features.engineering import ALL_NUMERIC_FEATURES, CATEGORICAL_FEATURES, add_derived_features
from tests.fixtures.synthetic_dataset import make_synthetic_processed_dataset


def test_build_anomaly_analysis_top_anomalies_are_most_negative_scores():
    df = make_synthetic_processed_dataset(n_per_class=10).reset_index(drop=True)
    df_features = add_derived_features(df)
    feature_columns = [c for c in ALL_NUMERIC_FEATURES if c in df_features.columns] + CATEGORICAL_FEATURES
    rng = np.random.RandomState(0)
    scores = rng.normal(0, 1, size=len(df))
    is_outlier = scores < np.percentile(scores, 10)

    analysis = build_anomaly_analysis(df, df_features, feature_columns, scores, is_outlier)

    reported_scores = [record["ml_anomaly_score"] for record in analysis["top_anomalies"]]
    assert reported_scores == sorted(reported_scores)
    assert reported_scores[0] == pytest_approx_min(scores)
    assert analysis["row_count"] == len(df)
    assert analysis["flagged_outlier_count"] == int(is_outlier.sum())


def test_build_anomaly_analysis_never_uses_hazard_language():
    df = make_synthetic_processed_dataset(n_per_class=5).reset_index(drop=True)
    df_features = add_derived_features(df)
    feature_columns = [c for c in ALL_NUMERIC_FEATURES if c in df_features.columns] + CATEGORICAL_FEATURES
    scores = np.linspace(-1, 1, len(df))
    is_outlier = scores < -0.5

    analysis = build_anomaly_analysis(df, df_features, feature_columns, scores, is_outlier)
    note = analysis["terminology_note"].lower()
    for banned_word in ["risk score", "danger score", "impact probability"]:
        assert banned_word not in note


def test_build_anomaly_analysis_respects_max_top_anomalies_cap():
    df = make_synthetic_processed_dataset(n_per_class=40).reset_index(drop=True)  # 80 rows > cap
    df_features = add_derived_features(df)
    feature_columns = [c for c in ALL_NUMERIC_FEATURES if c in df_features.columns] + CATEGORICAL_FEATURES
    scores = np.linspace(-1, 1, len(df))
    is_outlier = scores < -0.5

    from src.anomaly.detect import MAX_TOP_ANOMALIES

    analysis = build_anomaly_analysis(df, df_features, feature_columns, scores, is_outlier)
    assert len(analysis["top_anomalies"]) == min(MAX_TOP_ANOMALIES, len(df))


def pytest_approx_min(values):
    return float(np.min(values))
