import pytest
from pydantic import ValidationError

from src.data.schema import NearEarthObject
from tests.fixtures.sample_neo_records import RECORD_MISSING_ID, VALID_RECORD_HAZARDOUS


def test_valid_record_parses():
    parsed = NearEarthObject.model_validate(VALID_RECORD_HAZARDOUS)
    assert parsed.id == "9000001"
    assert parsed.is_potentially_hazardous_asteroid is True
    assert parsed.orbital_data.eccentricity == "0.4"
    assert len(parsed.close_approach_data) == 2


def test_record_missing_id_is_rejected():
    with pytest.raises(ValidationError):
        NearEarthObject.model_validate(RECORD_MISSING_ID)
