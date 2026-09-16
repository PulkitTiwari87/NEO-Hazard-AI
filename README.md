# NEO-Hazard-AI

A reproducible machine-learning pipeline over real NASA Near-Earth Object
(NEO) data: ingestion, validation, feature engineering, classification,
anomaly detection, and explainability — plus a FastAPI backend and a
minimal dashboard.

**This is a research/educational ML project, not an operational
planetary-defense tool.** It does not predict asteroid impacts and does
not replace NASA/JPL/CNEOS assessments. See [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md).

## Current status

**Scaffold complete; no real data has been ingested yet.** The full
pipeline (ingestion → validation → feature engineering → training →
evaluation → anomaly detection → explainability → API → dashboard) is
implemented and unit-tested, but every stage that depends on real NASA
data has not been executed, because the environment this was built in has
its outbound network access to `api.nasa.gov` blocked by org policy (see
[`docs/DATA_SOURCE.md`](docs/DATA_SOURCE.md) for the exact connectivity
tests that established this). Rather than fabricate a dataset or
benchmark numbers to make the README look finished, this repository is
honest about that: every quantitative claim below is marked `N/A` or
"not yet executed," and the backend/dashboard surface that same honest
state through explicit "Data unavailable" responses instead of
placeholder numbers.

To finish this project for real: run `python -m src.data.ingestion` from
an environment with access to `api.nasa.gov` (a NASA API key from
https://api.nasa.gov is required — `DEMO_KEY` works but is rate-limited),
then the rest of the pipeline below.

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

Model evaluation results are generated by the reproducible training
pipeline (`python -m src.models.train`) and are not published here until
that pipeline has actually been executed against real ingested data — see
"Current status" above. Once it has, this section (and
[`docs/MODEL_CARD.md`](docs/MODEL_CARD.md)) will report the exact contents
of `results/model_metrics.json`, not an estimate.
