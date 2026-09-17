"""FastAPI backend for NEO-Hazard-AI.

Run with:
    uvicorn backend.main:app --reload

Every endpoint reads from real on-disk artifacts (the processed dataset,
the model registry, results/*.json). None of them return hardcoded
statistics. When an artifact does not exist yet (data not ingested, model
not trained, metrics not generated), the endpoint returns an explicit
"unavailable" status rather than a fabricated value — see docs/LIMITATIONS.md.
"""
from __future__ import annotations

import json
from typing import Any, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.config import MODEL_METRICS_PATH, PROCESSED_DATASET_PATH, VALIDATION_REPORT_PATH, settings

SHAP_IMPORTANCE_PATH = settings.results_path / "shap_global_importance.json"
from src.features.engineering import (
    ALL_NUMERIC_FEATURES,
    CATEGORICAL_FEATURES,
    FEATURE_DEFINITIONS,
    PASSTHROUGH_NUMERIC_FEATURES,
    TARGET_COLUMN,
    build_feature_matrix,
)
from src.features.feature_sets import (
    EPOCH_DEPENDENT_FEATURES,
    FEATURE_SETS,
    LABEL_DEFINING_NUMERIC_FEATURES,
    LABEL_DERIVED_NUMERIC_FEATURES,
)
from src.experiments.tuning import build_estimators
from src.models.registry import list_registered_models, load_metadata, load_model

