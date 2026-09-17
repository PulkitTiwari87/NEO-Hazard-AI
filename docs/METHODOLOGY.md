# Methodology

## Task definition

Binary classification: given real orbital, physical, and close-approach
features for a Near-Earth Object from NASA's NeoWs API, predict NASA/JPL's
own `is_potentially_hazardous_asteroid` label.

This is explicitly **not** impact prediction. See `docs/LIMITATIONS.md`.

## Row grain and leakage prevention

The target is defined per NEO *object*, not per close-approach event, and
NeoWs returns a variable-length list of close approaches per object. Two
grain choices were considered:

1. One row per close-approach event (an object with 40 recorded approaches
   contributes 40 rows, all sharing one label).
2. One row per object (this project's choice).

Option 1 would let the same object's information leak between train and
test splits (if two of its approach-rows land on opposite sides of the
split, the model effectively "sees" that object during training via a
near-duplicate row) and would also let the model trivially learn "objects
with more rows in the training set are the popular/well-studied ones,"
which has nothing to do with hazard classification. Option 2 avoids both
problems directly: since `src/data/validation.py::clean` deduplicates by
`neo_id`, every row in the final dataset is guaranteed to be a distinct
object, so a standard stratified `train_test_split` (no object-level
grouping needed) does not leak.

For an object's close-approach-derived features, we use the **minimum
recorded miss-distance** across all its close approaches as "the closest
approach," with that approach's relative velocity as `closest_relative_velocity_km_s`.
This is a deliberate simplification: it is the closest approach *NASA has
recorded*, not necessarily the closest the object will ever make (many NEOs
have approaches computed decades or centuries into the future beyond what a
given `neo/browse` page returns, and some have long observation arcs with
many historical approaches). Anyone extending this pipeline should treat
`num_recorded_close_approaches` as a caveat signal alongside it.

## Train/validation/test split

Single stratified split, 80% train / 20% test, fixed `random_seed=42`
(see `src/config.py`, overridable via `.env`). No temporal split is used
because close-approach dates are not the unit of prediction here (the
object is), and no grouped split is needed for the reason above.
Preprocessing (median imputation for numeric features, most-frequent
imputation + one-hot encoding for the categorical feature, standard scaling)
is fit only on the training fold — it lives inside each model's
`sklearn.pipeline.Pipeline` alongside the estimator, so calling `.fit()`
only ever touches training data. See `src/models/train.py`.

## Class imbalance

Handling is adaptive, not assumed: `LogisticRegression(class_weight="balanced")`
and `RandomForestClassifier(class_weight="balanced")` compute weights from the
actual training-fold label frequencies at fit time; `XGBClassifier`'s
`scale_pos_weight` is computed the same way (`negative_count / positive_count`
in the training fold) rather than hardcoded. **The actual observed class
distribution is not yet known** — no real ingestion has run in this
environment (see `docs/DATA_SOURCE.md`) — so this section will be revisited
with real numbers, and the chosen strategy reconsidered if the imbalance
turns out to be extreme (e.g. requiring threshold tuning or resampling)
once real data is available.

## Models compared

- **Baseline:** `LogisticRegression` — interpretable, linear, coefficients
  are directly inspectable.
- **Tree-based:** `RandomForestClassifier`, `XGBClassifier` — non-linear,
  support the SHAP `TreeExplainer` path used in `src/explainability/shap_analysis.py`.

No hyperparameter search (GridSearchCV/Optuna) is implemented yet. Per the
project's YAGNI guidance, this is deferred until there's a real dataset to
tune against — tuning against nothing would just be motion, not signal.

## Evaluation

`src/models/evaluate.py::compute_classification_metrics` computes accuracy,
precision, recall, F1, confusion matrix, and (when the model supports
`predict_proba`) ROC-AUC and PR-AUC, entirely from `sklearn.metrics` — no
metric in this project is hand-computed or hand-typed. `src/models/train.py`
writes `results/model_metrics.json` and `results/experiment_metadata.json`
(dataset row count, split sizes, seed, feature list, timestamp) every time
it runs, so metrics are always traceable to the run that produced them.
`src/models/evaluate.py` independently re-derives the same test split from
the stored seed and re-evaluates already-trained models, as a
reproducibility check.

## Anomaly detection

Unsupervised `IsolationForest` over the same engineered feature space,
**not using the hazard label**. Produces a per-object anomaly score and a
boolean outlier flag. This measures how unusual an object's feature vector
is relative to the rest of the dataset under Isolation Forest's random
partitioning — see `docs/LIMITATIONS.md` for why this must never be read as
a hazard or risk signal.

## Explainability

SHAP `TreeExplainer` on the trained tree model (default: `random_forest`),
producing global mean-|SHAP| feature importance and per-row local
contribution examples (`src/explainability/shap_analysis.py`). SHAP values
describe the model's behavior, not a physical causal mechanism.

## Two-experiment research pipeline

`src/experiments/run_all.py` (`python -m src.experiments.run_all`) is the
project's main research entry point, run in addition to (not instead of)
`src/models/train.py`/`evaluate.py`. It runs every model against two
feature sets, defined once in `src/features/engineering.py::EXPERIMENTS`:

- **Experiment A — original feature set.** Every NASA-provided and derived
  feature, including `moid_au` and `absolute_magnitude_h`.
- **Experiment B — leakage-aware feature set.** Identical in every other
  respect, but excludes `moid_au` and `absolute_magnitude_h` — the two
  quantities NASA/JPL's own `is_potentially_hazardous_asteroid` rule is
  (per NASA's public documentation) approximately a threshold function of.
  Including them lets a model recover that known rule rather than
  demonstrate independent predictive signal from the object's other
  features; Experiment B tests for that signal directly. It is a narrower
  question than Experiment A, not automatically a "better" experiment —
  see `docs/LIMITATIONS.md`.

For each (experiment, model) pair, `run_experiment_model()`:

1. Takes one stratified 80/20 train/holdout split (fixed seed). The
   holdout fold is used exactly once, for the final reported metrics.
2. Runs `StratifiedKFold(5, shuffle=True)` cross-validation **within the
   training pool only** — a fresh pipeline (preprocessing included) is fit
   per fold, so no fold's statistics leak into another, and the holdout
   fold is never touched here. Reports real per-fold accuracy/precision/
   recall/F1/ROC-AUC/PR-AUC and confusion matrices, plus mean ± std.
3. Sweeps decision thresholds (0.05–0.95) against the **out-of-fold CV
   probabilities** collected in step 2 — never the holdout set — reporting
   precision/recall/F1 at each threshold. This keeps threshold exploration
   from contaminating the final test metric.
4. Fits a final pipeline on the whole training pool and evaluates it once
   on the untouched holdout fold.
5. Computes a calibration curve (`sklearn.calibration.calibration_curve`,
   quantile-binned, falling back to uniform bins if quantiles collapse) and
   Brier score from the holdout probabilities.
6. Extracts every false-positive/false-negative holdout record (full
   feature values, true/predicted label, predicted probability) plus the
   mean of each numeric feature within each of the four confusion-matrix
   categories (TP/TN/FP/FN), for comparing e.g. false positives against
   true negatives.

Results are written to `results/experiments/<experiment_id>/<model_name>/`
(`holdout.json`, `cv.json`, `threshold.json`, `calibration.json`,
`errors.json`) and summarized in `results/experiments/index.json`. Trained
pipelines are registered under `model_registry/<experiment_id>/<model_name>/`.
