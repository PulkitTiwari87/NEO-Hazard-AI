"""Metric computation for binary classification of the NEO hazard label.

Usage:
    python -m src.models.evaluate

Re-loads every registered model, reproduces the same stratified test split
used at training time (same dataset, same random seed), and regenerates
results/model_metrics.json from scratch. This lets anyone verify that the
published metrics are reproducible rather than hand-typed.
"""
from __future__ import annotations

import json
import logging

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split

from src.config import PROCESSED_DATASET_PATH, settings
from src.features.engineering import build_feature_matrix
from src.models.registry import list_registered_models, load_model, load_metadata

logger = logging.getLogger(__name__)


class EvaluationError(RuntimeError):
    pass


def compute_classification_metrics(y_true, y_pred, y_proba=None) -> dict:
    metrics = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
    }
    cm = confusion_matrix(y_true, y_pred, labels=[False, True])
    metrics["confusion_matrix"] = {
        "labels": ["not_hazardous", "potentially_hazardous"],
        "matrix": cm.tolist(),
    }
    if y_proba is not None and len(np.unique(y_true)) > 1:
        metrics["roc_auc"] = float(roc_auc_score(y_true, y_proba))
        metrics["pr_auc"] = float(average_precision_score(y_true, y_proba))
        fpr, tpr, _ = roc_curve(y_true, y_proba)
        precision, recall, _ = precision_recall_curve(y_true, y_proba)
        metrics["roc_curve"] = {"fpr": fpr.tolist(), "tpr": tpr.tolist()}
        metrics["pr_curve"] = {"precision": precision.tolist(), "recall": recall.tolist()}
    else:
        metrics["roc_auc"] = None
        metrics["pr_auc"] = None
        metrics["roc_curve"] = None
        metrics["pr_curve"] = None
    return metrics


def reproduce_test_split(random_seed: int, test_size: float):
    if not PROCESSED_DATASET_PATH.exists():
        raise EvaluationError(
            f"Processed dataset not found at {PROCESSED_DATASET_PATH}. "
            "Run ingestion + validation + training first."
        )
    df = pd.read_csv(PROCESSED_DATASET_PATH)
    x, y = build_feature_matrix(df)
    return train_test_split(x, y, test_size=test_size, random_state=random_seed, stratify=y)


def evaluate_all_registered_models() -> dict:
    model_names = list_registered_models()
    if not model_names:
        raise EvaluationError(
            "No trained models found in the model registry. Run `python -m src.models.train` first."
        )

    all_metrics = {}
    for name in model_names:
        metadata = load_metadata(name)
        if "test_size" not in metadata:
            # Not a classifier trained by src.models.train (e.g. the
            # unsupervised isolation_forest registered by src.anomaly.detect,
            # which uses a different metadata schema) — nothing to evaluate here.
            logger.info("Skipping '%s': not a classification model.", name)
            continue
        pipeline = load_model(name)
        _, x_test, _, y_test = reproduce_test_split(
            random_seed=metadata["random_seed"], test_size=metadata["test_size"]
        )
        y_pred = pipeline.predict(x_test)
        y_proba = None
        if hasattr(pipeline, "predict_proba"):
            y_proba = pipeline.predict_proba(x_test)[:, 1]
        all_metrics[name] = compute_classification_metrics(y_test, y_pred, y_proba)
    return all_metrics


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    metrics = evaluate_all_registered_models()

    settings.results_path.mkdir(parents=True, exist_ok=True)
    output_path = settings.results_path / "model_metrics.json"
    output_path.write_text(json.dumps(metrics, indent=2))
    print(f"Wrote evaluation metrics for {len(metrics)} model(s) -> {output_path}")


if __name__ == "__main__":
    main()
