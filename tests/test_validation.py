import pandas as pd

from src.data.validation import clean, flatten_record, validate_schema
from tests.fixtures.sample_neo_records import SAMPLE_RAW_RECORDS, VALID_RECORD_HAZARDOUS


def test_flatten_record_picks_closest_approach_by_min_distance():
    flat = flatten_record(VALID_RECORD_HAZARDOUS)
    # Fixture has two approaches: 500,000 km and 200,000 km. The closer one must win.
    assert flat["closest_miss_distance_km"] == 200000.0
    assert flat["closest_relative_velocity_km_s"] == 20.0
    assert flat["num_recorded_close_approaches"] == 2


def test_flatten_record_derives_expected_fields():
    flat = flatten_record(VALID_RECORD_HAZARDOUS)
    assert flat["neo_id"] == "9000001"
    assert flat["moid_au"] == 0.01
    assert flat["orbit_class_type"] == "APO"


def test_validate_schema_counts_missing_required_fields():
    report = validate_schema(SAMPLE_RAW_RECORDS)
    assert report["total_records"] == 5
    # RECORD_MISSING_ID lacks 'id'; RECORD_MISSING_TARGET lacks the target.
    assert report["missing_required_field_counts"]["id"] == 1
    assert report["missing_required_field_counts"]["is_potentially_hazardous_asteroid"] == 1


def test_clean_drops_missing_id_missing_target_and_duplicates():
    df = pd.DataFrame([flatten_record(r) for r in SAMPLE_RAW_RECORDS])
    cleaned, report = clean(df)

    # 5 rows in -> drop 1 missing id, 1 missing target, 1 duplicate -> 2 remain.
    assert report.rows_before == 5
    assert report.dropped_missing_id == 1
    assert report.dropped_missing_target == 1
    assert report.dropped_duplicate_id == 1
    assert report.rows_after == 2
    assert len(cleaned) == 2
    assert cleaned["neo_id"].is_unique
