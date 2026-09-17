# Model Card

**Status: trained on a real, executed ingestion run.** The metrics below
are copied verbatim from an actual deployment's logs (Render service
`neo-hazard-ai-backend`, deploy `dep-dam1llbm8hqs73b97nc0`, 2026-09-17
16:55 UTC) — `python -m src.models.train` run by `start.sh` against a real
NASA NeoWs `neo/browse` response (`--max-pages 25`, i.e. a 500-object
sample of the live catalog, retrieved as
`neows_browse_20260917T165500Z.json`). This is a genuinely small sample
(25 of NeoWs's several-thousand browse pages), not the full NEO catalog —
treat every number below as describing that sample, not NASA's complete
dataset. The local dev checkout used to build this scaffold still has
empty `data/` directories (see `docs/DATA_SOURCE.md`); this run happened
on Render, which has normal internet access.

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

## Actual metrics

Copied verbatim from `results/model_metrics.json` as printed to the
deploy log (see status note above). Test fold: 100 rows (80/20 stratified
split of the 500-row dataset, seed 42).

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
python -m src.models.train
python -m src.models.evaluate
python -m src.explainability.shap_analysis
```

Random seed: 42 (`RANDOM_SEED` in `.env`). Dataset identifier: the raw file
path is recorded in `data/processed/validation_report.json.source_raw_file`
and in each model's `metadata.json.dataset_path`.
