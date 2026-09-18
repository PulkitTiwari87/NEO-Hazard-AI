"""Reconstruct local results/experiments/** from a live deployment's API.

Why this exists: this project's Render deployment has real NASA API
access and runs the full benchmark (src/experiments/run_all.py), but its
filesystem is ephemeral — results/ is never committed to git (see
.gitignore; same policy as data/, model_registry/). To get real numbers
into docs/RESULTS.md in this repository (rather than hand-typing them, as
Experiment A's numbers originally were), this script pulls the same
artifacts back down through the already-existing, already-tested
backend/main.py::experiment_model_detail endpoint and writes them to the
same on-disk locations src.experiments.run_all itself writes to, so that
`python -m src.experiments.generate_report` can run unmodified against
them afterward.

Usage:
    python -m src.experiments.fetch_live_results --base-url https://neo-hazard-ai-backend.onrender.com

Limitations (documented, not hidden): the API caps error-analysis samples
at 25 rows per outcome (see backend/main.py) and does not expose the full
predictions.csv — only the live deployment's own disk has that. This
script reconstructs everything the comparison tables, curves, and
error-summary statistics need; it does not attempt to reconstruct
predictions.csv.
"""
from __future__ import annotations

import argparse
import json
import logging

import requests

from src.config import settings
from src.features.feature_sets import FEATURE_SETS
from src.experiments.tuning import build_estimators

logger = logging.getLogger(__name__)

ARTIFACT_KEYS = {
    "metadata": "metadata.json",
    "cv_metrics": "cv_metrics.json",
    "fold_metrics": "fold_metrics.json",
    "test_metrics": "test_metrics.json",
    "confusion_matrix": "confusion_matrix.json",
    "roc_curve": "roc_curve.json",
    "pr_curve": "pr_curve.json",
    "threshold_analysis": "threshold_analysis.json",
    "calibration": "calibration.json",
    "feature_importance": "feature_importance.json",
}


class FetchError(RuntimeError):
    pass


def fetch_one(base_url: str, experiment: str, model_name: str) -> bool:
    url = f"{base_url}/api/experiments/{experiment}/{model_name}"
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    payload = response.json()
    if payload.get("status") != "ok":
        logger.info("Skipping %s/%s: %s", experiment, model_name, payload.get("detail"))
        return False

    out_dir = settings.results_path / "experiments" / experiment / model_name
    out_dir.mkdir(parents=True, exist_ok=True)

    for field, filename in ARTIFACT_KEYS.items():
        if payload.get(field) is not None:
            (out_dir / filename).write_text(json.dumps(payload[field], indent=2))

    error_analysis = {
        "feature_range_summary": payload.get("error_summary"),
        "false_positives": payload.get("false_positives_sample", []),
        "false_negatives": payload.get("false_negatives_sample", []),
        "note": (
            "Fetched via the live API (src.experiments.fetch_live_results); "
            "false_positives/false_negatives are capped at 25 rows each by "
            "backend/main.py, not the full test-fold error set."
        ),
    }
    (out_dir / "error_analysis.json").write_text(json.dumps(error_analysis, indent=2))

    if payload.get("shap_summary") is not None:
        (out_dir / "shap_summary.json").write_text(json.dumps(payload["shap_summary"], indent=2))

    logger.info("Fetched %s/%s -> %s", experiment, model_name, out_dir)
    return True


def fetch_all(base_url: str) -> dict:
    summary_response = requests.get(f"{base_url}/api/experiments", timeout=30)
    summary_response.raise_for_status()
    summary_payload = summary_response.json()

    fetched = {}
    for experiment_key, feature_set in FEATURE_SETS.items():
        fetched[experiment_key] = {}
        for model_name in build_estimators(0):
            fetched[experiment_key][model_name] = fetch_one(base_url, experiment_key, model_name)

    reproducibility_response = requests.get(f"{base_url}/api/reproducibility", timeout=30)
    reproducibility_response.raise_for_status()
    reproducibility_payload = reproducibility_response.json()
    last_run = reproducibility_payload.get("last_benchmark_run")
    if last_run is not None:
        summary_path = settings.results_path / "experiments" / "summary.json"
        summary_path.parent.mkdir(parents=True, exist_ok=True)
        summary_path.write_text(json.dumps(last_run, indent=2))

    return {"fetched": fetched, "experiments_list": summary_payload, "reproducibility": reproducibility_payload}


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Pull real experiment artifacts from a live deployment's API.")
    parser.add_argument("--base-url", required=True, help="e.g. https://neo-hazard-ai-backend.onrender.com")
    args = parser.parse_args()

    result = fetch_all(args.base_url.rstrip("/"))
    print(json.dumps(result["fetched"], indent=2))


if __name__ == "__main__":
    main()
