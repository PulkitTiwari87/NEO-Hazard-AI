# Feature Definitions

This document mirrors `FEATURE_DEFINITIONS`, `PASSTHROUGH_NUMERIC_FEATURES`,
and `CATEGORICAL_FEATURES` in `src/features/engineering.py` — that module is
the single source of truth; this file explains it in prose. If the two ever
disagree, the code is correct and this file is stale.

Row grain: **one row per unique NEO object** (deduplicated by NASA's `id`
field during `src/data/validation.py::clean`). See `docs/METHODOLOGY.md`
for why this grain was chosen and how the "representative" close-approach
values below are picked.

## Target

| Field | Definition |
|---|---|
| `is_potentially_hazardous_asteroid` | NASA/JPL's own classification, passed through unmodified from NeoWs. See `docs/LIMITATIONS.md` for what this flag does and does not mean. |

## NASA-provided features (passed through, no transformation)

| Feature | Source field | Unit | Notes |
|---|---|---|---|
| `absolute_magnitude_h` | `absolute_magnitude_h` | magnitude | Proxy for size given an assumed albedo; NASA-computed, not derived here. |
| `eccentricity` | `orbital_data.eccentricity` | dimensionless | |
| `semi_major_axis_au` | `orbital_data.semi_major_axis` | au | |
| `inclination_deg` | `orbital_data.inclination` | degrees | |
| `ascending_node_longitude_deg` | `orbital_data.ascending_node_longitude` | degrees | |
| `orbital_period_days` | `orbital_data.orbital_period` | days | |
| `perihelion_distance_au` | `orbital_data.perihelion_distance` | au | |
| `aphelion_distance_au` | `orbital_data.aphelion_distance` | au | |
| `mean_anomaly_deg` | `orbital_data.mean_anomaly` | degrees | |
| `mean_motion_deg_per_day` | `orbital_data.mean_motion` | degrees/day | |
| `moid_au` | `orbital_data.minimum_orbit_intersection` | au | Minimum Orbit Intersection Distance with Earth's orbit — a geometric quantity, not a collision probability. |
| `data_arc_in_days` | `orbital_data.data_arc_in_days` | days | Span of observations used to determine the orbit; a data-quality signal, not a physical property of the object. |
| `observations_used` | `orbital_data.observations_used` | count | Same caveat as above. |
| `num_recorded_close_approaches` | count of entries in `close_approach_data` | count | How many close approaches NASA has on record for this object — depends on observation history, not just orbital geometry. |
| `closest_miss_distance_km` | `min(close_approach_data[*].miss_distance.kilometers)` | km | See `docs/METHODOLOGY.md` — the minimum recorded, not necessarily the true closest possible approach. |
| `closest_relative_velocity_km_s` | `relative_velocity.kilometers_per_second` of the closest recorded approach | km/s | |

## Categorical feature

| Feature | Source field | Encoding |
|---|---|---|
| `orbit_class_type` | `orbital_data.orbit_class.orbit_class_type` | One-hot encoded inside the modeling `ColumnTransformer`, with unknown categories at inference time mapped to all-zero (via `handle_unknown="ignore"`). |

## Derived features

| Name | Formula | Source field(s) | Unit | Rationale |
|---|---|---|---|---|
| `diameter_km_mean` | `(estimated_diameter_km_min + estimated_diameter_km_max) / 2` | `estimated_diameter.kilometers.{min,max}` | km | NASA reports a range, not a point estimate (diameter itself is inferred from magnitude + assumed albedo, not directly measured); the midpoint is a transparent single-number summary of that range. |
| `log_closest_miss_distance_km` | `log1p(closest_miss_distance_km)` | `closest_miss_distance_km` | log(1+km) | Miss distances span ~2–3 orders of magnitude and are strongly right-skewed; log1p is a standard, invertible variance-stabilizing transform, useful for the linear baseline model in particular. |
| `log_closest_relative_velocity_km_s` | `log1p(closest_relative_velocity_km_s)` | `closest_relative_velocity_km_s` | log(1+km/s) | Same right-skew rationale as above. |
| `log_orbital_period_days` | `log1p(orbital_period_days)` | `orbital_period_days` | log(1+days) | Orbital periods range from under a year (Aten/Atira-class objects) to centuries; log-scaling reduces skew for the linear model. |

## Leakage-aware exclusion (Experiment B)

`src/features/engineering.py::EXPERIMENTS["experiment_b_leakage_aware"]`
trains every model a second time with `moid_au` and `absolute_magnitude_h`
excluded from the feature set above — NASA/JPL's own PHA screening rule is
approximately a threshold function of exactly those two fields, so
including them lets a model recover that rule rather than demonstrate
independent signal. See `docs/METHODOLOGY.md` and `docs/LIMITATIONS.md`.

## Features deliberately *not* included

No combined/ratio features (e.g. velocity ÷ MOID) were added. Per the
project's decision rule (prefer scientifically defensible over
performance-motivated features), a combined ratio like that has no
established physical or statistical justification here and was excluded
rather than invented to chase a metric.
