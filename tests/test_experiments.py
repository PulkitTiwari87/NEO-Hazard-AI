"""Unit tests for src/experiments/run_all.py using a small SYNTHETIC in-memory
dataset (tests/fixtures/synthetic_dataset.py) — never real NASA data. These
exercise the actual computation code (cross-validation, threshold sweep,
calibration, error analysis) end-to-end so bugs are caught before the real
pipeline ever runs against real data.
"""
from __future__ import annotations

import json

import numpy as np
import pytest

from src.experiments import run_all as run_all_module
from src.features.engineering import EXPERIMENT_A_ID, EXPERIMENT_B_ID, EXPERIMENTS, LEAKAGE_FEATURES
from tests.fixtures.synthetic_dataset import make_synthetic_processed_dataset


def test_experiment_b_excludes_leakage_features():
    assert EXPERIMENTS[EXPERIMENT_A_ID]["excluded_features"] == []
    assert set(LEAKAGE_FEATURES) == {"moid_au", "absolute_magnitude_h"}
    for feature in LEAKAGE_FEATURES:
        assert feature not in EXPERIMENTS[EXPERIMENT_B_ID]["numeric_features"]
        assert feature in EXPERIMENTS[EXPERIMENT_B_ID]["excluded_features"]
        assert feature in EXPERIMENTS[EXPERIMENT_A_ID]["numeric_features"]


def test_compute_threshold_sweep_predicted_positive_count_is_non_increasing():
    rng = np.random.RandomState(0)
    y_true = np.array([0, 1] * 25)
    y_proba = np.clip(y_true * 0.6 + rng.normal(0, 0.2, size=50) + 0.2, 0, 1)
    result = run_all_module.compute_threshold_sweep(y_true, y_proba)
    counts = [row["predicted_positive_count"] for row in result["thresholds"]]
    assert counts == sorted(counts, reverse=True)
    assert result["n_samples"] == 50


def test_compute_threshold_sweep_ignores_nan_probabilities():
    y_true = np.array([0, 1, 0, 1])
    y_proba = np.array([0.1, np.nan, 0.2, 0.8])
    result = run_all_module.compute_threshold_sweep(y_true, y_proba)
    assert result["n_samples"] == 3


def test_compute_calibration_returns_valid_brier_score():
    rng = np.random.RandomState(1)
    y_true = np.array([0, 1] * 20)
    y_proba = np.clip(y_true * 0.5 + rng.normal(0, 0.15, size=40) + 0.25, 0.001, 0.999)
    calibration = run_all_module.compute_calibration(y_true, y_proba)
    assert calibration is not None
    assert 0.0 <= calibration["brier_score"] <= 1.0
    assert len(calibration["mean_predicted_value"]) == calibration["n_bins_actual"]


def test_compute_calibration_returns_none_for_single_class():
    calibration = run_all_module.compute_calibration(np.array([1, 1, 1]), np.array([0.9, 0.8, 0.7]))
    assert calibration is None


def test_compute_error_analysis_counts_sum_to_holdout_rows():
    import pandas as pd

    df = make_synthetic_processed_dataset(n_per_class=5).reset_index(drop=True)
    y_true = df["is_potentially_hazardous_asteroid"].to_numpy()
    y_pred = y_true.copy()
    y_pred[0] = not y_pred[0]  # force one misclassification
    result = run_all_module.compute_error_analysis(
        df, ["moid_au", "absolute_magnitude_h"], y_true, y_pred, None, "test_experiment", "test_model"
    )
    counts = result["counts"]
    assert sum(counts.values()) == len(df)
    assert len(result["false_positives"]) + len(result["false_negatives"]) == 1


def test_compute_error_analysis_group_feature_means_are_computed_per_category():
    df = make_synthetic_processed_dataset(n_per_class=5).reset_index(drop=True)
    y_true = df["is_potentially_hazardous_asteroid"].to_numpy()
    y_pred = y_true.copy()
    y_pred[0] = not y_pred[0]
    result = run_all_module.compute_error_analysis(
        df,
        ["moid_au", "absolute_magnitude_h"],
        y_true,
        y_pred,
        None,
        "test_experiment",
        "test_model",
        numeric_feature_columns=["moid_au", "absolute_magnitude_h"],
    )
    means = result["group_feature_means"]
    assert set(means.keys()) == {"true_positive", "true_negative", "false_positive", "false_negative"}
    non_empty_groups = [g for g in means.values() if g]
    assert len(non_empty_groups) > 0
    for group in non_empty_groups:
        assert set(group.keys()) <= {"moid_au", "absolute_magnitude_h"}


def test_compute_error_analysis_reports_no_false_negatives_explicitly():
    import numpy as np

    df = make_synthetic_processed_dataset(n_per_class=3).reset_index(drop=True)
    y_true = df["is_potentially_hazardous_asteroid"].to_numpy()
    y_pred = y_true.copy()  # perfect predictions -> zero FN and zero FP
    result = run_all_module.compute_error_analysis(
        df, ["moid_au"], y_true, y_pred, None, "test_experiment", "test_model"
    )
    assert result["counts"]["false_negative"] == 0
    assert result["false_negative_note"] == "No false negatives in this evaluated split."


@pytest.mark.parametrize("experiment_id", [EXPERIMENT_A_ID, EXPERIMENT_B_ID])
def test_run_experiment_model_produces_valid_artifacts(tmp_path, monkeypatch, experiment_id):
    monkeypatch.setattr(run_all_module.settings, "results_dir", str(tmp_path / "results"))
    monkeypatch.setattr(run_all_module.settings, "model_registry_dir", str(tmp_path / "registry"))

    df = make_synthetic_processed_dataset(n_per_class=20)
    summary = run_all_module.run_experiment_model(df, experiment_id, "logistic_regression", random_seed=42)

    assert 0.0 <= summary["accuracy"] <= 1.0
    assert summary["cv_f1_mean"] is not None

    combo_dir = run_all_module.combo_dir(experiment_id, "logistic_regression")
    for filename in ["holdout.json", "cv.json", "threshold.json", "calibration.json", "errors.json"]:
        path = combo_dir / filename
        assert path.exists(), f"missing {path}"
        json.loads(path.read_text())  # must be valid JSON

    cv = json.loads((combo_dir / "cv.json").read_text())
    assert len(cv["fold_results"]) == run_all_module.CV_FOLDS

    errors = json.loads((combo_dir / "errors.json").read_text())
    assert errors["counts"]["true_positive"] + errors["counts"]["true_negative"] + \
        errors["counts"]["false_positive"] + errors["counts"]["false_negative"] == errors["holdout_rows"]


def test_experiment_a_separates_classes_better_than_experiment_b_on_separable_synthetic_data(tmp_path, monkeypatch):
    """Regression test for the leakage-aware ablation actually doing
    something: on this fixture, the label is a threshold rule over moid_au/
    absolute_magnitude_h, so Experiment A (which includes them) should score
    much higher than Experiment B (which excludes them and sees only
    unrelated synthetic noise features)."""
    monkeypatch.setattr(run_all_module.settings, "results_dir", str(tmp_path / "results"))
    monkeypatch.setattr(run_all_module.settings, "model_registry_dir", str(tmp_path / "registry"))

    df = make_synthetic_processed_dataset(n_per_class=20)
    summary_a = run_all_module.run_experiment_model(df, EXPERIMENT_A_ID, "random_forest", random_seed=42)
    summary_b = run_all_module.run_experiment_model(df, EXPERIMENT_B_ID, "random_forest", random_seed=42)

    assert summary_a["accuracy"] > summary_b["accuracy"]
