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
