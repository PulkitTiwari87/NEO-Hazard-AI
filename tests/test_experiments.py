import numpy as np
import pandas as pd
import pytest

from src.experiments import error_analysis as error_mod
from src.experiments import metrics as metrics_mod
from src.experiments.integrity_checks import check_no_excluded_feature_in_leakage_audited_sets
from src.experiments.splits import GrainError, make_cv_splitter, make_outer_holdout, verify_object_level_grain


def test_verify_object_level_grain_passes_on_unique_ids():
    df = pd.DataFrame({"neo_id": ["1", "2", "3"]})
    verify_object_level_grain(df)  # must not raise


def test_verify_object_level_grain_raises_on_duplicates():
    df = pd.DataFrame({"neo_id": ["1", "1", "2"]})
    with pytest.raises(GrainError):
        verify_object_level_grain(df)


def test_make_outer_holdout_is_stratified_and_sized():
    rng = np.random.RandomState(0)
    n = 200
    x = pd.DataFrame({"a": rng.rand(n)})
    y = pd.Series([True] * 60 + [False] * 140)
    x_train, x_test, y_train, y_test = make_outer_holdout(x, y, random_seed=42, test_size=0.2)

    assert len(x_test) == 40
    assert len(x_train) == 160
    # stratified split keeps the ~30% positive rate in both folds
    assert abs(y_test.mean() - 0.3) < 0.05
    assert abs(y_train.mean() - 0.3) < 0.05


def test_make_cv_splitter_produces_requested_fold_count():
    cv = make_cv_splitter(random_seed=42, n_splits=5)
    x = pd.DataFrame({"a": range(50)})
    y = pd.Series([True, False] * 25)
    folds = list(cv.split(x, y))
    assert len(folds) == 5
    for train_idx, val_idx in folds:
        assert set(train_idx).isdisjoint(set(val_idx))


def test_compute_classification_metrics_matches_hand_computed_values():
    y_true = [True, True, False, False]
    y_pred = [True, False, False, False]
    metrics = metrics_mod.compute_classification_metrics(y_true, y_pred)
    assert metrics["accuracy"] == 0.75
    assert metrics["precision"] == 1.0
    assert metrics["recall"] == 0.5
    assert metrics["confusion_matrix"]["tp"] == 1
    assert metrics["confusion_matrix"]["fn"] == 1
    assert metrics["confusion_matrix"]["tn"] == 2
    assert metrics["confusion_matrix"]["fp"] == 0


def test_threshold_sweep_covers_requested_grid():
    y_true = [True, False, True, False, True]
    y_proba = [0.9, 0.2, 0.6, 0.4, 0.55]
    rows = metrics_mod.threshold_sweep(y_true, y_proba, thresholds=[0.1, 0.5, 0.9])
    assert [row["threshold"] for row in rows] == [0.1, 0.5, 0.9]
    # a threshold of 0.1 classifies everything positive -> recall 1.0
    assert rows[0]["recall"] == 1.0


def test_threshold_sweep_never_needs_the_holdout_test_set_by_signature():
    # threshold_sweep only ever receives arrays the caller passes in — this
    # test documents (and guards via run_all.py's actual call sites) that it
    # has no special-cased access to a "test set": it is the caller's job
    # (src/experiments/run_all.py) to only ever pass CV out-of-fold data.
    import inspect

    sig = inspect.signature(metrics_mod.threshold_sweep)
    assert list(sig.parameters) == ["y_true", "y_proba", "thresholds"]


def test_bootstrap_metric_ci_brackets_point_estimate():
    rng = np.random.RandomState(0)
    y_true = rng.randint(0, 2, 200).astype(bool)
    y_pred = y_true.copy()
    flips = rng.rand(200) < 0.2
    y_pred[flips] = ~y_pred[flips]

    result = metrics_mod.bootstrap_metric_ci(
        y_true, y_pred, lambda yt, yp: metrics_mod.f1_score(yt, yp, zero_division=0), n_bootstrap=200
    )
    assert result["ci_low"] <= result["point_estimate"] <= result["ci_high"]


def test_build_error_table_classifies_all_four_outcomes():
    x_test = pd.DataFrame({"feature": [1, 2, 3, 4]})
    neo_ids = pd.Series(["a", "b", "c", "d"])
    y_true = [True, True, False, False]
    y_pred = [True, False, True, False]
    table = error_mod.build_error_table(neo_ids, x_test, y_true, y_pred)
    assert table["outcome"].tolist() == [
        "true_positive",
        "false_negative",
        "false_positive",
        "true_negative",
    ]


