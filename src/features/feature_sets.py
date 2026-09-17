"""Controlled feature sets for the four leakage-audit experiments.

This module is the single source of truth for the classification behind
`docs/FEATURE_AUDIT.md` (that file is prose, this list is the enforced
definition — if they disagree, this module is correct). See that document
for the full per-feature reasoning; this module only encodes the
consequence of that reasoning: which columns each experiment is allowed
to see.

Background: `random_forest`/`xgboost` scored F1 = 1.000 in the Original
experiment because `moid_au` and `absolute_magnitude_h` are literally the
two quantities NASA/JPL's public PHA screening rule thresholds
(`MOID <= 0.05 au AND H <= 22.0`). `estimated_diameter_km_min/max` (and the
`diameter_km_mean` feature derived from them) are themselves a NASA-side
transform of `absolute_magnitude_h` (via the standard H-to-diameter
relation under an assumed albedo), so excluding only the two headline
fields and keeping diameter would not actually remove the leak — it would
just rename it. `LABEL_DERIVED_NUMERIC_FEATURES` exists specifically to
catch that.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from src.features.engineering import ALL_NUMERIC_FEATURES, CATEGORICAL_FEATURES

# Category A: fields NASA/JPL's public PHA screening rule is a direct
# threshold function of.
LABEL_DEFINING_NUMERIC_FEATURES = ["moid_au", "absolute_magnitude_h"]

# Category B: fields that are a deterministic/near-deterministic transform
# of a Category-A field, computed by NASA (diameter from absolute
# magnitude + assumed albedo) or derived from those fields in this
# pipeline (diameter_km_mean is the midpoint of the two Category-B
# min/max fields, so it inherits the category — see docs/FEATURE_AUDIT.md).
LABEL_DERIVED_NUMERIC_FEATURES = [
    "estimated_diameter_km_min",
    "estimated_diameter_km_max",
    "diameter_km_mean",
]

# Category F: mean_anomaly_deg is the object's position along its orbit at
# an arbitrary catalog-snapshot epoch, not a fixed physical property — see
# docs/FEATURE_AUDIT.md. Retained in Experiment A for parity with the
# legacy pipeline, excluded from Experiment D as scientifically
# inappropriate for an orbital-shape question.
EPOCH_DEPENDENT_FEATURES = ["mean_anomaly_deg"]

_EXCLUDED_FROM_LEAKAGE_AWARE = set(LABEL_DEFINING_NUMERIC_FEATURES) | set(
    LABEL_DERIVED_NUMERIC_FEATURES
)

_PHYSICAL_KINEMATIC_NUMERIC_FEATURES = [
    "closest_miss_distance_km",
    "log_closest_miss_distance_km",
    "closest_relative_velocity_km_s",
    "log_closest_relative_velocity_km_s",
    "num_recorded_close_approaches",
    "data_arc_in_days",
    "observations_used",
]

_ORBITAL_ONLY_NUMERIC_FEATURES = [
    "eccentricity",
    "semi_major_axis_au",
    "inclination_deg",
    "ascending_node_longitude_deg",
    "orbital_period_days",
    "log_orbital_period_days",
    "perihelion_distance_au",
    "aphelion_distance_au",
    "mean_motion_deg_per_day",
]


@dataclass(frozen=True)
class FeatureSet:
    key: str
    display_name: str
    purpose: str
    numeric_features: list[str]
    categorical_features: list[str] = field(default_factory=list)

    @property
    def feature_columns(self) -> list[str]:
        return list(self.numeric_features) + list(self.categorical_features)


FEATURE_SETS: dict[str, FeatureSet] = {
    "original": FeatureSet(
        key="original",
        display_name="Experiment A — Original / Label-Defining Feature Experiment",
        purpose=(
            "Demonstrate that ML can recover the existing NASA/JPL classification "
            "boundary when the variables defining that classification are supplied. "
            "Not interpreted as evidence of novel predictive capability — see "
            "docs/LIMITATIONS.md."
        ),
        numeric_features=list(ALL_NUMERIC_FEATURES),
        categorical_features=list(CATEGORICAL_FEATURES),
    ),
    "leakage_aware": FeatureSet(
        key="leakage_aware",
        display_name="Experiment B — Leakage-Aware / Feature-Restricted Experiment",
        purpose=(
            "Determine whether available NEO physical/orbital characteristics contain "
            "predictive information about the NASA/JPL target after excluding every "
            "variable that directly defines, or is a NASA-side derived transform of, "
            "that target. This is the primary research experiment."
        ),
        numeric_features=[
            f for f in ALL_NUMERIC_FEATURES if f not in _EXCLUDED_FROM_LEAKAGE_AWARE
        ],
        categorical_features=list(CATEGORICAL_FEATURES),
    ),
    "physical_kinematic_only": FeatureSet(
        key="physical_kinematic_only",
        display_name="Experiment C — Physical/Kinematic-Only",
        purpose=(
            "Use only physical/kinematic close-approach measurements (not orbital-shape "
            "elements, not diameter/magnitude). Diameter was excluded from this "
            "experiment despite being 'physical' in the colloquial sense because "
            "docs/FEATURE_AUDIT.md classifies it as a NASA-side derived transform of "
            "absolute_magnitude_h (Category B), not scientifically defensible for a "
            "leakage-aware physical feature set."
        ),
        numeric_features=list(_PHYSICAL_KINEMATIC_NUMERIC_FEATURES),
        categorical_features=[],
    ),
    "orbital_only": FeatureSet(
        key="orbital_only",
        display_name="Experiment D — Orbital-Only",
        purpose=(
            "Use only orbital-shape/orientation elements that do not directly define "
            "the target: eccentricity, inclination, semi-major axis, node longitude, "
            "period, perihelion/aphelion distance, mean motion, and orbit class. "
            "Excludes moid_au (Category A) and mean_anomaly_deg (Category F, "
            "epoch-dependent, not a fixed orbital-shape descriptor)."
        ),
        numeric_features=list(_ORBITAL_ONLY_NUMERIC_FEATURES),
        categorical_features=list(CATEGORICAL_FEATURES),
    ),
}


class LeakageError(RuntimeError):
    """Raised when a non-original feature set would admit a label-defining/derived field."""


def assert_no_label_leakage(feature_set: FeatureSet) -> None:
    """Fail loudly if a leakage-audited experiment's columns include an
    excluded (Category A/B) feature, or any transform of one under a
    different name.

    This is deliberately re-checked at run time (not just enforced by
    construction above) so that a future edit to FEATURE_SETS or to
    src/features/engineering.py cannot silently reintroduce leakage — see
    docs/FEATURE_AUDIT.md item 45 ("automated validation").
    """
    if feature_set.key == "original":
        return
    leaked = set(feature_set.numeric_features) & _EXCLUDED_FROM_LEAKAGE_AWARE
    if leaked:
        raise LeakageError(
            f"Feature set '{feature_set.key}' includes label-defining/derived "
            f"feature(s) {sorted(leaked)}, which docs/FEATURE_AUDIT.md classifies "
            "as Category A or B. This must never happen for a non-original experiment."
        )
    # Guard against a future derived feature reusing a Category A/B name
    # under a transform prefix (e.g. a hypothetical `log_moid_au`).
    for name in feature_set.numeric_features:
        base = name[len("log_") :] if name.startswith("log_") else name
        if base in _EXCLUDED_FROM_LEAKAGE_AWARE:
            raise LeakageError(
                f"Feature set '{feature_set.key}' includes '{name}', a transform of "
                f"the excluded Category A/B feature '{base}'."
            )


def get_feature_set(key: str) -> FeatureSet:
    try:
        feature_set = FEATURE_SETS[key]
    except KeyError as exc:
        raise KeyError(
            f"Unknown feature set '{key}'. Known: {sorted(FEATURE_SETS)}"
        ) from exc
    assert_no_label_leakage(feature_set)
    return feature_set


def build_feature_matrix_for(df, feature_set: FeatureSet):
    """Like src.features.engineering.build_feature_matrix, but restricted to
    one experiment's feature columns. Assumes df already has derived
    features added (src.features.engineering.add_derived_features) and the
    target column present.
    """
    from src.features.engineering import TARGET_COLUMN

    assert_no_label_leakage(feature_set)
    x = df[feature_set.feature_columns].copy()
    y = df[TARGET_COLUMN].astype(bool)
    return x, y


# Sanity check at import time: every non-original feature set must already
# be clean. A failure here means FEATURE_SETS itself was defined wrong.
for _fs in FEATURE_SETS.values():
    assert_no_label_leakage(_fs)
del _fs
