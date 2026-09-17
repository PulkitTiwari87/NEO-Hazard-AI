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
EXPERIMENTS_INDEX_PATH = settings.results_path / "experiments" / "index.json"
ANOMALY_ANALYSIS_PATH = settings.results_path / "anomaly_analysis.json"
ANOMALY_SCORES_PATH = settings.results_path / "anomaly_scores.csv"
MAX_FULL_DATASET_ROWS = 2000
from src.features.engineering import (
    ALL_NUMERIC_FEATURES,
    CATEGORICAL_FEATURES,
    EXPERIMENTS,
    FEATURE_DEFINITIONS,
    PASSTHROUGH_NUMERIC_FEATURES,
    TARGET_COLUMN,
    add_derived_features,
    build_feature_matrix,
)
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


def _records_json_safe(df: pd.DataFrame) -> list[dict[str, Any]]:
    """DataFrame -> list[dict] with NaN converted to JSON `null` (pandas
    .to_dict() leaves NaN as a float, which is not valid JSON)."""
    if df.empty:
        return []
    return json.loads(df.to_json(orient="records"))


def _json_file_or_unavailable(path, detail: str) -> dict[str, Any]:
    if not path.exists():
        return {"status": "unavailable", "detail": detail}
    payload = json.loads(path.read_text())
    if isinstance(payload, dict):
        return {"status": "ok", **payload}
    return {"status": "ok", "data": payload}


def _experiment_combo_dir(experiment_id: str, model_name: str):
    return settings.results_path / "experiments" / experiment_id / model_name


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


@app.get("/api/dataset/quality")
def dataset_quality() -> dict[str, Any]:
    df = _load_processed_dataset()
    if df is None:
        return {
            "status": "unavailable",
            "detail": (
                "Dataset has not been ingested/validated yet. Run "
                "`python -m src.data.ingestion` then `python -m src.data.validation`."
            ),
        }
    df_features = add_derived_features(df)
    numeric_cols = [c for c in ALL_NUMERIC_FEATURES if c in df_features.columns]

    numeric_ranges: dict[str, Any] = {}
    for col in numeric_cols:
        series = df_features[col].dropna()
        if series.empty:
            numeric_ranges[col] = None
            continue
        numeric_ranges[col] = {
            "min": float(series.min()),
            "max": float(series.max()),
            "mean": float(series.mean()),
            "median": float(series.median()),
            "std": float(series.std()) if len(series) > 1 else 0.0,
        }

    categorical_cardinality: dict[str, Any] = {}
    for col in CATEGORICAL_FEATURES:
        if col in df_features.columns:
            value_counts = df_features[col].value_counts(dropna=False)
            categorical_cardinality[col] = {
                "unique_count": int(df_features[col].nunique(dropna=True)),
                "value_counts": {("missing" if pd.isna(k) else str(k)): int(v) for k, v in value_counts.items()},
            }

    total = len(df)
    hazardous_count = int(df[TARGET_COLUMN].sum())
    missing_counts = df_features.isna().sum()
    missing_pct = (df_features.isna().mean() * 100).round(2)

    validation_report = None
    if VALIDATION_REPORT_PATH.exists():
        validation_report = json.loads(VALIDATION_REPORT_PATH.read_text())

    return {
        "status": "ok",
        "row_count": total,
        "unique_neo_count": int(df["neo_id"].nunique()),
        "duplicate_neo_id_count": int(df["neo_id"].duplicated().sum()),
        "class_distribution": {
            "hazardous_count": hazardous_count,
            "non_hazardous_count": total - hazardous_count,
            "hazardous_percentage": round(100 * hazardous_count / total, 2) if total else None,
        },
        "missing_value_counts": {c: int(missing_counts[c]) for c in df_features.columns},
        "missing_value_percentages": {c: float(missing_pct[c]) for c in df_features.columns},
        "numeric_ranges": numeric_ranges,
        "categorical_cardinality": categorical_cardinality,
        "cleaning_report": (validation_report or {}).get("cleaning"),
        "schema_validation_report": (validation_report or {}).get("schema_validation"),
        "note": "Every count and range here is computed live from data/processed/neo_dataset.csv — nothing is hardcoded.",
    }