def test_feature_range_summary_reports_per_outcome_stats():
    x_test = pd.DataFrame({"feature": [10.0, 20.0, 30.0, 40.0]})
    neo_ids = pd.Series(["a", "b", "c", "d"])
    y_true = [True, True, False, False]
    y_pred = [True, False, True, False]
    table = error_mod.build_error_table(neo_ids, x_test, y_true, y_pred)
    summary = error_mod.feature_range_summary(table, ["feature"])
    assert summary["true_positive"]["feature_stats"]["feature"]["mean"] == 10.0
    assert summary["false_negative"]["feature_stats"]["feature"]["mean"] == 20.0


def test_integrity_check_leakage_scan_does_not_raise():
    check_no_excluded_feature_in_leakage_audited_sets()


@pytest.fixture
def synthetic_neo_dataframe():
    """Small synthetic-schema dataset (never treated as real data) purely to
    exercise src.experiments.run_all.run_one end to end. Label follows
    NASA's real threshold rule (moid<=0.05 and h<=22) with light noise so
    leakage-audited experiments have some, but not perfect, signal.
    """
    from src.features.engineering import add_derived_features

    rng = np.random.RandomState(1)
    n = 120
    moid = rng.exponential(0.15, n).clip(0.0001, 3.0)
    h = rng.normal(20, 3, n).clip(10, 30)
    label = (moid <= 0.05) & (h <= 22.0)
    flip = rng.rand(n) < 0.03
    label = np.where(flip, ~label, label)

    df = pd.DataFrame(
        {
            "neo_id": [str(i) for i in range(n)],
            "absolute_magnitude_h": h,
            "estimated_diameter_km_min": rng.exponential(0.3, n),
            "estimated_diameter_km_max": rng.exponential(0.6, n) + 0.05,
            "is_potentially_hazardous_asteroid": label,
            "num_recorded_close_approaches": rng.randint(1, 20, n),
            "closest_miss_distance_km": rng.exponential(2_000_000, n) + 1000,
            "closest_relative_velocity_km_s": rng.normal(15, 5, n).clip(1, 40),
            "orbit_class_type": rng.choice(["APO", "AMO", "ATE"], n),
            "eccentricity": rng.uniform(0, 0.9, n),
            "semi_major_axis_au": rng.uniform(0.8, 3.5, n),
            "inclination_deg": rng.uniform(0, 30, n),
            "ascending_node_longitude_deg": rng.uniform(0, 360, n),
            "orbital_period_days": rng.uniform(200, 2000, n),
            "perihelion_distance_au": rng.uniform(0.3, 2.0, n),
            "aphelion_distance_au": rng.uniform(1.0, 5.0, n),
            "mean_anomaly_deg": rng.uniform(0, 360, n),
            "mean_motion_deg_per_day": rng.uniform(0.1, 1.5, n),
            "moid_au": moid,
            "data_arc_in_days": rng.randint(30, 8000, n),
            "observations_used": rng.randint(10, 2000, n),
        }
    )
    return add_derived_features(df)


def test_run_one_end_to_end_produces_expected_artifact_keys(synthetic_neo_dataframe):
    from src.experiments.run_all import run_one

    output = run_one("leakage_aware", "logistic_regression", synthetic_neo_dataframe, random_seed=42)

    assert set(
        [
            "metadata",
            "cv_metrics",
            "fold_metrics",
            "test_metrics",
            "confusion_matrix",
            "roc_curve",
            "pr_curve",
            "threshold_analysis",
            "calibration",
            "error_analysis",
            "feature_importance",
            "predictions",
            "pipeline",
        ]
    ) <= set(output)
    assert len(output["fold_metrics"]) == 5
    assert 0.0 <= output["test_metrics"]["f1"] <= 1.0
    # the leakage-aware experiment must never see moid_au / absolute_magnitude_h
    assert "moid_au" not in output["metadata"]["feature_columns"]
    assert "absolute_magnitude_h" not in output["metadata"]["feature_columns"]


def test_run_one_original_experiment_includes_label_defining_features(synthetic_neo_dataframe):
    from src.experiments.run_all import run_one

    output = run_one("original", "logistic_regression", synthetic_neo_dataframe, random_seed=42)
    assert "moid_au" in output["metadata"]["feature_columns"]
    assert "absolute_magnitude_h" in output["metadata"]["feature_columns"]
