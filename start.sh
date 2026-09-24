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

# Legacy single-experiment pipeline (Experiment A / Original feature set
# only). Kept so model_registry/ stays populated for POST /api/predict,
# which still serves that model. See docs/FEATURE_AUDIT.md and
# src/experiments/run_all.py for why this is not the primary benchmark.
# Fast enough (~1-2 min for a 500-row dataset) to run before port binding.
python -m src.models.train || true
python -m src.models.evaluate || true
python -m src.anomaly.detect || true
python -m src.explainability.shap_analysis --model random_forest || true

# Primary research benchmark: all four leakage-audited experiments (A/B/C/D)
# x all four models (dummy baseline, LR, RF, XGB), with 5-fold CV, tuning,
# an untouched holdout test, curves, error analysis, and (for random_forest)
# SHAP. This is NOT run synchronously here: 16 experiment/model
# combinations with cross-validated hyperparameter search take far longer
# than Render's port-bind timeout (observed: still on combination 2/16
# after 3+ minutes, well past the ~3 minute port-scan window), so running
# it before `exec uvicorn` reliably kills the deploy before the API ever
# comes up. It runs in the background instead, after the port is already
# bound; backend/main.py's /api/experiments endpoints already report an
# honest "not yet executed" status until results/experiments/** exists,
# so this is a correct use of that existing design, not a workaround.
(
  python -m src.experiments.run_all \
    && python -m src.experiments.generate_report \
    && python -m src.experiments.integrity_checks
) &

exec uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}"
