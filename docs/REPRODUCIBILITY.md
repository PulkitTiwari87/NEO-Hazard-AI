# Reproducibility

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env: set NASA_API_KEY to a real key from https://api.nasa.gov
```

## Full pipeline, in order

```bash
python -m src.data.ingestion          # -> data/raw/neows_browse_<timestamp>.json (+ .metadata.json)
python -m src.data.validation         # -> data/processed/neo_dataset.csv, validation_report.json
python -m src.models.train            # -> model_registry/<model>/{model.joblib,metadata.json}, results/model_metrics.json, results/experiment_metadata.json
python -m src.models.evaluate         # -> re-derives the same split and regenerates results/model_metrics.json, as a check
python -m src.anomaly.detect          # -> results/anomaly_scores.csv, model_registry/isolation_forest/
python -m src.explainability.shap_analysis --model random_forest   # -> results/shap_global_importance.json, results/shap_local_examples.json
```

Each stage fails with a clear exception (never a fabricated fallback) if
its required input from the previous stage is missing — see the module
docstrings in `src/data/`, `src/models/`, `src/anomaly/`, and
`src/explainability/`.

## Backend

```bash
uvicorn backend.main:app --reload
```

Endpoints report `"status": "unavailable"` (or a 404/503, for endpoints
scoped to a single resource) for anything the pipeline hasn't produced yet
— they never substitute a placeholder number. See `backend/main.py`.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard calls the backend above; it shows explicit "Data
unavailable" / "Not yet evaluated" states for any endpoint that returns
`status: "unavailable"`.

## Tests

```bash
python -m pytest tests/ -v
```

Tests use small, explicitly-labeled synthetic fixtures
(`tests/fixtures/sample_neo_records.py`) to exercise parsing/validation/
feature-engineering logic in isolation — they are never used as, or
confused with, a real dataset. The API tests assert the "nothing ingested
yet" honest-failure behavior described above, since that is the actual
state of a fresh checkout.

## Determinism

`RANDOM_SEED` (default 42, in `.env`) is the single seed threaded through
the train/test split and every stochastic estimator
(`RandomForestClassifier`, `XGBClassifier`, `IsolationForest`). Given the
same raw NASA response, `python -m src.data.validation` through
`python -m src.models.evaluate` will reproduce identical metrics — that is
the mechanism `src/models/evaluate.py` uses to independently check
`src/models/train.py`'s reported numbers.

## Dataset/version tracking

Every processed run records:

- `data/processed/validation_report.json.source_raw_file` — exact raw file used
- `data/processed/validation_report.json.validated_at_utc` — when validation ran
- `model_registry/<model>/metadata.json.dataset_path` and `.dataset_row_count`
- `results/experiment_metadata.json` — full training run configuration

so any published metric can be traced back to the exact raw ingestion file
and pipeline run that produced it.