@app.get("/api/dataset/correlations")
def dataset_correlations(method: str = "pearson") -> dict[str, Any]:
    if method not in ("pearson", "spearman"):
        raise HTTPException(status_code=400, detail="`method` must be 'pearson' or 'spearman'.")
    df = _load_processed_dataset()
    if df is None:
        return {
            "status": "unavailable",
            "detail": "Dataset has not been ingested/validated yet.",
        }
    df_features = add_derived_features(df)
    numeric_cols = [c for c in ALL_NUMERIC_FEATURES if c in df_features.columns]
    corr = df_features[numeric_cols].corr(method=method)
    corr = corr.where(pd.notna(corr), None)
    return {
        "status": "ok",
        "method": method,
        "features": numeric_cols,
        "matrix": corr.values.tolist(),
        "missing_value_handling": (
            "Pairwise complete observations (pandas DataFrame.corr default): a row missing "
            "either feature in a pair is excluded from that pair's coefficient only, not "
            "from the whole matrix."
        ),
        "note": "Correlation does not establish causation.",
    }


@app.get("/api/dataset/full")
def dataset_full(limit: int = MAX_FULL_DATASET_ROWS) -> dict[str, Any]:
    df = _load_processed_dataset()
    if df is None:
        return {
            "status": "unavailable",
            "detail": "Dataset has not been ingested/validated yet.",
            "results": [],
        }
    df_features = add_derived_features(df)
    total = len(df_features)
    capped_limit = max(1, min(limit, MAX_FULL_DATASET_ROWS))
    sampled = total > capped_limit
    sample = df_features.sample(n=capped_limit, random_state=settings.random_seed) if sampled else df_features
    return {
        "status": "ok",
        "total_count": total,
        "returned_count": int(len(sample)),
        "sampled": sampled,
        "sample_note": f"Visualization sampled to {len(sample)} of {total} records for rendering." if sampled else None,
        "results": _records_json_safe(sample),
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
        "results": _records_json_safe(page),
    }


@app.get("/api/neo/{neo_id}")
def get_neo(neo_id: str) -> dict[str, Any]:
    df = _load_processed_dataset()
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset has not been ingested yet.")
    match = df[df["neo_id"].astype(str) == str(neo_id)]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"No NEO found with id '{neo_id}'.")
    return _records_json_safe(match.iloc[[0]])[0]


@app.get("/api/neo/{neo_id}/anomaly")
def get_neo_anomaly(neo_id: str) -> dict[str, Any]:
    if not ANOMALY_SCORES_PATH.exists():
        return {
            "status": "unavailable",
            "detail": "Anomaly detection has not been run yet. Run `python -m src.anomaly.detect`.",
        }
    scores_df = pd.read_csv(ANOMALY_SCORES_PATH)
    match = scores_df[scores_df["neo_id"].astype(str) == str(neo_id)]
    if match.empty:
        return {"status": "unavailable", "detail": f"No anomaly score recorded for NEO '{neo_id}'."}
    record = _records_json_safe(match.iloc[[0]])[0]
    return {"status": "ok", **record}


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


@app.get("/api/experiments")
def experiments() -> dict[str, Any]:
    if not EXPERIMENTS_INDEX_PATH.exists():
        return {
            "status": "unavailable",
            "detail": (
                "Experiments have not been run yet. Run `python -m src.experiments.run_all` "
                "(requires data/processed/neo_dataset.csv)."
            ),
            "experiment_definitions": EXPERIMENTS,
        }
    payload = json.loads(EXPERIMENTS_INDEX_PATH.read_text())
    return {"status": "ok", **payload}


@app.get("/api/experiments/{experiment_id}/models/{model_name}/holdout")
def experiment_holdout(experiment_id: str, model_name: str) -> dict[str, Any]:
    if experiment_id not in EXPERIMENTS:
        raise HTTPException(status_code=404, detail=f"Unknown experiment '{experiment_id}'.")
    path = _experiment_combo_dir(experiment_id, model_name) / "holdout.json"
    return _json_file_or_unavailable(
        path,
        f"Holdout evaluation not available for {experiment_id}/{model_name}. Run `python -m src.experiments.run_all`.",
    )


@app.get("/api/experiments/{experiment_id}/models/{model_name}/cv")
def experiment_cv(experiment_id: str, model_name: str) -> dict[str, Any]:
    if experiment_id not in EXPERIMENTS:
        raise HTTPException(status_code=404, detail=f"Unknown experiment '{experiment_id}'.")
    path = _experiment_combo_dir(experiment_id, model_name) / "cv.json"
    return _json_file_or_unavailable(
        path,
        f"Cross-validation results not available for {experiment_id}/{model_name}. Run `python -m src.experiments.run_all`.",
    )


