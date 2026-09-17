# Results

**This file is generated, not hand-typed.** Regenerate with:

```bash
python -m src.experiments.generate_report
```

Generated at: 2026-09-17T22:34:43.597601+00:00

**No experiment run found.** `results/experiments/summary.json` does not exist yet — run `python -m src.experiments.run_all` first (requires a populated `data/processed/neo_dataset.csv`, i.e. ingestion + validation must have run against the real NASA NeoWs API first). This project never fabricates the numbers this report would otherwise contain — see docs/LIMITATIONS.md and docs/DATA_SOURCE.md.

## Experiments

### Experiment A — Original / Label-Defining Feature Experiment

Demonstrate that ML can recover the existing NASA/JPL classification boundary when the variables defining that classification are supplied. Not interpreted as evidence of novel predictive capability — see docs/LIMITATIONS.md.

Feature columns (21): `absolute_magnitude_h, eccentricity, semi_major_axis_au, inclination_deg, ascending_node_longitude_deg, orbital_period_days, perihelion_distance_au, aphelion_distance_au, mean_anomaly_deg, mean_motion_deg_per_day, moid_au, data_arc_in_days, observations_used, num_recorded_close_approaches, closest_miss_distance_km, closest_relative_velocity_km_s, diameter_km_mean, log_closest_miss_distance_km, log_closest_relative_velocity_km_s, log_orbital_period_days, orbit_class_type`

#### `dummy_most_frequent`

**Not yet executed.** No artifacts found at `/home/user/NEO-Hazard-AI/results/experiments/original/dummy_most_frequent`.

#### `logistic_regression`

**Not yet executed.** No artifacts found at `/home/user/NEO-Hazard-AI/results/experiments/original/logistic_regression`.

#### `random_forest`

**Not yet executed.** No artifacts found at `/home/user/NEO-Hazard-AI/results/experiments/original/random_forest`.

#### `xgboost`

**Not yet executed.** No artifacts found at `/home/user/NEO-Hazard-AI/results/experiments/original/xgboost`.

### Experiment B — Leakage-Aware / Feature-Restricted Experiment

Determine whether available NEO physical/orbital characteristics contain predictive information about the NASA/JPL target after excluding every variable that directly defines, or is a NASA-side derived transform of, that target. This is the primary research experiment.

Feature columns (18): `eccentricity, semi_major_axis_au, inclination_deg, ascending_node_longitude_deg, orbital_period_days, perihelion_distance_au, aphelion_distance_au, mean_anomaly_deg, mean_motion_deg_per_day, data_arc_in_days, observations_used, num_recorded_close_approaches, closest_miss_distance_km, closest_relative_velocity_km_s, log_closest_miss_distance_km, log_closest_relative_velocity_km_s, log_orbital_period_days, orbit_class_type`

#### `dummy_most_frequent`

**Not yet executed.** No artifacts found at `/home/user/NEO-Hazard-AI/results/experiments/leakage_aware/dummy_most_frequent`.

#### `logistic_regression`

**Not yet executed.** No artifacts found at `/home/user/NEO-Hazard-AI/results/experiments/leakage_aware/logistic_regression`.

#### `random_forest`

**Not yet executed.** No artifacts found at `/home/user/NEO-Hazard-AI/results/experiments/leakage_aware/random_forest`.

#### `xgboost`

**Not yet executed.** No artifacts found at `/home/user/NEO-Hazard-AI/results/experiments/leakage_aware/xgboost`.

### Experiment C — Physical/Kinematic-Only

Use only physical/kinematic close-approach measurements (not orbital-shape elements, not diameter/magnitude). Diameter was excluded from this experiment despite being 'physical' in the colloquial sense because docs/FEATURE_AUDIT.md classifies it as a NASA-side derived transform of absolute_magnitude_h (Category B), not scientifically defensible for a leakage-aware physical feature set.

Feature columns (7): `closest_miss_distance_km, log_closest_miss_distance_km, closest_relative_velocity_km_s, log_closest_relative_velocity_km_s, num_recorded_close_approaches, data_arc_in_days, observations_used`

#### `dummy_most_frequent`

**Not yet executed.** No artifacts found at `/home/user/NEO-Hazard-AI/results/experiments/physical_kinematic_only/dummy_most_frequent`.

#### `logistic_regression`

**Not yet executed.** No artifacts found at `/home/user/NEO-Hazard-AI/results/experiments/physical_kinematic_only/logistic_regression`.

#### `random_forest`

**Not yet executed.** No artifacts found at `/home/user/NEO-Hazard-AI/results/experiments/physical_kinematic_only/random_forest`.

#### `xgboost`

**Not yet executed.** No artifacts found at `/home/user/NEO-Hazard-AI/results/experiments/physical_kinematic_only/xgboost`.

### Experiment D — Orbital-Only

Use only orbital-shape/orientation elements that do not directly define the target: eccentricity, inclination, semi-major axis, node longitude, period, perihelion/aphelion distance, mean motion, and orbit class. Excludes moid_au (Category A) and mean_anomaly_deg (Category F, epoch-dependent, not a fixed orbital-shape descriptor).

Feature columns (10): `eccentricity, semi_major_axis_au, inclination_deg, ascending_node_longitude_deg, orbital_period_days, log_orbital_period_days, perihelion_distance_au, aphelion_distance_au, mean_motion_deg_per_day, orbit_class_type`

#### `dummy_most_frequent`

**Not yet executed.** No artifacts found at `/home/user/NEO-Hazard-AI/results/experiments/orbital_only/dummy_most_frequent`.

#### `logistic_regression`

**Not yet executed.** No artifacts found at `/home/user/NEO-Hazard-AI/results/experiments/orbital_only/logistic_regression`.

#### `random_forest`

**Not yet executed.** No artifacts found at `/home/user/NEO-Hazard-AI/results/experiments/orbital_only/random_forest`.

#### `xgboost`

**Not yet executed.** No artifacts found at `/home/user/NEO-Hazard-AI/results/experiments/orbital_only/xgboost`.

## Reproducibility

```bash
python -m src.data.ingestion
python -m src.data.validation
python -m src.experiments.run_all
python -m src.experiments.generate_report
```

See `docs/REPRODUCIBILITY.md` for seed/version/dataset-identifier tracking, and `docs/LIMITATIONS.md` for what these numbers do and do not mean.
