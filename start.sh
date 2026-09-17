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
python -m src.models.train || true
python -m src.models.evaluate || true
python -m src.anomaly.detect || true
python -m src.explainability.shap_analysis --model random_forest || true

# Primary research benchmark: all four leakage-audited experiments (A/B/C/D)
# x all four models (dummy baseline, LR, RF, XGB), with 5-fold CV, tuning,
# an untouched holdout test, curves, error analysis, and (for random_forest)
# SHAP. Writes results/experiments/** and regenerates docs/RESULTS.md.
python -m src.experiments.run_all || true
python -m src.experiments.generate_report || true
python -m src.experiments.integrity_checks || true

exec uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}"
