import math

import pandas as pd

from src.features.engineering import add_derived_features, build_feature_matrix


def _base_row(**overrides):
    row = {
        "neo_id": "1",
        "estimated_diameter_km_min": 0.2,
        "estimated_diameter_km_max": 0.6,
        "closest_miss_distance_km": 999.0,
        "closest_relative_velocity_km_s": 9.0,
        "orbital_period_days": 365.0,
        "absolute_magnitude_h": 20.0,
        "eccentricity": 0.3,
        "semi_major_axis_au": 1.5,
        "inclination_deg": 5.0,
        "ascending_node_longitude_deg": 10.0,
        "perihelion_distance_au": 1.0,
        "aphelion_distance_au": 2.0,
        "mean_anomaly_deg": 50.0,
        "mean_motion_deg_per_day": 0.5,
        "moid_au": 0.05,
        "data_arc_in_days": 500,
        "observations_used": 100,
        "num_recorded_close_approaches": 3,
        "orbit_class_type": "APO",
        "is_potentially_hazardous_asteroid": False,
    }
    row.update(overrides)
    return row


def test_diameter_km_mean_is_midpoint_of_min_and_max():
    df = pd.DataFrame([_base_row(estimated_diameter_km_min=0.2, estimated_diameter_km_max=0.6)])
    result = add_derived_features(df)
    assert result.loc[0, "diameter_km_mean"] == 0.4


def test_log_transforms_match_log1p_definition():
    df = pd.DataFrame([_base_row(closest_miss_distance_km=999.0, closest_relative_velocity_km_s=9.0, orbital_period_days=365.0)])
    result = add_derived_features(df)
    assert math.isclose(result.loc[0, "log_closest_miss_distance_km"], math.log1p(999.0))
    assert math.isclose(result.loc[0, "log_closest_relative_velocity_km_s"], math.log1p(9.0))
    assert math.isclose(result.loc[0, "log_orbital_period_days"], math.log1p(365.0))


def test_build_feature_matrix_separates_target_and_casts_bool():
    df = pd.DataFrame([_base_row(is_potentially_hazardous_asteroid=True), _base_row(is_potentially_hazardous_asteroid=False)])
    x, y = build_feature_matrix(df)
    assert "is_potentially_hazardous_asteroid" not in x.columns
    assert y.tolist() == [True, False]
    assert y.dtype == bool
