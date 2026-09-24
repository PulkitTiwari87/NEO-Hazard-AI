"""Lightweight model registry: persist a trained pipeline plus its metadata.

Each model gets its own subdirectory under model_registry/<name>/ containing:
  - model.joblib   (the fitted scikit-learn Pipeline, including preprocessing)
  - metadata.json  (training config, dataset reference, metrics, timestamp)
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib

from src.config import settings


@dataclass
class ModelMetadata:
    model_name: str
    model_version: str
    trained_at_utc: str
    dataset_path: str
    dataset_row_count: int
    feature_columns: list[str]
    categorical_features: list[str]
    numeric_features: list[str]
    target_column: str
    random_seed: int
    test_size: float
    hyperparameters: dict[str, Any]
    metrics: dict[str, Any]


def model_dir(model_name: str) -> Path:
    return settings.model_registry_path / model_name


def save_model(pipeline: Any, metadata: ModelMetadata) -> Path:
    directory = model_dir(metadata.model_name)
    directory.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, directory / "model.joblib")
    (directory / "metadata.json").write_text(json.dumps(metadata.__dict__, indent=2))
    return directory


def load_model(model_name: str) -> Any:
    path = model_dir(model_name) / "model.joblib"
    if not path.exists():
        raise FileNotFoundError(
            f"No trained model named '{model_name}' found at {path}. "
            "Run `python -m src.models.train` first."
        )
    return joblib.load(path)


def load_metadata(model_name: str) -> dict[str, Any]:
    path = model_dir(model_name) / "metadata.json"
    if not path.exists():
        raise FileNotFoundError(f"No metadata found for model '{model_name}' at {path}.")
    return json.loads(path.read_text())


def list_registered_models() -> list[str]:
    root = settings.model_registry_path
    if not root.exists():
        return []
    return sorted(
        p.name for p in root.iterdir() if p.is_dir() and (p / "model.joblib").exists()
    )


def new_model_version() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
