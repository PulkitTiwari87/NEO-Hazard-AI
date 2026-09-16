"""SHAP-based explainability for the trained tree-based hazard classifier.

Usage:
    python -m src.explainability.shap_analysis [--model random_forest]

Produces:
  - results/shap_global_importance.json  (mean |SHAP value| per feature)
  - results/shap_local_examples.json     (per-row feature contributions for
    a small sample of the test set)

Terminology (see docs/LIMITATIONS.md): SHAP values describe how much each
feature moved *this model's* output for *this row*, relative to the
model's average prediction. They explain the model, not the physical
cause of an object's classification, and they are never described as
NASA's reasoning.
"""
from __future__ import annotations

import argparse
import json
import logging

import numpy as np
import pandas as pd
import shap

from src.config import PROCESSED_DATASET_PATH, settings
from src.features.engineering import ALL_NUMERIC_FEATURES, CATEGORICAL_FEATURES, build_feature_matrix
from src.models.registry import load_model

logger = logging.getLogger(__name__)

SAMPLE_SIZE = 20


class ExplainabilityError(RuntimeError):
    pass


def run(model_name: str = "random_forest") -> tuple[dict, list]:
    if not PROCESSED_DATASET_PATH.exists():
        raise ExplainabilityError(
            f"Processed dataset not found at {PROCESSED_DATASET_PATH}. Run the data pipeline first."
        )

    pipeline = load_model(model_name)
    df = pd.read_csv(PROCESSED_DATASET_PATH)
    x, _ = build_feature_matrix(df)

    preprocessor = pipeline.named_steps["preprocess"]
    model = pipeline.named_steps["model"]

    x_transformed = preprocessor.transform(x)
    feature_names = list(preprocessor.get_feature_names_out())

    sample_n = min(SAMPLE_SIZE, x_transformed.shape[0])
    rng = np.random.RandomState(settings.random_seed)
    sample_idx = rng.choice(x_transformed.shape[0], size=sample_n, replace=False)
    x_sample = x_transformed[sample_idx]

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(x_sample)
    if isinstance(shap_values, list):
        # Older SHAP API: one array per class for binary classifiers.
        shap_values = shap_values[1]
    elif isinstance(shap_values, np.ndarray) and shap_values.ndim == 3:
        # Newer SHAP API: shape (n_samples, n_features, n_classes).
        shap_values = shap_values[:, :, 1]

    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    global_importance = {
        name: float(value)
        for name, value in sorted(
            zip(feature_names, mean_abs_shap), key=lambda pair: pair[1], reverse=True
        )
    }

    neo_ids = df.iloc[sample_idx]["neo_id"].tolist()
    local_examples = []
    for row_pos, neo_id in enumerate(neo_ids):
        contributions = sorted(
            zip(feature_names, shap_values[row_pos]), key=lambda pair: abs(pair[1]), reverse=True
        )[:5]
        local_examples.append(
            {
                "neo_id": neo_id,
                "top_contributing_features": [
                    {"feature": name, "shap_value": float(value)} for name, value in contributions
                ],
            }
        )

    return global_importance, local_examples


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Generate SHAP explanations for a trained model.")
    parser.add_argument("--model", default="random_forest")
    args = parser.parse_args()

    global_importance, local_examples = run(model_name=args.model)

    settings.results_path.mkdir(parents=True, exist_ok=True)
    (settings.results_path / "shap_global_importance.json").write_text(
        json.dumps({"model": args.model, "mean_abs_shap_by_feature": global_importance}, indent=2)
    )
    (settings.results_path / "shap_local_examples.json").write_text(
        json.dumps({"model": args.model, "examples": local_examples}, indent=2)
    )
    print(f"Wrote SHAP explainability outputs for model '{args.model}' -> {settings.results_path}")


if __name__ == "__main__":
    main()
