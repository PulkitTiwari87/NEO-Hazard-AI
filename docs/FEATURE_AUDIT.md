# Feature Audit

This document exists because of one observed fact: `random_forest` and
`xgboost` scored **F1 = 1.000 / ROC-AUC ≈ 1.000 / PR-AUC ≈ 1.000** on the
first real run (see `docs/MODEL_CARD.md`, "Original Feature Experiment").
That is not a result to celebrate — it is a signal to investigate, and this
file is the investigation.

Mirrors `LABEL_DEFINING_FEATURES`, `LABEL_DERIVED_FEATURES`, and
`FEATURE_SETS` in `src/features/feature_sets.py` — that module is the
single source of truth the code, the API (`GET /api/feature-audit`), and
this document all derive from. If the two ever disagree, the code is
correct and this file is stale.

## Why the review, not just "remove MOID and magnitude"

The task is to find every feature that lets the model shortcut to the
answer, not just the two obvious ones. NASA/JPL's public definition of
`is_potentially_hazardous_asteroid` is (per CNEOS's documented screening
criterion): **MOID with Earth ≤ 0.05 au AND absolute magnitude H ≤ 22.0**.
So `moid_au` and `absolute_magnitude_h` are the two fields the label is a
direct threshold function of. But NASA does not stop at magnitude — it
also *derives* an estimated diameter from magnitude (assuming a fixed
albedo), and that derived quantity is exposed as a separate-looking field
in the API. A feature audit that only removes the two headline fields and
misses that derivation is not actually leakage-aware; it just renamed the
leak. That is exactly what this audit exists to catch.

## Category definitions

| Code | Meaning |
|---|---|
| A | Direct label-defining feature — literally one of the two quantities NASA's screening rule thresholds. |
| B | Derived from a label-defining feature — a deterministic or near-deterministic transform of an A-category field, computed by NASA before the data ever reaches this pipeline. |
| C | Potential proxy for the label — empirically correlated with hazard classification through a distinct physical/observational mechanism, not a formula on an A-category field. Kept, but flagged for explicit correlation checking once real data exists. |
| D | Scientifically independent candidate feature — an orbital or kinematic quantity with no known formula-level or definitional tie to the label. |
| E | Metadata/identifier — carries no predictive content by construction (name, id, date). |
| F | Invalid for modeling — has a known reason it should not be fed to a classifier as-is (epoch-dependent, non-stationary, or otherwise not a fixed property of the object). |

## Full audit table

