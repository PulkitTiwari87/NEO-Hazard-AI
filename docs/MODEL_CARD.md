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

**Status: Experiment A trained on a real, executed ingestion run; the new
Experiments B-D benchmark has not yet executed in the environment this
revision was built in.** The Experiment A metrics below are copied
verbatim from an actual deployment's logs (Render service
`neo-hazard-ai-backend`, deploy `dep-dam1llbm8hqs73b97nc0`, 2026-09-17
16:55 UTC) — `python -m src.models.train` run by `start.sh` against a real
NASA NeoWs `neo/browse` response (`--max-pages 25`, i.e. a 500-object
sample of the live catalog, retrieved as
`neows_browse_20260917T165500Z.json`). This is a genuinely small sample
(25 of NeoWs's several-thousand browse pages), not the full NEO catalog —
treat every number below as describing that sample, not NASA's complete
dataset. The local dev checkout used to build this scaffold still has
empty `data/` directories (see `docs/DATA_SOURCE.md`), because this
sandboxed session's network egress to `api.nasa.gov` returns `403`
(confirmed via direct connectivity test against the org's egress proxy —
see `docs/DATA_SOURCE.md`); production runs happen on Render, which has
normal internet access, via the same `start.sh` this repo has always used.
`start.sh` now also runs `python -m src.experiments.run_all` on every
boot, so the next real production run will populate
`results/experiments/**` and `docs/RESULTS.md` with genuine Experiment B-D
numbers the same way Experiment A's numbers below were produced — this
model card was not padded with placeholder or estimated numbers to fill
that gap.

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
- **Predictive performance** (the open question): with those fields
  removed, does the model still find real structure in the remaining
  orbital/physical fields, or does performance collapse toward the
  `DummyClassifier` baseline? That is what Experiments B-D
  (`docs/RESULTS.md`) are designed to answer — with real numbers, not
  assumptions, once they have executed against real data.

## Primary research benchmark (Experiments B-D)

See `docs/RESULTS.md`, generated by `python -m src.experiments.generate_report`
from `results/experiments/**` (written by `python -m src.experiments.run_all`).
Each experiment/model combination there reports: 5-fold stratified
cross-validation (mean ± std, per-fold breakdown), an untouched holdout
test set never used for tuning or threshold selection, ROC/PR curves,
threshold sensitivity analysis, calibration (Brier score), permutation
and (for `random_forest`) SHAP feature importance, and a false
positive/false negative error breakdown. `docs/FEATURE_AUDIT.md` documents
exactly why each experiment's feature list looks the way it does.

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
