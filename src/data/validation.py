"""Validation, flattening, and documented cleaning of raw NeoWs data.

Usage:
    python -m src.data.validation [--raw-file PATH]

Reads the most recent raw ingestion output from data/raw/ (or an explicit
--raw-file), flattens each NASA NEO record into one row per object, reports
data-quality issues, applies a documented (never silent) cleaning step, and
writes:
  - data/processed/neo_dataset.csv
  - data/processed/validation_report.json

This module never invents replacement values for missing or malformed data.
Numeric fields that cannot be parsed are left as NaN and counted in the
validation report; rows missing the identifier or the target label are
dropped (and the count/reason is recorded), everything else is preserved.
"""
from __future__ import annotations

import argparse
import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import pandas as pd

from src.config import settings
from src.data.schema import REQUIRED_FIELDS

logger = logging.getLogger(__name__)


class ValidationError(RuntimeError):
    """Raised when the pipeline cannot proceed honestly (e.g. no raw data present)."""


def _to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def find_latest_raw_file(raw_dir: Path | None = None) -> Path:
    raw_dir = raw_dir or settings.raw_dir
    candidates = sorted(raw_dir.glob("neows_browse_*.json"))
    candidates = [p for p in candidates if not p.name.endswith(".metadata.json")]
    if not candidates:
        raise ValidationError(
            f"No raw NeoWs data found in {raw_dir}. Run `python -m src.data.ingestion` first."
        )
    return candidates[-1]


def flatten_record(raw: dict[str, Any]) -> dict[str, Any]:
    """Flatten one NeoWs NEO object into a single feature row.

    Design choice (documented in docs/METHODOLOGY.md): the target
    (`is_potentially_hazardous_asteroid`) is defined per *object*, not per
    close approach, so this pipeline produces exactly one row per unique
    NEO id. Among an object's recorded close-approach events, we take the
    one with the minimum Earth miss-distance ("closest recorded approach")
    as representative approach kinematics for that object.
    """
    orbital = raw.get("orbital_data") or {}
    orbit_class = orbital.get("orbit_class") or {}
    diameter_km = (raw.get("estimated_diameter") or {}).get("kilometers") or {}

    approaches = raw.get("close_approach_data") or []
    closest = None
    closest_km = None
    for approach in approaches:
        miss_km = _to_float((approach.get("miss_distance") or {}).get("kilometers"))
        if miss_km is not None and (closest_km is None or miss_km < closest_km):
            closest_km = miss_km
            closest = approach

    relative_velocity = (closest or {}).get("relative_velocity") or {}

    return {
        "neo_id": raw.get("id"),
        "name": raw.get("name"),
        "designation": raw.get("designation"),
        "absolute_magnitude_h": _to_float(raw.get("absolute_magnitude_h")),
        "estimated_diameter_km_min": _to_float(diameter_km.get("estimated_diameter_min")),
        "estimated_diameter_km_max": _to_float(diameter_km.get("estimated_diameter_max")),
        "is_potentially_hazardous_asteroid": raw.get("is_potentially_hazardous_asteroid"),
        "is_sentry_object": raw.get("is_sentry_object"),
        "num_recorded_close_approaches": len(approaches),
        "closest_approach_date": (closest or {}).get("close_approach_date"),
        "closest_miss_distance_km": closest_km,
        "closest_relative_velocity_km_s": _to_float(relative_velocity.get("kilometers_per_second")),
        "orbit_class_type": orbit_class.get("orbit_class_type"),
        "eccentricity": _to_float(orbital.get("eccentricity")),
        "semi_major_axis_au": _to_float(orbital.get("semi_major_axis")),
        "inclination_deg": _to_float(orbital.get("inclination")),
        "ascending_node_longitude_deg": _to_float(orbital.get("ascending_node_longitude")),
        "orbital_period_days": _to_float(orbital.get("orbital_period")),
        "perihelion_distance_au": _to_float(orbital.get("perihelion_distance")),
        "aphelion_distance_au": _to_float(orbital.get("aphelion_distance")),
        "mean_anomaly_deg": _to_float(orbital.get("mean_anomaly")),
        "mean_motion_deg_per_day": _to_float(orbital.get("mean_motion")),
        "moid_au": _to_float(orbital.get("minimum_orbit_intersection")),
        "data_arc_in_days": _to_float(orbital.get("data_arc_in_days")),
        "observations_used": orbital.get("observations_used"),
    }


def validate_schema(raw_records: list[dict[str, Any]]) -> dict[str, Any]:
    missing_field_counts: dict[str, int] = {field: 0 for field in REQUIRED_FIELDS}
    for record in raw_records:
        for field in REQUIRED_FIELDS:
            if record.get(field) is None:
                missing_field_counts[field] += 1
    return {"total_records": len(raw_records), "missing_required_field_counts": missing_field_counts}


@dataclass
class CleaningReport:
    rows_before: int
    rows_after: int
    dropped_missing_id: int
    dropped_missing_target: int
    dropped_duplicate_id: int
    null_percentage_by_column: dict[str, float]


def compute_null_percentages(df: pd.DataFrame) -> dict[str, float]:
    if len(df) == 0:
        return {col: 0.0 for col in df.columns}
    return (df.isna().mean() * 100).round(2).to_dict()


def clean(df: pd.DataFrame) -> tuple[pd.DataFrame, CleaningReport]:
    rows_before = len(df)

    missing_id_mask = df["neo_id"].isna()
    dropped_missing_id = int(missing_id_mask.sum())
    df = df[~missing_id_mask]

    missing_target_mask = df["is_potentially_hazardous_asteroid"].isna()
    dropped_missing_target = int(missing_target_mask.sum())
    df = df[~missing_target_mask]

    duplicate_mask = df.duplicated(subset=["neo_id"], keep="first")
    dropped_duplicate_id = int(duplicate_mask.sum())
    df = df[~duplicate_mask]

    report = CleaningReport(
        rows_before=rows_before,
        rows_after=len(df),
        dropped_missing_id=dropped_missing_id,
        dropped_missing_target=dropped_missing_target,
        dropped_duplicate_id=dropped_duplicate_id,
        null_percentage_by_column=compute_null_percentages(df),
    )
    return df.reset_index(drop=True), report


def run(raw_file: Path | None = None) -> tuple[pd.DataFrame, dict[str, Any]]:
    path = raw_file or find_latest_raw_file()
    raw_records = json.loads(path.read_text())
    if not isinstance(raw_records, list):
        raise ValidationError(f"Expected {path} to contain a JSON list of NEO records.")

    schema_report = validate_schema(raw_records)
    df = pd.DataFrame([flatten_record(record) for record in raw_records])
    cleaned_df, cleaning_report = clean(df)

    full_report = {
        "source_raw_file": str(path),
        "validated_at_utc": datetime.now(timezone.utc).isoformat(),
        "schema_validation": schema_report,
        "cleaning": asdict(cleaning_report),
    }
    return cleaned_df, full_report


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Validate and clean ingested NEO data.")
    parser.add_argument("--raw-file", type=Path, default=None)
    args = parser.parse_args()

    df, report = run(raw_file=args.raw_file)

    settings.processed_dir.mkdir(parents=True, exist_ok=True)
    output_csv = settings.processed_dir / "neo_dataset.csv"
    output_report = settings.processed_dir / "validation_report.json"

    df.to_csv(output_csv, index=False)
    output_report.write_text(json.dumps(report, indent=2))

    print(f"Wrote {len(df)} validated rows -> {output_csv}")
    print(f"Validation report -> {output_report}")


if __name__ == "__main__":
    main()