| Feature | Category | Reasoning |
|---|---|---|
| `moid_au` | **A** | Minimum Orbit Intersection Distance with Earth's orbit — one of the two quantities NASA/JPL's public PHA screening rule thresholds directly (`MOID ≤ 0.05 au`). |
| `absolute_magnitude_h` | **A** | The other quantity in NASA's threshold rule (`H ≤ 22.0`). |
| `estimated_diameter_km_min` | **B** | NASA computes estimated diameter from `absolute_magnitude_h` and an assumed albedo via the standard IAU relation `D (km) = 1329 / sqrt(albedo) * 10^(-H/5)`. This field is not an independent measurement — it is a monotonic transform of the A-category `absolute_magnitude_h` (smaller `H` → larger diameter), computed by NASA before ingestion. Already flagged in `docs/FEATURES.md`: "NASA reports estimated diameter... derived from absolute magnitude under an assumed albedo, not a direct measurement." |
| `estimated_diameter_km_max` | **B** | Same relation as above, same reasoning. |
| `diameter_km_mean` (derived, `src/features/engineering.py`) | **B** | `(estimated_diameter_km_min + estimated_diameter_km_max) / 2` — the midpoint of two Category-B fields is still Category B. Averaging does not remove the dependency on `absolute_magnitude_h`; this is exactly the "circumventing leakage by renaming the feature" case the task calls out, and it is excluded from every non-original feature set for that reason. |
| `closest_miss_distance_km` / `log_closest_miss_distance_km` | **C** | This is the minimum *recorded close-approach* distance (an actual observed encounter with Earth), not the geometric MOID (the theoretical minimum distance between the two orbits' curves, independent of timing). They are different quantities — an object can have a small MOID with no recorded close approach that small yet (orbits intersect in space but the two bodies haven't been near that point at the same time), or vice versa within observational limits. They are plausibly *correlated* (low MOID makes a very close recorded approach more physically possible) but are not the same field NASA's rule uses, so they stay in the leakage-aware set — flagged here so the planned correlation matrix (`docs/RESULTS.md`, once generated) is read with this in mind rather than assumed independent. |
| `num_recorded_close_approaches` | **C** | Observation-count feature. Flagged because objects NASA already considers more hazard-relevant may, in principle, get prioritized for more tracking (an indirect, non-formula pathway to the label). No evidence for or against this exists yet without real data — kept, flagged for the same correlation check as above. |
| `data_arc_in_days` | **D** | Span of the observation history used to fit the orbit. A data-quality/observation-history signal, not derived from `moid_au` or `absolute_magnitude_h` by any formula. |
| `observations_used` | **D** | Same reasoning as `data_arc_in_days`. |
| `closest_relative_velocity_km_s` / `log_closest_relative_velocity_km_s` | **D** | Kinematic quantity from the closest recorded approach; not part of NASA's PHA threshold definition and not a formula on `moid_au`/`absolute_magnitude_h`. |
| `eccentricity` | **D** | Orbital shape parameter; independent of the label's threshold definition. |
| `semi_major_axis_au` | **D** | Orbital size parameter; independent. |
| `inclination_deg` | **D** | Orbital orientation parameter; independent. |
| `ascending_node_longitude_deg` | **D** | Orbital orientation parameter; independent. |
| `orbital_period_days` / `log_orbital_period_days` | **D** | Related to `semi_major_axis_au` via Kepler's third law, not to `moid_au` or `absolute_magnitude_h`; independent of the label definition. |
| `perihelion_distance_au` | **D** | Orbital shape parameter. Related to `moid_au` only in the loose physical sense that a small perihelion distance is *necessary but far from sufficient* for a small MOID (MOID also depends on the relative orientation of the two orbits, i.e. inclination and node longitude) — it is not a formula for MOID and is kept as an independent orbital-shape candidate feature, consistent with it being explicitly named in the task's own Experiment D example list. |
| `aphelion_distance_au` | **D** | Orbital shape parameter; independent. |
| `mean_motion_deg_per_day` | **D** | Related to `orbital_period_days`/`semi_major_axis_au` via Kepler's third law (redundant with them, a multicollinearity note, not a leakage note) — independent of the label. |
| `orbit_class_type` (categorical) | **D** | NASA/JPL orbit-family classification (e.g. Apollo/Amor/Aten); a coarse orbital-shape summary, independent of the label's threshold definition. |
| `mean_anomaly_deg` | **F** | This is the object's position *along* its orbit at an arbitrary catalog-snapshot epoch — not a fixed physical property of the object at all, just where it happened to be when NASA last computed the orbit. It has no defensible causal or definitional relationship to hazard classification, and treating it as a stationary feature risks the model picking up incidental structure from *when* different objects were catalogued rather than anything about the objects themselves. Retained in the Original (Experiment A) feature set for parity with the legacy pipeline, but excluded from Experiment D (Orbital-only) as scientifically inappropriate for a "does the physics of the orbit predict the label" question. |
| `neo_id` | **E** | Identifier, dropped by `build_feature_matrix` already. |
| `name`, `designation` | **E** | Identifiers/labels, never fed to any model. |
| `closest_approach_date` | **E** | Timestamp, not used as a model input. |
| `is_sentry_object` | **E** | A different NASA/JPL flag (Sentry impact-monitoring list membership), not used as a model input in this pipeline; excluded to avoid substituting one NASA-derived hazard-adjacent label for another. |

## Consequence for the four experiments

See `src/features/feature_sets.py::FEATURE_SETS` for the exact column
lists this table produces.

- **Experiment A (Original):** unchanged — every feature in
  `src/features/engineering.py`, including Category A and B fields.
  Purpose: reproduce the near-perfect scores and show they are recovering
  NASA's own rule, not novel signal.
- **Experiment B (Leakage-Aware):** removes every Category A and B
  feature (`moid_au`, `absolute_magnitude_h`,
  `estimated_diameter_km_min`, `estimated_diameter_km_max`,
  `diameter_km_mean`). Keeps Category C and D features. This is the
  primary research experiment.
- **Experiment C (Physical/Kinematic-only):** the task's own instruction
  is to use physical characteristics like diameter "ONLY if available and
  scientifically defensible." Per this audit, diameter is **not**
  defensible for a leakage-aware experiment (Category B). What remains
  that is genuinely physical/kinematic rather than orbital-geometric is
  the close-approach kinematics: `closest_miss_distance_km`,
  `closest_relative_velocity_km_s`, `num_recorded_close_approaches`,
  `data_arc_in_days`, `observations_used` (plus their log transforms).
  Named "Physical/Kinematic-only" rather than "Physical-only" to be exact
  about what it actually contains, since diameter was excluded.
- **Experiment D (Orbital-only):** Category D orbital-shape/orientation
  features only (`eccentricity`, `semi_major_axis_au`, `inclination_deg`,
  `ascending_node_longitude_deg`, `orbital_period_days`,
  `perihelion_distance_au`, `aphelion_distance_au`,
  `mean_motion_deg_per_day`, `orbit_class_type`). Excludes `moid_au`
  (Category A) and `mean_anomaly_deg` (Category F, epoch-dependent).

## What this audit does not settle

This is a *definitional* audit (what does each field mean, and is it a
formula on the label), not an *empirical* one. Whether Category C
features (`closest_miss_distance_km`, `num_recorded_close_approaches`) are
in practice strongly correlated with the label is an open question that
the correlation matrix and permutation-importance outputs
(`results/experiments/leakage_aware/*/`, once a real run has executed —
see `docs/RESULTS.md`) are meant to answer with real numbers, not
assumptions made here.