@app.get("/api/experiments/{experiment_id}/models/{model_name}/threshold")
def experiment_threshold(experiment_id: str, model_name: str) -> dict[str, Any]:
    if experiment_id not in EXPERIMENTS:
        raise HTTPException(status_code=404, detail=f"Unknown experiment '{experiment_id}'.")
    path = _experiment_combo_dir(experiment_id, model_name) / "threshold.json"
    return _json_file_or_unavailable(
        path,
        f"Threshold analysis not available for {experiment_id}/{model_name}. Run `python -m src.experiments.run_all`.",
    )


@app.get("/api/experiments/{experiment_id}/models/{model_name}/calibration")
def experiment_calibration(experiment_id: str, model_name: str) -> dict[str, Any]:
    if experiment_id not in EXPERIMENTS:
        raise HTTPException(status_code=404, detail=f"Unknown experiment '{experiment_id}'.")
    path = _experiment_combo_dir(experiment_id, model_name) / "calibration.json"
    return _json_file_or_unavailable(
        path,
        f"Calibration analysis not available for {experiment_id}/{model_name}. Run `python -m src.experiments.run_all`.",
    )


@app.get("/api/experiments/{experiment_id}/models/{model_name}/errors")
def experiment_errors(experiment_id: str, model_name: str) -> dict[str, Any]:
    if experiment_id not in EXPERIMENTS:
        raise HTTPException(status_code=404, detail=f"Unknown experiment '{experiment_id}'.")
    path = _experiment_combo_dir(experiment_id, model_name) / "errors.json"
    return _json_file_or_unavailable(
        path,
        f"Error analysis not available for {experiment_id}/{model_name}. Run `python -m src.experiments.run_all`.",
    )


@app.get("/api/experiments/{experiment_id}/models/{model_name}/explainability")
def experiment_explainability(experiment_id: str, model_name: str) -> dict[str, Any]:
    if experiment_id not in EXPERIMENTS:
        raise HTTPException(status_code=404, detail=f"Unknown experiment '{experiment_id}'.")
    combo_dir = _experiment_combo_dir(experiment_id, model_name)
    importance_path = combo_dir / "shap_global_importance.json"
    local_path = combo_dir / "shap_local_examples.json"
    if not importance_path.exists():
        return {
            "status": "unavailable",
            "detail": (
                f"SHAP explainability not generated for {experiment_id}/{model_name}. Run "
                f"`python -m src.explainability.shap_analysis --model {model_name} --experiment {experiment_id}`."
            ),
        }

    def _strip_prefix(name: str) -> str:
        return name.split("__", 1)[1] if "__" in name else name

    payload = json.loads(importance_path.read_text())
    importance = [
        {"feature": _strip_prefix(name), "mean_abs_shap": value}
        for name, value in sorted(
            payload["mean_abs_shap_by_feature"].items(), key=lambda pair: pair[1], reverse=True
        )
    ]
    local_examples = None
    if local_path.exists():
        raw_examples = json.loads(local_path.read_text()).get("examples") or []
        local_examples = [
            {
                "neo_id": example["neo_id"],
                "top_contributing_features": [
                    {"feature": _strip_prefix(f["feature"]), "shap_value": f["shap_value"]}
                    for f in example["top_contributing_features"]
                ],
            }
            for example in raw_examples
        ]
    return {
        "status": "ok",
        "experiment_id": experiment_id,
        "model_name": model_name,
        "global_importance": importance,
        "local_examples": local_examples,
    }


@app.get("/api/anomalies")
def anomalies(top: int = 10) -> dict[str, Any]:
    if not ANOMALY_ANALYSIS_PATH.exists():
        return {
            "status": "unavailable",
            "detail": "Anomaly detection has not been run yet. Run `python -m src.anomaly.detect`.",
        }
    payload = json.loads(ANOMALY_ANALYSIS_PATH.read_text())
    all_top = payload.get("top_anomalies", [])
    capped_top = max(1, min(top, len(all_top))) if all_top else 0
    payload = {**payload, "top_anomalies": all_top[:capped_top], "requested_top": top}
    return {"status": "ok", **payload}


@app.get("/api/features")
def features() -> dict[str, Any]:
    return {
        "target_column": TARGET_COLUMN,
        "nasa_provided_features": PASSTHROUGH_NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "derived_features": FEATURE_DEFINITIONS,
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
