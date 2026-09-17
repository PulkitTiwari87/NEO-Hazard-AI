"""Feature engineering for the NEO classification task.

Every derived feature is listed in FEATURE_DEFINITIONS with its exact
formula, source field(s), unit, and scientific rationale (mirrored in
docs/FEATURES.md — that file is prose, this list is the single source of
truth the code and docs both derive from). No feature is added merely
because it might improve a metric; each one must be independently
defensible from the raw NASA-provided fields.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

TARGET_COLUMN = "is_potentially_hazardous_asteroid"
ID_COLUMN = "neo_id"

# NASA/JPL-provided fields used directly as model inputs (no transformation).
PASSTHROUGH_NUMERIC_FEATURES = [
    "absolute_magnitude_h",
    "eccentricity",
    "semi_major_axis_au",
    "inclination_deg",
    "ascending_node_longitude_deg",
    "orbital_period_days",
    "perihelion_distance_au",
    "aphelion_distance_au",
    "mean_anomaly_deg",
    "mean_motion_deg_per_day",
    "moid_au",
    "data_arc_in_days",
    "observations_used",
    "num_recorded_close_approaches",
    "closest_miss_distance_km",
    "closest_relative_velocity_km_s",
]

CATEGORICAL_FEATURES = ["orbit_class_type"]

FEATURE_DEFINITIONS = [
    {
        "name": "diameter_km_mean",
        "formula": "(estimated_diameter_km_min + estimated_diameter_km_max) / 2",
        "source_fields": ["estimated_diameter_km_min", "estimated_diameter_km_max"],
        "unit": "kilometers",
        "rationale": (
            "NASA reports estimated diameter as a [min, max] range derived from "
            "absolute magnitude under an assumed albedo, not a direct measurement. "
            "The midpoint is a simple, transparent point estimate of that range."
        ),
    },
    {
        "name": "log_closest_miss_distance_km",
        "formula": "log1p(closest_miss_distance_km)",
        "source_fields": ["closest_miss_distance_km"],
        "unit": "log(1 + kilometers)",
        "rationale": (
            "Close-approach distances span many orders of magnitude and are "
            "strongly right-skewed; a log1p transform is a standard, "
            "reversible way to make this scale usable by linear models."
        ),
    },
    {
        "name": "log_closest_relative_velocity_km_s",
        "formula": "log1p(closest_relative_velocity_km_s)",
        "source_fields": ["closest_relative_velocity_km_s"],
        "unit": "log(1 + km/s)",
        "rationale": "Relative velocity is right-skewed for the same reason as miss distance.",
    },
    {
        "name": "log_orbital_period_days",
        "formula": "log1p(orbital_period_days)",
        "source_fields": ["orbital_period_days"],
        "unit": "log(1 + days)",
        "rationale": "Orbital periods range from under a year to centuries; log-scaling reduces skew.",
    },
]

DERIVED_NUMERIC_FEATURES = [f["name"] for f in FEATURE_DEFINITIONS]

ALL_NUMERIC_FEATURES = PASSTHROUGH_NUMERIC_FEATURES + DERIVED_NUMERIC_FEATURES


def add_derived_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["diameter_km_mean"] = (
        df["estimated_diameter_km_min"] + df["estimated_diameter_km_max"]
    ) / 2
    df["log_closest_miss_distance_km"] = np.log1p(df["closest_miss_distance_km"])
    df["log_closest_relative_velocity_km_s"] = np.log1p(df["closest_relative_velocity_km_s"])
    df["log_orbital_period_days"] = np.log1p(df["orbital_period_days"])
    return df


def build_feature_matrix(
    df: pd.DataFrame,
    numeric_features: list[str] | None = None,
    categorical_features: list[str] | None = None,
) -> tuple[pd.DataFrame, pd.Series]:
    """Return (X, y) ready for a scikit-learn ColumnTransformer pipeline.

    Missing values are left as NaN — imputation is a pipeline step (fit only
    on the training fold) rather than being baked into the dataset here, to
    avoid leaking test-set statistics into training.

    `numeric_features`/`categorical_features` default to the full
    (Experiment A) feature set; pass an experiment's own lists (see
    `EXPERIMENTS` below) to build that experiment's matrix instead.
    """
    df = add_derived_features(df)
    numeric_features = ALL_NUMERIC_FEATURES if numeric_features is None else numeric_features
    categorical_features = CATEGORICAL_FEATURES if categorical_features is None else categorical_features
    feature_columns = numeric_features + categorical_features
    x = df[feature_columns].copy()
    y = df[TARGET_COLUMN].astype(bool)
    return x, y


# ---------------------------------------------------------------------------
# Experiment definitions
# ---------------------------------------------------------------------------
# NASA/JPL's own `is_potentially_hazardous_asteroid` flag is, per NASA's
# public documentation, essentially a threshold rule over an object's
# Minimum Orbit Intersection Distance (`moid_au`) and absolute magnitude
# (`absolute_magnitude_h`). A model trained with both features as inputs can
# recover that rule almost exactly (see docs/MODEL_CARD.md for the observed
# near-perfect tree-model scores) — which demonstrates the model can find
# the rule, not that the other features carry independent predictive signal.
#
# Experiment A keeps the full feature set (useful for recovering/verifying
# the existing classification boundary). Experiment B removes the two
# label-defining features to test whether the remaining orbital, physical,
# and close-approach features carry usable signal on their own. Experiment B
# is not automatically "better" — it answers a different, narrower question.
LEAKAGE_FEATURES = ["moid_au", "absolute_magnitude_h"]

EXPERIMENT_A_ID = "experiment_a_original"
EXPERIMENT_B_ID = "experiment_b_leakage_aware"

EXPERIMENTS: dict[str, dict] = {
    EXPERIMENT_A_ID: {
        "id": EXPERIMENT_A_ID,
        "name": "Experiment A — Original Feature Set",
        "short_name": "Experiment A",
        "numeric_features": ALL_NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "excluded_features": [],
        "purpose": (
            "Uses every NASA-provided and derived feature, including moid_au "
            "and absolute_magnitude_h. Primarily useful for understanding and "
            "recovering NASA/JPL's existing potentially-hazardous screening "
            "boundary from its own inputs — not for discovering new signal."
        ),
        "rationale": (
            "This is the complete feature set documented in docs/FEATURES.md. "
            "It establishes an upper bound on how well a model can reproduce "
            "NASA's own labeling rule when given the exact quantities that "
            "rule is a threshold function of."
        ),
    },
    EXPERIMENT_B_ID: {
        "id": EXPERIMENT_B_ID,
        "name": "Experiment B — Leakage-Aware Feature Set",
        "short_name": "Experiment B",
        "numeric_features": [f for f in ALL_NUMERIC_FEATURES if f not in LEAKAGE_FEATURES],
        "categorical_features": CATEGORICAL_FEATURES,
        "excluded_features": LEAKAGE_FEATURES,
        "purpose": (
            "Removes moid_au and absolute_magnitude_h — the two quantities "
            "NASA/JPL's is_potentially_hazardous_asteroid rule is directly a "
            "threshold function of — to test whether the remaining orbital, "
            "physical, and close-approach features contain useful predictive "
            "signal on their own, without directly supplying the "
            "label-defining variables."
        ),
        "rationale": (
            "moid_au and absolute_magnitude_h are not merely correlated with "
            "the target; per NASA's own published PHA definition they are "
            "(approximately) the rule the target is computed from. Including "
            "them as model inputs lets a model recover that rule rather than "
            "demonstrate independent predictive signal, which is a form of "
            "target leakage. Experiment B is a leakage-aware ablation, not a "
            "claim that the removed features are unimportant to the real "
            "screening question — see docs/LIMITATIONS.md."
        ),
    },
}


def experiment_feature_columns(experiment_id: str) -> list[str]:
    spec = EXPERIMENTS[experiment_id]
    return list(spec["numeric_features"]) + list(spec["categorical_features"])


# Classifiers compared within every experiment (src/experiments/run_all.py).
# Kept here (not in src/experiments/run_all.py) so backend/main.py can import
# this list without pulling scikit-learn/xgboost into the API process.
MODEL_NAMES = ["logistic_regression", "random_forest", "xgboost"]
