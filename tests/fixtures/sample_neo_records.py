"""SYNTHETIC test fixtures only.

These records are hand-written to conform to the documented NeoWs JSON
schema (src/data/schema.py) purely so unit tests can exercise parsing,
validation, and feature-engineering code paths. They are NOT real NASA
observations, must never be presented as such, and must never be loaded
into data/raw, data/processed, or any reported dataset statistic.
"""
from __future__ import annotations

VALID_RECORD_HAZARDOUS = {
    "id": "9000001",
    "neo_reference_id": "9000001",
    "name": "(9000001) Fixture-A",
    "designation": "9000001",
    "nasa_jpl_url": "https://ssd.jpl.nasa.gov/fixture",
    "absolute_magnitude_h": 19.5,
    "estimated_diameter": {
        "kilometers": {"estimated_diameter_min": 0.3, "estimated_diameter_max": 0.7}
    },
    "is_potentially_hazardous_asteroid": True,
    "is_sentry_object": False,
    "close_approach_data": [
        {
            "close_approach_date": "2021-05-01",
            "relative_velocity": {"kilometers_per_second": "12.5"},
            "miss_distance": {"kilometers": "500000"},
            "orbiting_body": "Earth",
        },
        {
            "close_approach_date": "2019-01-01",
            "relative_velocity": {"kilometers_per_second": "20.0"},
            "miss_distance": {"kilometers": "200000"},
            "orbiting_body": "Earth",
        },
    ],
    "orbital_data": {
        "orbit_id": "1",
        "data_arc_in_days": 3000,
        "observations_used": 400,
        "orbit_uncertainty": "0",
        "minimum_orbit_intersection": "0.01",
        "eccentricity": "0.4",
        "semi_major_axis": "1.5",
        "inclination": "10.0",
        "ascending_node_longitude": "100.0",
        "orbital_period": "600.0",
        "perihelion_distance": "0.9",
        "aphelion_distance": "2.1",
        "mean_anomaly": "50.0",
        "mean_motion": "0.6",
        "orbit_class": {"orbit_class_type": "APO"},
    },
}

VALID_RECORD_NOT_HAZARDOUS = {
    "id": "9000002",
    "name": "(9000002) Fixture-B",
    "absolute_magnitude_h": 22.0,
    "estimated_diameter": {
        "kilometers": {"estimated_diameter_min": 0.05, "estimated_diameter_max": 0.1}
    },
    "is_potentially_hazardous_asteroid": False,
    "close_approach_data": [
        {
            "close_approach_date": "2020-01-01",
            "relative_velocity": {"kilometers_per_second": "8.0"},
            "miss_distance": {"kilometers": "50000000"},
            "orbiting_body": "Earth",
        }
    ],
    "orbital_data": {
        "eccentricity": "0.1",
        "semi_major_axis": "2.2",
        "inclination": "3.0",
        "minimum_orbit_intersection": "0.5",
        "orbital_period": "1200.0",
        "aphelion_distance": "2.4",
        "perihelion_distance": "2.0",
        "mean_anomaly": "10.0",
        "mean_motion": "0.3",
        "ascending_node_longitude": "10.0",
        "data_arc_in_days": 1000,
        "observations_used": 50,
        "orbit_class": {"orbit_class_type": "AMO"},
    },
}

# Missing required fields ("id" and target label) — used to test that
# validation.clean() drops these rather than silently keeping or imputing them.
RECORD_MISSING_ID = {
    "name": "(no id) Fixture-C",
    "absolute_magnitude_h": 20.0,
    "is_potentially_hazardous_asteroid": False,
}

RECORD_MISSING_TARGET = {
    "id": "9000003",
    "name": "(9000003) Fixture-D",
    "absolute_magnitude_h": 18.0,
}

DUPLICATE_OF_FIRST = dict(VALID_RECORD_HAZARDOUS)

SAMPLE_RAW_RECORDS = [
    VALID_RECORD_HAZARDOUS,
    VALID_RECORD_NOT_HAZARDOUS,
    RECORD_MISSING_ID,
    RECORD_MISSING_TARGET,
    DUPLICATE_OF_FIRST,
]
