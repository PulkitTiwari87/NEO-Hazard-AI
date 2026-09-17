# NEO-Hazard-AI

A reproducible machine-learning pipeline over real NASA Near-Earth Object
(NEO) data: ingestion, validation, feature engineering, classification,
anomaly detection, and explainability — plus a FastAPI backend and a
minimal dashboard.

**This is a research/educational ML project, not an operational
planetary-defense tool.** It does not predict asteroid impacts and does
not replace NASA/JPL/CNEOS assessments. See [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md).

## Current status

**Full pipeline executed end-to-end against real NASA data.** This
sandboxed dev environment's own network egress to `api.nasa.gov` is
blocked by org policy (see [`docs/DATA_SOURCE.md`](docs/DATA_SOURCE.md)
for the connectivity tests establishing that), so the local `data/`
directories in this checkout are still empty. But the project is also
deployed to Render (`neo-hazard-ai-backend`), which has normal internet
access — its `start.sh` runs the real pipeline on every boot, and on
2026-09-17 it successfully ingested a 500-object sample of the live NeoWs
catalog (25 browse pages) using a real NASA API key, validated it, trained
all three models, ran anomaly detection, and generated SHAP explanations.
Real results from that run are in
[`docs/MODEL_CARD.md`](docs/MODEL_CARD.md) and the Results section below —
copied verbatim from the deploy logs, not estimated. It's a small sample
(500 objects, not NASA's full catalog), and re-running ingestion at a
larger `--max-pages` would produce a different, still-real dataset.

## Scientific motivation

NASA's NeoWs API publishes orbital elements, physical-size estimates, and
close-approach kinematics for every catalogued Near-Earth Object, along
with NASA/JPL's own `is_potentially_hazardous_asteroid` screening flag.

The first version of this project asked a narrow question — can a
statistical model recover that existing screening label from the object's
other NASA-provided features — and got a narrow answer back: yes, almost
perfectly (F1=1.000 for the tree models), because two of the "other"
features (`moid_au`, `absolute_magnitude_h`) are literally the two
quantities NASA's rule thresholds. See
[`docs/FEATURE_AUDIT.md`](docs/FEATURE_AUDIT.md) for the full audit this
prompted (including catching that the diameter feature is itself a
NASA-side derived transform of magnitude, not an independent field).

**The project's research question is now:** after removing every feature
that directly defines, or is a derived transform of, that label, how much
predictive signal is actually left in the object's other orbital and
physical characteristics? Four controlled experiments (Original,
Leakage-Aware, Physical/Kinematic-only, Orbital-only — see
[`docs/FEATURE_AUDIT.md`](docs/FEATURE_AUDIT.md)) answer this with 5-fold
cross-validation and a held-out test set; see
[`docs/RESULTS.md`](docs/RESULTS.md) for the generated results. This
project does not attempt to improve on, second-guess, or extend NASA/JPL's
own hazard determination.

## Data source

- **Primary:** NASA NeoWs (`https://api.nasa.gov/neo/rest/v1/neo/browse`)
- **Supplementary (not yet integrated):** JPL Small-Body Database Query API
- Full provenance, schema, units, and retrieval status:
  [`docs/DATA_SOURCE.md`](docs/DATA_SOURCE.md)

## Architecture

```
NASA NeoWs API
      |
      v
src/data/ingestion.py    -> data/raw/*.json (+ retrieval metadata)
      |
      v
src/data/validation.py   -> data/processed/neo_dataset.csv, validation_report.json
      |
      v
src/features/engineering.py  (feature matrix built on demand by each consumer)
src/features/feature_sets.py (Experiments A/B/C/D column lists + leakage checks;
                               see docs/FEATURE_AUDIT.md)
      |
      +---------------------------------------------------+
      v                            v                       v
src/models/train.py        src/anomaly/detect.py   src/experiments/run_all.py
(Experiment A / legacy)            |                (primary benchmark: 4 feature
      |                            |                 sets x 4 models, 5-fold CV,
      v                            v                 tuning, holdout, curves,
model_registry/, results/    results/anomaly_scores.csv  error analysis, SHAP)
      |                                                    |
      v                                                    v
src/explainability/shap_analysis.py -> results/shap_*.json  results/experiments/**
      |                                                    |
      |                                                    v
      |                                       src/experiments/generate_report.py
      |                                              -> docs/RESULTS.md
      v
backend/main.py (FastAPI)  <-----  frontend/ (React + Vite + Tailwind)
```

## Installation

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then set NASA_API_KEY
```

## Data ingestion

```bash
python -m src.data.ingestion
```

Fetches every page of NeoWs `neo/browse`, writes the raw JSON plus a
provenance sidecar (`retrieval_started_utc`, `source_url`, `pages_fetched`,
`records_fetched`, ...) to `data/raw/`. Fails loudly (never fabricates
data) if the API is unreachable or the key is invalid.

## Validation & preprocessing

```bash
python -m src.data.validation
```

Flattens each NEO into one row (see [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md)
for the row-grain and close-approach-selection rules), reports missing
required fields and null percentages, and drops (with an exact,
documented count) rows missing an id, missing the target label, or
duplicating an id already seen. Writes `data/processed/neo_dataset.csv`
and `data/processed/validation_report.json`.

## Feature engineering

See [`docs/FEATURES.md`](docs/FEATURES.md) for every feature's exact
formula, source field, unit, and rationale. Passthrough NASA fields,
one categorical encoding (`orbit_class_type`), and four documented
log/midpoint derived features — no feature was added purely because it
might help a metric.

## Model training & evaluation

### Experiment A (legacy, single feature set)

```bash
python -m src.models.train
python -m src.models.evaluate
```

Trains `LogisticRegression`, `RandomForestClassifier`, and `XGBClassifier`
inside leakage-safe `sklearn.Pipeline`s (preprocessing fit only on the
training fold), on a fixed-seed 80/20 stratified split, using every
feature including the two that directly define the target
(`moid_au`, `absolute_magnitude_h` — see
[`docs/FEATURE_AUDIT.md`](docs/FEATURE_AUDIT.md)). Metrics
(accuracy/precision/recall/F1/ROC-AUC/PR-AUC/confusion matrix) are computed
entirely via `sklearn.metrics` and written to `results/model_metrics.json`
— never hand-typed. Full methodology, including class-imbalance handling:
[`docs/METHODOLOGY.md`](docs/METHODOLOGY.md).

### Primary research benchmark (Experiments A-D)

```bash
python -m src.experiments.run_all
python -m src.experiments.generate_report   # writes docs/RESULTS.md
python -m src.experiments.integrity_checks  # verifies no leakage, reports status
```

Four controlled feature sets (`src/features/feature_sets.py`, reasoning in
[`docs/FEATURE_AUDIT.md`](docs/FEATURE_AUDIT.md)) x four models (dummy
baseline, logistic regression, random forest, XGBoost). For each
combination: `RandomizedSearchCV` hyperparameter tuning inside a 5-fold
`StratifiedKFold` on the training set only, per-fold and mean±std CV
metrics, an untouched holdout test set, ROC/PR curves, a threshold
sensitivity sweep (computed on out-of-fold CV predictions, never the test
set), calibration (Brier score), permutation importance, and (for
`random_forest`) SHAP. Every artifact is written under
`results/experiments/<experiment>/<model>/` as a fixed set of JSON/CSV
files (`cv_metrics.json`, `fold_metrics.json`, `test_metrics.json`,
`confusion_matrix.json`, `roc_curve.json`, `pr_curve.json`,
`threshold_analysis.json`, `calibration.json`, `error_analysis.json`,
`feature_importance.json`, `predictions.csv`, `metadata.json`). Results:
[`docs/RESULTS.md`](docs/RESULTS.md) (generated, not hand-typed — see
above).

## Anomaly detection

```bash
python -m src.anomaly.detect
```

Unsupervised `IsolationForest` over the engineered feature space, labeled
throughout as an **"ML anomaly score"** — explicitly not a hazard score.
See [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md).

## Explainability

```bash
python -m src.explainability.shap_analysis --model random_forest
```

SHAP `TreeExplainer` global feature importance and per-row local
explanations for a trained tree model.

## Backend API

```bash
uvicorn backend.main:app --reload
```

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | liveness check |
| `GET /api/data-source` | provenance + whether ingestion has run |
| `GET /api/statistics` | real dataset summary stats, or `"unavailable"` |
| `GET /api/neos` | paginated NEO listing |
| `GET /api/neo/{id}` | single NEO record |
| `GET /api/models` | registered model metadata |
| `GET /api/models/{model}/metrics` | that model's real metrics, or `"unavailable"` |
| `GET /api/features` | feature documentation (from `src/features/engineering.py`) |
| `GET /api/feature-audit` | Category A-F feature classification (from `src/features/feature_sets.py`, mirrors `docs/FEATURE_AUDIT.md`) |
| `GET /api/experiments` | status + summary metrics for every experiment x model combination |
| `GET /api/experiments/{experiment}/{model}` | full CV/holdout/curve/error-analysis bundle for one combination, or `"unavailable"` |
| `GET /api/reproducibility` | seed, fold count, feature sets, dataset provenance, reproduction commands |
| `POST /api/predict` | run a trained model on user-supplied features; `503` if untrained |
| `GET /api/limitations` | machine-readable scope statement |

No endpoint returns a hardcoded number; each reads real on-disk artifacts
and reports an explicit unavailable/404/503 state when they don't exist.

## Frontend

```bash
cd frontend && npm install && npm run dev
```

Research dashboard (Overview, Data Provenance, NEO Explorer, Feature
Audit, Experiments comparison + per-experiment detail with real ROC/PR
curves and confusion matrices, Experiment A [legacy], Reproducibility,
Limitations) that calls the backend above and renders its honest "Data
unavailable" / "Not yet executed" states rather than any hardcoded
figure — see `src/experiments/integrity_checks.py::check_frontend_has_no_hardcoded_metrics`
for the automated check backing that claim.

## Reproducibility

Full command sequence, seeding, and dataset-version tracking:
[`docs/REPRODUCIBILITY.md`](docs/REPRODUCIBILITY.md).

## Testing

```bash
python -m pytest tests/ -v
python -m src.experiments.integrity_checks  # leakage + artifact + hardcoded-metric scan
```

47 tests covering schema validation, cleaning/deduplication logic, feature
formulas (exact-value assertions), the backend's honest-failure behavior,
the four experiments' feature-leakage exclusions
(`tests/test_feature_sets.py`), and an end-to-end run of
`src/experiments/run_all.py` on a small synthetic dataset
(`tests/test_experiments.py`) — using small, explicitly-labeled synthetic
fixtures/data (`tests/fixtures/`, and the fixture in
`tests/test_experiments.py`) that are never treated as real data or a real
benchmark anywhere in the codebase or docs.

## Limitations

[`docs/LIMITATIONS.md`](docs/LIMITATIONS.md) — read this before drawing
any conclusion from this project, especially about what
"potentially hazardous" does and does not mean.

## Results

**Primary results:** [`docs/RESULTS.md`](docs/RESULTS.md), generated by
`python -m src.experiments.generate_report` from
`results/experiments/**` — never hand-typed, and explicit about which
experiment/model combinations have and haven't executed yet.

**Experiment A (legacy, historical)** — from the real run described in
"Current status" above (500-object NeoWs sample, 80/20 stratified split,
seed 42, 100-row test fold), copied verbatim from
`results/model_metrics.json` via the deploy log:

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC |
|---|---|---|---|---|---|---|
| logistic_regression | 0.960 | 0.871 | 1.000 | 0.931 | 0.9959 | 0.9883 |
| random_forest | 1.000 | 1.000 | 1.000 | 1.000 | 1.0000 | 1.0000 |
| xgboost | 1.000 | 1.000 | 1.000 | 1.000 | 1.0000 | ~1.0000 |

The tree models' near-perfect scores are expected, not impressive: NASA's
`is_potentially_hazardous_asteroid` flag is essentially a threshold rule
over `moid_au` and `absolute_magnitude_h`, both of which are direct model
inputs in this experiment, so a tree model can recover that rule almost
exactly. See [`docs/FEATURE_AUDIT.md`](docs/FEATURE_AUDIT.md) for the full
feature-by-feature leakage analysis this prompted, and
[`docs/RESULTS.md`](docs/RESULTS.md) for Experiments B-D, which remove
those features and ask how much signal is actually left. Anomaly
detection flagged 63/500 (12.6%) objects in this sample as statistical
outliers.

Re-running `python -m src.experiments.run_all` or `python -m src.models.train`
against a different or larger ingestion will produce different real
numbers — none of these are fixed benchmarks, they describe one specific
dataset snapshot each.
