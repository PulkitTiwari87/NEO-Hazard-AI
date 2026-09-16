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


def build_feature_matrix(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Return (X, y) ready for a scikit-learn ColumnTransformer pipeline.

    Missing values are left as NaN — imputation is a pipeline step (fit only
    on the training fold) rather than being baked into the dataset here, to
    avoid leaking test-set statistics into training.
    """
    df = add_derived_features(df)
    feature_columns = ALL_NUMERIC_FEATURES + CATEGORICAL_FEATURES
    x = df[feature_columns].copy()
    y = df[TARGET_COLUMN].astype(bool)
    return x, y
