# Model Card

**This project now runs four separate experiments, not one — see
`docs/FEATURE_AUDIT.md`.** Everything below "Actual metrics (Experiment A)"
describes the original, single-feature-set model, kept for historical
reproducibility. It is **not** the project's primary result any more. The
primary research benchmark is the leakage-audited comparison across
Experiments A-D (`python -m src.experiments.run_all`,
`src/experiments/run_all.py`) — see `docs/RESULTS.md` for its output (that
file is generated from `results/experiments/**`, never hand-typed, and
says explicitly if the benchmark hasn't been run yet).

**Status: both Experiment A and the primary Experiments B-D benchmark
have now executed against real data.** The Experiment A metrics below are
copied verbatim from an actual deployment's logs (Render service
`neo-hazard-ai-backend`, deploy `dep-dam1llbm8hqs73b97nc0`, 2026-09-17
16:55 UTC) — `python -m src.models.train` run by `start.sh` against a real
NASA NeoWs `neo/browse` response (`--max-pages 25`, i.e. a 500-object
sample of the live catalog). The Experiments B-D benchmark ran later, on
the same 500-object-sample pipeline (deploy `dep-dam8sup7lnhs73ce221g`,
completed 2026-09-18 01:42 UTC) — see `docs/RESULTS.md` for the full
comparison table and scientific interpretation. Both are genuinely small
samples (25 of NeoWs's several-thousand browse pages), not the full NEO
catalog — treat every number below as describing that sample, not NASA's
complete dataset. The local dev checkout used to build this scaffold
still has empty `data/` directories (see `docs/DATA_SOURCE.md`), because
this sandboxed session's network egress to `api.nasa.gov` (and, it turns
out, to the deployed Render URL itself) returns `403` — confirmed via
direct connectivity tests against the org's egress proxy. Real numbers
were instead read from the Render deploy's own logs, the same
verbatim-copy method this project has used since Experiment A's first run.

## Model details

- **Models:** `logistic_regression`, `random_forest`, `xgboost` (see
  `src/models/train.py::build_model_specs`)
- **Model version:** N/A — populated from `model_registry/<name>/metadata.json.model_version` after training.
- **Framework:** scikit-learn (`LogisticRegression`, `RandomForestClassifier`), XGBoost (`XGBClassifier`)

## Intended use

- Research/educational exploration of statistical patterns in NASA NeoWs
  orbital and physical features associated with the `is_potentially_hazardous_asteroid`
  label NASA/JPL already assigns.
- Demonstrating a reproducible ML pipeline (ingestion → validation →
  features → training → evaluation → explainability) over real public
  space-science data.

## Explicitly NOT intended for

- Predicting asteroid impacts.
- Operational planetary-defense decision-making of any kind.
- Replacing NASA/JPL/CNEOS orbital-dynamics assessments.
- Producing a "risk probability" presented to non-technical audiences
  without the caveats in `docs/LIMITATIONS.md`.

## Training data

- **Source:** NASA NeoWs API (`docs/DATA_SOURCE.md`)
- **Row count:** 500 (after validation/cleaning — 0 rows dropped in this run)
- **Target column:** `is_potentially_hazardous_asteroid`
- **Features:** see `docs/FEATURES.md`
- **Class balance:** 100-row stratified test fold contained 27 potentially-hazardous
  objects (27%); since the split is an exact 80/20 stratified split of 500 rows,
  this implies 135/500 (27.0%) hazardous overall. (Derived from the test-fold
  confusion matrices below plus the known split ratio — not read directly off
  a dataset-wide count.)

## Preprocessing

Median imputation + standard scaling (numeric features), most-frequent
imputation + one-hot encoding (`orbit_class_type`), fit only on the
training fold inside each model's `sklearn.Pipeline`. See
`docs/METHODOLOGY.md`.

## Evaluation methodology

Stratified 80/20 train/test split, fixed seed 42. Metrics: accuracy,
precision, recall, F1, confusion matrix, ROC-AUC, PR-AUC — all computed by
`src/models/evaluate.py` via `sklearn.metrics`, never hand-typed.

## Actual metrics (Experiment A — Original / Label-Defining Feature Experiment)

Copied verbatim from `results/model_metrics.json` as printed to the
deploy log (see status note above). Test fold: 100 rows (80/20 stratified
split of the 500-row dataset, seed 42). **This experiment intentionally
includes the label-defining features** (`moid_au`, `absolute_magnitude_h`)
— see the box below and `docs/FEATURE_AUDIT.md` for why, and see
`docs/RESULTS.md` for the leakage-audited Experiments B-D that remove
them.

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC | Confusion matrix (rows=true, cols=pred; [not_hazardous, hazardous]) |
|---|---|---|---|---|---|---|---|
| logistic_regression | 0.960 | 0.871 | 1.000 | 0.931 | 0.9959 | 0.9883 | [[69, 4], [0, 27]] |
| random_forest | 1.000 | 1.000 | 1.000 | 1.000 | 1.0000 | 1.0000 | [[73, 0], [0, 27]] |
| xgboost | 1.000 | 1.000 | 1.000 | 1.000 | 1.0000 | 0.9999999999999999 | [[73, 0], [0, 27]] |

