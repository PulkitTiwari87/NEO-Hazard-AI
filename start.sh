#!/usr/bin/env bash
# Render start command. Runs the real data/ML pipeline once at boot (each
# step guarded so one failure doesn't block the API from starting — the
# API already reports honest "unavailable" states for any stage that
# didn't complete, per docs/LIMITATIONS.md), then serves the API.
#
# --max-pages caps ingestion so boot time and NASA API rate-limit usage
# stay bounded; raise it (or remove it) once a real NASA_API_KEY is set.
set -x

python -m src.data.ingestion --max-pages "${NEOWS_MAX_PAGES:-25}" || true
python -m src.data.validation || true
python -m src.models.train || true
python -m src.models.evaluate || true
python -m src.anomaly.detect || true
python -m src.explainability.shap_analysis --model random_forest || true

exec uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}"