app = FastAPI(
    title="NEO-Hazard-AI API",
    description=(
        "Research/educational ML system for exploring patterns in NASA NeoWs "
        "Near-Earth Object data. This system does NOT predict asteroid "
        "impacts and does NOT replace NASA/JPL/CNEOS assessments — see "
        "/api/limitations."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _load_processed_dataset() -> Optional[pd.DataFrame]:
    if not PROCESSED_DATASET_PATH.exists():
        return None
    return pd.read_csv(PROCESSED_DATASET_PATH)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/limitations")
def limitations() -> dict[str, Any]:
    return {
        "is_operational_hazard_system": False,
        "predicts_impacts": False,
        "replaces_nasa_jpl_assessment": False,
        "summary": (
            "This system trains statistical models on the "
            "'potentially hazardous' classification NASA/JPL already assigns "
            "in the NeoWs dataset. It learns patterns associated with that "
            "label; it does not independently assess impact risk. "
            "See docs/LIMITATIONS.md in the repository for the full statement."
        ),
    }


@app.get("/api/data-source")
def data_source() -> dict[str, Any]:
    raw_files = sorted(settings.raw_dir.glob("neows_browse_*.json")) if settings.raw_dir.exists() else []
    raw_files = [p for p in raw_files if not p.name.endswith(".metadata.json")]
    return {
        "source_name": "NASA NeoWs (Near Earth Object Web Service)",
        "source_url": settings.nasa_neows_base_url,
        "documentation_url": "https://api.nasa.gov",
        "ingestion_has_run": len(raw_files) > 0,
        "raw_files_present": [p.name for p in raw_files],
        "note": (
            "See docs/DATA_SOURCE.md for full provenance, schema, and "
            "retrieval-method documentation."
        ),
    }


@app.get("/api/statistics")
def statistics() -> dict[str, Any]:
    df = _load_processed_dataset()
    if df is None:
        return {
            "status": "unavailable",
            "detail": (
                "Dataset has not been ingested/validated yet. Run "
                "`python -m src.data.ingestion` then `python -m src.data.validation`."
            ),
        }
    hazardous_count = int(df[TARGET_COLUMN].sum())
    return {
        "status": "ok",
        "row_count": int(len(df)),
        "hazardous_count": hazardous_count,
        "non_hazardous_count": int(len(df) - hazardous_count),
        "null_percentage_by_column": (df.isna().mean() * 100).round(2).to_dict(),
    }


@app.get("/api/neos")
def list_neos(limit: int = 25, offset: int = 0, hazardous_only: bool = False) -> dict[str, Any]:
    df = _load_processed_dataset()
    if df is None:
        return {"status": "unavailable", "detail": "Dataset has not been ingested yet.", "results": []}
    if hazardous_only:
        df = df[df[TARGET_COLUMN] == True]  # noqa: E712
    page = df.iloc[offset : offset + limit]
    return {
        "status": "ok",
        "total_count": int(len(df)),
        "limit": limit,
        "offset": offset,
        "results": page.to_dict(orient="records"),
    }


@app.get("/api/neo/{neo_id}")
def get_neo(neo_id: str) -> dict[str, Any]:
    df = _load_processed_dataset()
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset has not been ingested yet.")
    match = df[df["neo_id"].astype(str) == str(neo_id)]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"No NEO found with id '{neo_id}'.")
    return match.iloc[0].to_dict()


@app.get("/api/models")
def list_models() -> dict[str, Any]:
    names = list_registered_models()
    models = []
    for name in names:
        try:
            models.append(load_metadata(name))
        except FileNotFoundError:
            continue
    return {"status": "ok" if models else "unavailable", "models": models}


@app.get("/api/models/{model_name}/metrics")
def model_metrics(model_name: str) -> dict[str, Any]:
    if not MODEL_METRICS_PATH.exists():
        return {"status": "unavailable", "detail": "Metrics have not been generated. Run `python -m src.models.train`."}
    all_metrics = json.loads(MODEL_METRICS_PATH.read_text())
    if model_name not in all_metrics:
        raise HTTPException(status_code=404, detail=f"No metrics found for model '{model_name}'.")
    return {"status": "ok", "model": model_name, "metrics": all_metrics[model_name]}


@app.get("/api/models/{model_name}/explainability")
def model_explainability(model_name: str) -> dict[str, Any]:
    if not SHAP_IMPORTANCE_PATH.exists():
        return {
            "status": "unavailable",
            "detail": (
                "SHAP explainability has not been generated. Run "
                "`python -m src.explainability.shap_analysis --model <name>`."
            ),
        }
    payload = json.loads(SHAP_IMPORTANCE_PATH.read_text())
    if payload.get("model") != model_name:
        return {
            "status": "unavailable",
            "detail": (
                f"SHAP explainability was generated for model "
                f"'{payload.get('model')}', not '{model_name}'."
            ),
        }
    def _strip_prefix(name: str) -> str:
        return name.split("__", 1)[1] if "__" in name else name

    importance = [
        {"feature": _strip_prefix(name), "mean_abs_shap": value}
        for name, value in sorted(
            payload["mean_abs_shap_by_feature"].items(), key=lambda pair: pair[1], reverse=True
        )
    ]
    return {"status": "ok", "model": model_name, "global_importance": importance}


@app.get("/api/features")
def features() -> dict[str, Any]:
    return {
        "target_column": TARGET_COLUMN,
        "nasa_provided_features": PASSTHROUGH_NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "derived_features": FEATURE_DEFINITIONS,
    }


EXPERIMENT_MODEL_NAMES = list(build_estimators(0))


def _experiment_model_dir(experiment: str, model_name: str):
    return settings.results_path / "experiments" / experiment / model_name


def _read_experiment_json(experiment: str, model_name: str, filename: str) -> Any:
    path = _experiment_model_dir(experiment, model_name) / filename
    if not path.exists():
        return None
    return json.loads(path.read_text())


@app.get("/api/feature-audit")
def feature_audit() -> dict[str, Any]:
    """See docs/FEATURE_AUDIT.md for the full reasoning behind this
    classification. This endpoint and that document share the same
    source of truth: src/features/feature_sets.py.
    """
    return {
        "label_defining_features": LABEL_DEFINING_NUMERIC_FEATURES,
        "label_derived_features": LABEL_DERIVED_NUMERIC_FEATURES,
        "epoch_dependent_excluded_features": EPOCH_DEPENDENT_FEATURES,
        "documentation": "docs/FEATURE_AUDIT.md",
        "feature_sets": {
            key: {
                "display_name": fs.display_name,
                "purpose": fs.purpose,
                "numeric_features": fs.numeric_features,
                "categorical_features": fs.categorical_features,
            }
            for key, fs in FEATURE_SETS.items()
        },
    }


@app.get("/api/experiments")
def list_experiments() -> dict[str, Any]:
    """Status of every experiment x model combination. `executed: false`
    means the research benchmark (`python -m src.experiments.run_all`) has
    not produced artifacts for that combination yet — this endpoint never
    fabricates a value in that case, per docs/LIMITATIONS.md and section
    40 of the research brief ("the frontend must never become the source
    of truth").
    """
    experiments: dict[str, Any] = {}
    for key, fs in FEATURE_SETS.items():
        models: dict[str, Any] = {}
        for model_name in EXPERIMENT_MODEL_NAMES:
            metadata = _read_experiment_json(key, model_name, "metadata.json")
            if metadata is None:
                models[model_name] = {"executed": False}
                continue
            cv_metrics = _read_experiment_json(key, model_name, "cv_metrics.json") or {}
            test_metrics = _read_experiment_json(key, model_name, "test_metrics.json") or {}
            models[model_name] = {
                "executed": True,
                "trained_at_utc": metadata.get("trained_at_utc"),
                "cv_f1_mean": (cv_metrics.get("f1") or {}).get("mean"),
                "cv_f1_std": (cv_metrics.get("f1") or {}).get("std"),
                "test_f1": test_metrics.get("f1"),
                "test_precision": test_metrics.get("precision"),
                "test_recall": test_metrics.get("recall"),
                "test_accuracy": test_metrics.get("accuracy"),
                "test_roc_auc": test_metrics.get("roc_auc"),
                "test_pr_auc": test_metrics.get("pr_auc"),
            }
        experiments[key] = {
            "display_name": fs.display_name,
            "purpose": fs.purpose,
            "feature_columns": fs.feature_columns,
            "models": models,
        }
    any_executed = any(
        m["executed"] for exp in experiments.values() for m in exp["models"].values()
    )
    return {"status": "ok" if any_executed else "unavailable", "experiments": experiments}


@app.get("/api/experiments/{experiment}/{model_name}")
def experiment_model_detail(experiment: str, model_name: str) -> dict[str, Any]:
    if experiment not in FEATURE_SETS:
        raise HTTPException(status_code=404, detail=f"Unknown experiment '{experiment}'.")
    if model_name not in EXPERIMENT_MODEL_NAMES:
        raise HTTPException(status_code=404, detail=f"Unknown model '{model_name}'.")

    metadata = _read_experiment_json(experiment, model_name, "metadata.json")
    if metadata is None:
        return {
            "status": "unavailable",
            "detail": (
                f"Experiment '{experiment}' / model '{model_name}' has not been executed "
                "yet. Run `python -m src.experiments.run_all`."
            ),
        }

    error_analysis = _read_experiment_json(experiment, model_name, "error_analysis.json") or {}
    return {
        "status": "ok",
        "metadata": metadata,
        "cv_metrics": _read_experiment_json(experiment, model_name, "cv_metrics.json"),
        "fold_metrics": _read_experiment_json(experiment, model_name, "fold_metrics.json"),
        "test_metrics": _read_experiment_json(experiment, model_name, "test_metrics.json"),
        "confusion_matrix": _read_experiment_json(experiment, model_name, "confusion_matrix.json"),
        "roc_curve": _read_experiment_json(experiment, model_name, "roc_curve.json"),
        "pr_curve": _read_experiment_json(experiment, model_name, "pr_curve.json"),
        "threshold_analysis": _read_experiment_json(experiment, model_name, "threshold_analysis.json"),
        "calibration": _read_experiment_json(experiment, model_name, "calibration.json"),
        "feature_importance": _read_experiment_json(experiment, model_name, "feature_importance.json"),
        "shap_summary": _read_experiment_json(experiment, model_name, "shap_summary.json"),
        "error_summary": error_analysis.get("feature_range_summary"),
        # Capped so a single response never ships thousands of rows —
        # full predictions.csv is still on disk for anyone who wants it.
        "false_positives_sample": (error_analysis.get("false_positives") or [])[:25],
        "false_negatives_sample": (error_analysis.get("false_negatives") or [])[:25],
    }


@app.get("/api/reproducibility")
def reproducibility() -> dict[str, Any]:
    validation_report = None
    if VALIDATION_REPORT_PATH.exists():
        validation_report = json.loads(VALIDATION_REPORT_PATH.read_text())

    summary_path = settings.results_path / "experiments" / "summary.json"
    summary = json.loads(summary_path.read_text()) if summary_path.exists() else None

    return {
        "random_seed": settings.random_seed,
        "n_cv_folds": 5,
        "outer_test_size": 0.2,
        "feature_sets": list(FEATURE_SETS),
        "models": EXPERIMENT_MODEL_NAMES,
        "dataset_provenance": validation_report,
        "last_benchmark_run": summary,
        "reproduce_with": [
            "python -m src.data.ingestion",
            "python -m src.data.validation",
            "python -m src.experiments.run_all",
            "python -m src.experiments.generate_report",
        ],
    }


class PredictionRequest(BaseModel):
    model_config = {"extra": "forbid"}

    model_name: str = "random_forest"
    # NASA-provided / passthrough numeric fields (see /api/features).
    absolute_magnitude_h: Optional[float] = None
    eccentricity: Optional[float] = None
    semi_major_axis_au: Optional[float] = None
    inclination_deg: Optional[float] = None
    ascending_node_longitude_deg: Optional[float] = None
    orbital_period_days: Optional[float] = None
    perihelion_distance_au: Optional[float] = None
    aphelion_distance_au: Optional[float] = None
    mean_anomaly_deg: Optional[float] = None
    mean_motion_deg_per_day: Optional[float] = None
    moid_au: Optional[float] = None
    data_arc_in_days: Optional[float] = None
    observations_used: Optional[float] = None
    num_recorded_close_approaches: Optional[float] = None
    closest_miss_distance_km: Optional[float] = None
    closest_relative_velocity_km_s: Optional[float] = None
    estimated_diameter_km_min: Optional[float] = None
    estimated_diameter_km_max: Optional[float] = None
    orbit_class_type: Optional[str] = None


@app.post("/api/predict")
def predict(request: PredictionRequest) -> dict[str, Any]:
    try:
        pipeline = load_model(request.model_name)
        metadata = load_metadata(request.model_name)
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Model '{request.model_name}' has not been trained yet. "
                "Run `python -m src.models.train` first."
            ),
        )

    payload = request.model_dump(exclude={"model_name"})
    row = pd.DataFrame([payload])
    row, _ = build_feature_matrix(row.assign(**{TARGET_COLUMN: False, "neo_id": "input"}))

    prediction = bool(pipeline.predict(row)[0])
    response: dict[str, Any] = {
        "prediction": "potentially_hazardous" if prediction else "not_potentially_hazardous",
        "model": request.model_name,
        "model_version": metadata.get("model_version"),
        "interpretation": (
            "ML model output only — this reflects patterns the model associated with "
            "NASA/JPL's existing 'potentially hazardous' label. It is not an impact "
            "prediction and not a NASA/JPL assessment."
        ),
    }
    if hasattr(pipeline, "predict_proba"):
        response["model_score"] = float(pipeline.predict_proba(row)[0, 1])
        response["model_score_note"] = (
            "Raw classifier output for the positive class; not independently "
            "calibrated against observed frequencies."
        )
    return response