**Read this before drawing conclusions from the near-perfect tree-model
scores:** `moid_au` and `absolute_magnitude_h` are both direct model
inputs, and NASA/JPL's own `is_potentially_hazardous_asteroid` flag is
(per NASA's public definition) essentially a threshold rule over exactly
those two quantities. A tree model with access to both features can learn
that threshold almost exactly — this is the model recovering NASA's
already-known screening rule from its own inputs, not evidence of a novel
predictive signal. See `docs/LIMITATIONS.md`. The logistic regression
baseline scores lower because a single global linear boundary can't
represent that rule as exactly as a tree can.

Only 1 model (`random_forest`) has SHAP explainability outputs generated
so far (`results/shap_global_importance.json`,
`results/shap_local_examples.json`), on this same 500-row sample.
Anomaly detection (`results/anomaly_scores.csv`) flagged 63/500 (12.6%)
objects in this sample as statistical outliers in feature space — again,
not a hazard signal, see `docs/LIMITATIONS.md`.

## Predictive performance vs. target reconstruction vs. leakage

These are three different claims, and Experiment A only supports the
middle one:

- **Target reconstruction** (what Experiment A actually measures): can a
  model, given the same fields NASA's rule is a function of, recover that
  rule? Yes, almost exactly (RF/XGB F1=1.000). This is expected of any
  reasonably flexible classifier and is not a claim about the object's
  physical world.
- **Leakage analysis**: `docs/FEATURE_AUDIT.md` documents exactly which
  fields cause that (`moid_au`, `absolute_magnitude_h`, and the
  NASA-side-derived diameter fields) and which fields do not.
- **Predictive performance** (the question this benchmark answers): with
  those fields removed, does the model still find real structure in the
  remaining orbital/physical fields, or does performance collapse toward
  the `DummyClassifier` baseline? **Answer, from real data: it finds real
  structure, but substantially less than with the label-defining features
  included.**

## Primary research benchmark (Experiments B-D) — actual results

Full comparison table, per-fold detail, and scientific interpretation:
`docs/RESULTS.md`. Headline numbers (test-set F1, 500-object sample, seed
42, 2026-09-18 run):

| Experiment | Best model | Test F1 | vs. Experiment A (best: xgboost, F1=1.000) |
|---|---|---|---|
| A — Original (label-defining features included) | `xgboost` | 1.000 | — |
| B — Leakage-Aware (primary result) | `xgboost` | 0.745 | **−0.255** |
| C — Physical/Kinematic-only | `random_forest` | 0.719 | −0.281 |
| D — Orbital-only | `xgboost` | 0.711 | −0.289 |

Every leakage-aware model (B/C/D) scored far above the `DummyClassifier`
baseline (F1 = 0.000, ROC-AUC = 0.500) on the same holdout fold — e.g.
Experiment B `random_forest` reached ROC-AUC 0.938. So the removed
features (`moid_au`, `absolute_magnitude_h`, derived diameter) account
for a real, substantial chunk of the Original experiment's near-perfect
score, but not all of it: orbital and physical/kinematic characteristics
on their own carry detectable, held-out-verified signal about the
NASA/JPL classification. See `docs/RESULTS.md` → "Interpretation" for the
full discussion, including why this is evidence of correlation (e.g.
Earth-crossing orbit geometry plausibly producing both low MOID and
distinctive eccentricity/inclination), not a causal or novel-hazard
claim. Each experiment/model combination's full artifacts (5-fold CV
per-fold breakdown, ROC/PR curves, threshold sweep, calibration, feature
importance, SHAP for `random_forest`, error tables) were generated by
`python -m src.experiments.run_all` and are available live via the
deployed frontend's Experiments pages, or by running
`python -m src.experiments.fetch_live_results` against that deployment.

## Limitations and known risks

See `docs/LIMITATIONS.md` in full. Summary: dataset completeness and any
class imbalance in the real data are unknown until ingestion runs; model
performance on this dataset says nothing about real-world planetary-defense
performance; `is_potentially_hazardous_asteroid` is itself a rule-based
NASA/JPL classification (MOID and absolute-magnitude thresholds), not a
ground-truth outcome label, so this task is "recover an existing
rule-based label from other correlated features," not "discover novel
hazard signal."

## Reproducibility

```bash
pip install -r requirements.txt
python -m src.data.ingestion
python -m src.data.validation

# Experiment A only (legacy, reproduces the table above):
python -m src.models.train
python -m src.models.evaluate
python -m src.explainability.shap_analysis

# Primary benchmark (Experiments A-D, CV + holdout + curves + error analysis):
python -m src.experiments.run_all
python -m src.experiments.generate_report   # writes docs/RESULTS.md
python -m src.experiments.integrity_checks  # verifies no leakage, reports artifact status
```

Random seed: 42 (`RANDOM_SEED` in `.env`). Dataset identifier: the raw file
path is recorded in `data/processed/validation_report.json.source_raw_file`
and in each model's `metadata.json.dataset_path`.
