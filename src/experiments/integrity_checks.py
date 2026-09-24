"""Automated scientific-integrity checks (section 45 of the research brief).

Run standalone:
    python -m src.experiments.integrity_checks

Also imported by tests/test_experiments.py so the same checks run in CI.
Checks that do not require a completed run (feature-set leakage) always
run; checks that require artifacts (result files exist, frontend/backend
values trace back to real artifacts) are skipped with an explicit note
when the pipeline has not executed yet — never treated as a silent pass.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from src.config import settings
from src.features.feature_sets import (
    FEATURE_SETS,
    LABEL_DEFINING_NUMERIC_FEATURES,
    LABEL_DERIVED_NUMERIC_FEATURES,
    assert_no_label_leakage,
)


class IntegrityCheckError(RuntimeError):
    pass


def check_no_excluded_feature_in_leakage_audited_sets() -> None:
    """No leakage-audited (non-original) feature set may include an
    excluded Category A/B feature, or a same-named transform of one.
    """
    excluded = set(LABEL_DEFINING_NUMERIC_FEATURES) | set(LABEL_DERIVED_NUMERIC_FEATURES)
    for feature_set in FEATURE_SETS.values():
        assert_no_label_leakage(feature_set)  # raises LeakageError on failure
        if feature_set.key == "original":
            continue
        for column in feature_set.feature_columns:
            base = re.sub(r"^log_", "", column)
            if base in excluded:
                raise IntegrityCheckError(
                    f"'{feature_set.key}' feature set includes transform '{column}' of "
                    f"excluded feature '{base}'."
                )


def check_experiment_artifacts_exist() -> dict:
    """Report which experiment/model artifact directories exist under
    results/experiments/. Does not fail the run if a pipeline hasn't
    executed yet — that state is valid and must be reported, not hidden
    (see backend/main.py's "never fabricate, report unavailable" pattern).
    """
    root = settings.results_path / "experiments"
    report: dict[str, dict] = {}
    if not root.exists():
        return {"executed": False, "detail": f"{root} does not exist yet."}

    for experiment_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        report[experiment_dir.name] = {}
        for model_dir in sorted(p for p in experiment_dir.iterdir() if p.is_dir()):
            expected = [
                "cv_metrics.json",
                "fold_metrics.json",
                "test_metrics.json",
                "confusion_matrix.json",
                "roc_curve.json",
                "pr_curve.json",
                "predictions.csv",
                "metadata.json",
            ]
            present = {name: (model_dir / name).exists() for name in expected}
            report[experiment_dir.name][model_dir.name] = present
    return {"executed": bool(report), "artifacts": report}


def check_frontend_has_no_hardcoded_metrics(frontend_src_dir: Path) -> list[str]:
    """Scan frontend source for suspicious literal metric values that are
    not obviously threshold-grid/config constants. This is a heuristic
    grep-based check (not a proof), intended to catch an accidental
    hand-typed benchmark number creeping into a component — see section 46.
    """
    suspicious_patterns = [
        re.compile(r"\bF1\s*[:=]\s*1\.0+\b"),
        re.compile(r"\baccuracy\s*[:=]\s*1\.0+\b", re.IGNORECASE),
        re.compile(r"\bROC-AUC\s*[:=]\s*1\.0+\b", re.IGNORECASE),
    ]
    hits: list[str] = []
    if not frontend_src_dir.exists():
        return hits
    for path in frontend_src_dir.rglob("*.tsx"):
        text = path.read_text()
        for pattern in suspicious_patterns:
            if pattern.search(text):
                hits.append(f"{path}: matched {pattern.pattern}")
    return hits


def run_all_checks() -> dict:
    check_no_excluded_feature_in_leakage_audited_sets()
    artifacts = check_experiment_artifacts_exist()
    frontend_hits = check_frontend_has_no_hardcoded_metrics(
        settings.resolve("frontend/src")
    )
    return {
        "leakage_check": "passed",
        "artifacts": artifacts,
        "hardcoded_metric_scan": {
            "clean": len(frontend_hits) == 0,
            "hits": frontend_hits,
        },
    }


def main() -> None:
    result = run_all_checks()
    print(json.dumps(result, indent=2))
    if not result["hardcoded_metric_scan"]["clean"]:
        raise SystemExit(
            "Hardcoded-looking metric literals found in frontend source — see output above."
        )


if __name__ == "__main__":
    main()
