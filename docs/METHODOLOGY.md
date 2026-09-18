# Methodology

**This file describes two methodologies.** "Legacy (Experiment A)" below
is the original single-feature-set pipeline (`src/models/train.py`),
kept for historical reproducibility. "Primary research benchmark" (its
own section further down) is the leakage-audited comparison across four
feature sets (`src/experiments/run_all.py`) — see `docs/FEATURE_AUDIT.md`
for why that exists and `docs/RESULTS.md` for its output.

## Legacy (Experiment A) methodology

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

## Primary research benchmark methodology

`src/experiments/run_all.py`. Row grain, close-approach selection, and
class-imbalance handling are identical to the legacy methodology above
(same underlying dataset, same object-level grain). Everything below is
what's different.

### Feature sets

Four, defined in `src/features/feature_sets.py` and reasoned about
feature-by-feature in `docs/FEATURE_AUDIT.md`: Original (unchanged),
Leakage-Aware (excludes `moid_au`, `absolute_magnitude_h`, and the
NASA-side-derived diameter fields), Physical/Kinematic-only, and
Orbital-only.

### Split structure

```
real data
   |
   +-- outer holdout test set (20%, stratified, fixed seed) -- UNTOUCHED
   |   until final evaluation: never used for tuning, feature selection,
   |   or threshold selection.
   |
   +-- training set (80%)
          |
          +-- 5-fold StratifiedKFold (shuffle=True, fixed seed)
                 |
                 +-- RandomizedSearchCV hyperparameter tuning (scoring="f1")
```

`src/experiments/splits.py::verify_object_level_grain` re-checks the
one-row-per-object precondition at run time before choosing a plain
`StratifiedKFold` over a grouped split — see that module's docstring.

After `RandomizedSearchCV` selects hyperparameters via its own internal
CV, the same 5-fold split is re-run once more with those fixed
hyperparameters (`src/experiments/run_all.py::_run_cv_folds`) purely to
report the full metric suite (accuracy/precision/recall/F1/ROC-AUC/PR-AUC)
per fold — `RandomizedSearchCV` itself only tracks the scoring metric
used for selection (F1), not the full suite, so this second pass is what
the fold-level tables in `docs/RESULTS.md` come from.

### Models

Same three as the legacy pipeline, plus `DummyClassifier(strategy="most_frequent")`
as an explicit baseline (`src/experiments/tuning.py::build_estimators`).

### Hyperparameter tuning

`RandomizedSearchCV`, `n_iter=12` (or the full grid size if smaller),
scored by F1 on the training-fold CV splits only — the outer holdout is
never passed into `src/experiments/tuning.py`. Search spaces
(`PARAM_DISTRIBUTIONS`) are small, standard ranges for each model family,
chosen before seeing any result and never widened to chase a score.

### Threshold analysis

`src/experiments/metrics.py::threshold_sweep` is evaluated only against
out-of-fold CV predictions (`oof_proba` in `run_all.py`), never the
holdout test set — the holdout is always scored at the model's default
0.5 threshold. This is a deliberate leakage boundary: selecting a
threshold based on holdout performance would make the holdout metric an
overly optimistic estimate of real-world performance.

### Error analysis, importance, and calibration

`src/experiments/error_analysis.py` builds a per-row TP/TN/FP/FN table
from the holdout test set only, plus per-outcome feature-distribution
summaries (means/medians/std — no causal claim beyond what the numbers
show). Permutation importance (`sklearn.inspection.permutation_importance`,
`n_repeats=20`) and model-specific importance/coefficients are computed
against the holdout set; SHAP (`TreeExplainer`) is generated for
`random_forest` only, per experiment, to keep runtime bounded — see
`src/experiments/run_all.py::RUN_SHAP_MODELS`. Calibration
(`sklearn.calibration.calibration_curve` + Brier score) is reported, not
acted on — no probability is auto-calibrated to improve a headline number.

### Statistical uncertainty

Cross-validation metrics are reported as mean ± std across folds
(`src/experiments/run_all.py::_aggregate_folds`). The holdout F1 also
carries a nonparametric bootstrap 95% confidence interval
(`src/experiments/metrics.py::bootstrap_metric_ci`, 1000 resamples of the
holdout (true, predicted) pairs).
