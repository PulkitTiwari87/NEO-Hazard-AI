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
This project asks a narrow, answerable question: **how well can a
statistical model recover that existing screening label from the object's
other NASA-provided orbital/physical features** — and, separately, which
objects look statistically unusual in that same feature space. It does
not attempt to improve on, second-guess, or extend NASA/JPL's own hazard
determination.

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
      |
      +----------------------------+
      v                            v
src/models/train.py        src/anomaly/detect.py
      |                            |
      v                            v
model_registry/, results/    results/anomaly_scores.csv
      |
      v
src/explainability/shap_analysis.py -> results/shap_*.json
      |
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

```bash
python -m src.models.train
python -m src.models.evaluate
```

Trains `LogisticRegression`, `RandomForestClassifier`, and `XGBClassifier`
inside leakage-safe `sklearn.Pipeline`s (preprocessing fit only on the
training fold), on a fixed-seed 80/20 stratified split. Metrics
(accuracy/precision/recall/F1/ROC-AUC/PR-AUC/confusion matrix) are computed
entirely via `sklearn.metrics` and written to `results/model_metrics.json`
— never hand-typed. Full methodology, including class-imbalance handling:
[`docs/METHODOLOGY.md`](docs/METHODOLOGY.md).

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
| `POST /api/predict` | run a trained model on user-supplied features; `503` if untrained |
| `GET /api/limitations` | machine-readable scope statement |

No endpoint returns a hardcoded number; each reads real on-disk artifacts
and reports an explicit unavailable/404/503 state when they don't exist.

## Frontend

```bash
cd frontend && npm install && npm run dev
```

Minimal dashboard (Overview, Data Provenance, NEO Explorer, Model
Performance, Limitations) that calls the backend above and renders its
honest "Data unavailable" / "Not yet evaluated" states rather than any
hardcoded figure.

## Reproducibility

Full command sequence, seeding, and dataset-version tracking:
[`docs/REPRODUCIBILITY.md`](docs/REPRODUCIBILITY.md).

## Testing

```bash
python -m pytest tests/ -v
```

17 tests covering schema validation, cleaning/deduplication logic, feature
formulas (exact-value assertions), and the backend's honest-failure
behavior — using small, explicitly-labeled synthetic fixtures
(`tests/fixtures/`) that are never treated as real data anywhere in the
codebase or docs.

## Limitations

[`docs/LIMITATIONS.md`](docs/LIMITATIONS.md) — read this before drawing
any conclusion from this project, especially about what
"potentially hazardous" does and does not mean.

## Results

From the real run described in "Current status" above (500-object NeoWs
sample, 80/20 stratified split, seed 42, 100-row test fold) — copied
verbatim from `results/model_metrics.json` via the deploy log:

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC |
|---|---|---|---|---|---|---|
| logistic_regression | 0.960 | 0.871 | 1.000 | 0.931 | 0.9959 | 0.9883 |
| random_forest | 1.000 | 1.000 | 1.000 | 1.000 | 1.0000 | 1.0000 |
| xgboost | 1.000 | 1.000 | 1.000 | 1.000 | 1.0000 | ~1.0000 |

The tree models' near-perfect scores are expected, not impressive: NASA's
`is_potentially_hazardous_asteroid` flag is essentially a threshold rule
over `moid_au` and `absolute_magnitude_h`, both of which are direct model
inputs, so a tree model can recover that rule almost exactly. See
[`docs/MODEL_CARD.md`](docs/MODEL_CARD.md) for the full breakdown
(confusion matrices, class balance) and
[`docs/LIMITATIONS.md`](docs/LIMITATIONS.md) for why this is "recovering
a known rule," not "discovering hazard signal." Anomaly detection flagged
63/500 (12.6%) objects in this sample as statistical outliers.

Re-running `python -m src.models.train` against a different or larger
ingestion will produce different real numbers — these are not fixed
benchmarks, they describe one specific dataset snapshot.
