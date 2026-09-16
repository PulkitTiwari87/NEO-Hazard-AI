# Model Card

**Status: no model has been trained on real data yet.** This card is a
template populated with the fields that will be filled in from an actual
training run's `results/experiment_metadata.json` and
`model_registry/<name>/metadata.json`. Every metric field below is marked
`N/A` rather than filled with an estimate, per this project's integrity
rules — see `docs/DATA_SOURCE.md` for why (network access to NASA's API is
blocked in the environment this scaffold was built in).

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
- **Row count:** N/A — not yet ingested.
- **Target column:** `is_potentially_hazardous_asteroid`
- **Features:** see `docs/FEATURES.md`

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

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC |
|---|---|---|---|---|---|---|
| logistic_regression | N/A | N/A | N/A | N/A | N/A | N/A |
| random_forest | N/A | N/A | N/A | N/A | N/A | N/A |
| xgboost | N/A | N/A | N/A | N/A | N/A | N/A |

**Not executed.** These rows will be filled in verbatim from
`results/model_metrics.json` the first time `python -m src.models.train`
is run against a real ingested dataset — never hand-estimated.

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
