"""SYNTHETIC test fixture only — a small, fully in-memory processed dataset
(already flattened, as if data/processed/neo_dataset.csv had been loaded)
used purely to exercise src/experiments/run_all.py and src/anomaly/detect.py
code paths in unit tests. Never real NASA data; never loaded into data/raw,
data/processed, or any reported dataset statistic.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from src.features.engineering import ALL_NUMERIC_FEATURES, CATEGORICAL_FEATURES, TARGET_COLUMN


def make_synthetic_processed_dataset(n_per_class: int = 20, seed: int = 0) -> pd.DataFrame:
    """`is_potentially_hazardous_asteroid` is a threshold rule over
    `moid_au`/`absolute_magnitude_h` only (mirroring NASA's real PHA
    definition) — every other field is drawn independently of the class
    label, so this fixture actually tests that removing those two features
    (Experiment B) destroys the model's ability to recover the label, the
    same way docs/LIMITATIONS.md describes for the real dataset.
    """
    rng = np.random.RandomState(seed)
    n = 2 * n_per_class
    hazardous = np.array([True] * n_per_class + [False] * n_per_class)
    rng.shuffle(hazardous)

    rows = []
    for i in range(n):
        h = bool(hazardous[i])
        moid = rng.uniform(0.001, 0.04) if h else rng.uniform(0.06, 3.0)
        h_mag = rng.uniform(16, 21.9) if h else rng.uniform(18, 28)
        rows.append(
            {
                "neo_id": str(1000 + i),
                "name": f"(SYN{i}) Synthetic",
                "designation": None,
                "absolute_magnitude_h": h_mag,
                "estimated_diameter_km_min": rng.uniform(0.05, 0.5),
                "estimated_diameter_km_max": rng.uniform(0.5, 1.5),
                TARGET_COLUMN: h,
                "is_sentry_object": False,
                "num_recorded_close_approaches": int(rng.randint(1, 6)),
                "closest_approach_date": "2020-01-01",
                "closest_miss_distance_km": rng.uniform(50000, 7e7),
                "closest_relative_velocity_km_s": rng.uniform(3, 30),
                "orbit_class_type": rng.choice(["APO", "AMO", "ATE"]),
                "eccentricity": rng.uniform(0.01, 0.9),
                "semi_major_axis_au": rng.uniform(0.8, 4.0),
                "inclination_deg": rng.uniform(0, 30),
                "ascending_node_longitude_deg": rng.uniform(0, 360),
                "orbital_period_days": rng.uniform(200, 2000),
                "perihelion_distance_au": rng.uniform(0.3, 2),
                "aphelion_distance_au": rng.uniform(1, 5),
                "mean_anomaly_deg": rng.uniform(0, 360),
                "mean_motion_deg_per_day": rng.uniform(0.1, 1.2),
                "moid_au": moid,
                "data_arc_in_days": int(rng.randint(100, 8000)),
                "observations_used": int(rng.randint(10, 2000)),
            }
        )
    return pd.DataFrame(rows)


ALL_FEATURE_COLUMNS = ALL_NUMERIC_FEATURES + CATEGORICAL_FEATURES
