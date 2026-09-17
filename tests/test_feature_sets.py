import pytest

from src.features.engineering import ALL_NUMERIC_FEATURES
from src.features.feature_sets import (
    FEATURE_SETS,
    LABEL_DEFINING_NUMERIC_FEATURES,
    LABEL_DERIVED_NUMERIC_FEATURES,
    FeatureSet,
    LeakageError,
    assert_no_label_leakage,
    get_feature_set,
)


def test_four_experiments_are_defined():
    assert set(FEATURE_SETS) == {"original", "leakage_aware", "physical_kinematic_only", "orbital_only"}


def test_original_feature_set_matches_legacy_engineering_module():
    assert FEATURE_SETS["original"].numeric_features == ALL_NUMERIC_FEATURES


def test_original_feature_set_includes_label_defining_and_derived_features():
    original = set(FEATURE_SETS["original"].feature_columns)
    assert set(LABEL_DEFINING_NUMERIC_FEATURES) <= original
    assert "diameter_km_mean" in original


@pytest.mark.parametrize("key", ["leakage_aware", "physical_kinematic_only", "orbital_only"])
def test_leakage_audited_sets_exclude_label_defining_and_derived_features(key):
    feature_set = FEATURE_SETS[key]
    columns = set(feature_set.feature_columns)
    for excluded in LABEL_DEFINING_NUMERIC_FEATURES + LABEL_DERIVED_NUMERIC_FEATURES:
        assert excluded not in columns, f"'{excluded}' leaked into feature set '{key}'"


def test_assert_no_label_leakage_passes_for_defined_sets():
    for feature_set in FEATURE_SETS.values():
        assert_no_label_leakage(feature_set)  # must not raise


def test_assert_no_label_leakage_catches_direct_inclusion():
    bad = FeatureSet(
        key="bad",
        display_name="bad",
        purpose="test",
        numeric_features=["eccentricity", "moid_au"],
    )
    with pytest.raises(LeakageError):
        assert_no_label_leakage(bad)


def test_assert_no_label_leakage_catches_renamed_transform():
    """A hypothetical log_moid_au must not slip past the check just because
    it isn't literally named 'moid_au'.
    """
    bad = FeatureSet(
        key="bad",
        display_name="bad",
        purpose="test",
        numeric_features=["eccentricity", "log_moid_au"],
    )
    with pytest.raises(LeakageError):
        assert_no_label_leakage(bad)


def test_get_feature_set_unknown_key_raises():
    with pytest.raises(KeyError):
        get_feature_set("not_a_real_experiment")


def test_physical_kinematic_only_excludes_orbital_shape_features():
    columns = set(FEATURE_SETS["physical_kinematic_only"].feature_columns)
    assert "eccentricity" not in columns
    assert "semi_major_axis_au" not in columns


def test_orbital_only_excludes_epoch_dependent_mean_anomaly():
    columns = set(FEATURE_SETS["orbital_only"].feature_columns)
    assert "mean_anomaly_deg" not in columns
    assert "eccentricity" in columns
