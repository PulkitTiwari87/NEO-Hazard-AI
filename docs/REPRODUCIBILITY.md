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

# Legacy single-experiment pipeline (Experiment A / Original feature set —
# see docs/FEATURE_AUDIT.md). Kept because model_registry/random_forest
# from this still backs POST /api/predict.
python -m src.models.train            # -> model_registry/<model>/{model.joblib,metadata.json}, results/model_metrics.json, results/experiment_metadata.json
python -m src.models.evaluate         # -> re-derives the same split and regenerates results/model_metrics.json, as a check
python -m src.anomaly.detect          # -> results/anomaly_scores.csv, model_registry/isolation_forest/
python -m src.explainability.shap_analysis --model random_forest   # -> results/shap_global_importance.json, results/shap_local_examples.json

# Primary research benchmark: 4 leakage-audited feature sets (A/B/C/D) x
# 4 models (dummy baseline, LR, RF, XGB), 5-fold CV + RandomizedSearchCV
# tuning on the training fold, an untouched holdout test set, ROC/PR
# curves, threshold sweep, calibration, permutation/SHAP importance, and
# error analysis. On a free-tier-class machine with the full 500-row
# dataset this can take significantly longer than the legacy pipeline
# (tens of minutes, not seconds) — see "Running this on Render" below for
# why it must not block a process manager's port-bind timeout.
python -m src.experiments.run_all           # -> results/experiments/<experiment>/<model>/*.json
python -m src.experiments.generate_report   # -> docs/RESULTS.md, generated from the above, never hand-typed
python -m src.experiments.integrity_checks  # -> verifies no leakage feature reached a non-original experiment, reports artifact status
```

Each stage fails with a clear exception (never a fabricated fallback) if
its required input from the previous stage is missing — see the module
docstrings in `src/data/`, `src/models/`, `src/anomaly/`,
`src/explainability/`, and `src/experiments/`.

## Running this on Render (or any port-bind-timeout host)

`start.sh` runs the legacy pipeline synchronously (fast enough on a
500-row dataset) but backgrounds `src.experiments.run_all` after `exec
uvicorn` has already bound the port. This is not optional: a first
version of `start.sh` ran the full benchmark before binding the port and
reliably hit Render's port-scan timeout, killing the deploy before the
API ever came up (observed directly — still on combination 2 of 16 when
the timeout fired). `/api/experiments` and `/api/experiments/{experiment}/{model}`
report an honest `"executed": false` / `"status": "unavailable"` until the
background job finishes and writes `results/experiments/**` — this is the
same "never fabricate, report unavailable" contract every other endpoint
in `backend/main.py` already follows, not a special case.

If you pulled real numbers from a live deployment's disk back into a
local/git checkout (rather than running the pipeline locally), use:

```bash
python -m src.experiments.fetch_live_results --base-url https://<your-deployment-host>
python -m src.experiments.generate_report
```

This reconstructs `results/experiments/**` from the same
`experiment_model_detail` API responses the frontend itself renders (see
`src/experiments/fetch_live_results.py` for exactly which fields it can
and cannot recover — the live deployment's on-disk `predictions.csv` and
un-truncated error tables are not exposed over the API and are not
reconstructed by this path).

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
- `results/experiment_metadata.json` — full training run configuration (Experiment A / legacy)
- `results/experiments/<experiment>/<model>/metadata.json` — per-combination
  feature columns, random seed, CV fold count, best hyperparameters, the
  full hyperparameter search history, dataset provenance, and software
  versions (Python/scikit-learn/XGBoost), for the primary benchmark
- `results/experiments/summary.json` — one run's dataset row count, seed,
  and timestamp, alongside every experiment/model's headline metrics

so any published metric can be traced back to the exact raw ingestion file
and pipeline run that produced it.
