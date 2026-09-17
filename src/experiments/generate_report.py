"""Generate docs/RESULTS.md entirely from results/experiments/**/*.json.

Usage:
    python -m src.experiments.generate_report

No number in the generated report is hand-typed — every table cell is read
from an artifact written by `python -m src.experiments.run_all`. If an
experiment/model has not been executed, its section says so explicitly
(section 40: the frontend/docs must never become a second source of
truth) rather than being silently omitted or filled with a placeholder.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from src.config import settings
from src.features.feature_sets import FEATURE_SETS
from src.experiments.tuning import build_estimators

REPORT_PATH = settings.resolve("docs/RESULTS.md")


def _read_json(path: Path):
    if not path.exists():
        return None
    return json.loads(path.read_text())


def _fmt(value, digits: int = 3) -> str:
    if value is None:
        return "N/A"
    try:
        return f"{float(value):.{digits}f}"
    except (TypeError, ValueError):
        return str(value)


def _model_dir(experiment_key: str, model_name: str) -> Path:
    return settings.results_path / "experiments" / experiment_key / model_name


def _model_section(experiment_key: str, model_name: str) -> str:
    d = _model_dir(experiment_key, model_name)
    metadata = _read_json(d / "metadata.json")
    if metadata is None:
        return f"#### `{model_name}`\n\n**Not yet executed.** No artifacts found at `{d}`.\n"

    cv = _read_json(d / "cv_metrics.json") or {}
    test = _read_json(d / "test_metrics.json") or {}
    cm = test.get("confusion_matrix", {})
    ci = test.get("f1_bootstrap_ci", {})

    lines = [f"#### `{model_name}`", ""]
    lines.append(
        f"- Tuned via `RandomizedSearchCV`: {metadata.get('tuned')} "
        f"(best hyperparameters recorded in `{d / 'metadata.json'}`)"
    )
    lines.append(
        f"- CV F1: {_fmt(cv.get('f1', {}).get('mean'))} ± {_fmt(cv.get('f1', {}).get('std'))} "
        f"(n_folds={cv.get('f1', {}).get('n_folds')})"
    )
    lines.append(
        f"- Test F1: {_fmt(test.get('f1'))} "
        f"(bootstrap 95% CI: [{_fmt(ci.get('ci_low'))}, {_fmt(ci.get('ci_high'))}], "
        f"n_bootstrap={ci.get('n_bootstrap')})"
    )
    lines.append(
        "- Test: accuracy={} precision={} recall={} roc_auc={} pr_auc={}".format(
            _fmt(test.get("accuracy")),
            _fmt(test.get("precision")),
            _fmt(test.get("recall")),
            _fmt(test.get("roc_auc")),
            _fmt(test.get("pr_auc")),
        )
    )
    if cm:
        lines.append(
            f"- Confusion matrix (test): TN={cm.get('tn')} FP={cm.get('fp')} "
            f"FN={cm.get('fn')} TP={cm.get('tp')}"
        )
    lines.append("")
    return "\n".join(lines)


def _experiment_section(experiment_key: str) -> str:
    feature_set = FEATURE_SETS[experiment_key]
    lines = [f"### {feature_set.display_name}", "", feature_set.purpose, ""]
    lines.append(f"Feature columns ({len(feature_set.feature_columns)}): `{', '.join(feature_set.feature_columns)}`")
    lines.append("")
    for model_name in build_estimators(0):
        lines.append(_model_section(experiment_key, model_name))
    return "\n".join(lines)


def generate() -> str:
    summary_path = settings.results_path / "experiments" / "summary.json"
    summary = _read_json(summary_path)

    header = [
        "# Results",
        "",
        "**This file is generated, not hand-typed.** Regenerate with:",
        "",
        "```bash",
        "python -m src.experiments.generate_report",
        "```",
        "",
        f"Generated at: {datetime.now(timezone.utc).isoformat()}",
        "",
    ]

    if summary is None:
        header.append(
            "**No experiment run found.** `results/experiments/summary.json` does not "
            "exist yet — run `python -m src.experiments.run_all` first (requires a "
            "populated `data/processed/neo_dataset.csv`, i.e. ingestion + validation "
            "must have run against the real NASA NeoWs API first). This project never "
            "fabricates the numbers this report would otherwise contain — see "
            "docs/LIMITATIONS.md and docs/DATA_SOURCE.md."
        )
        header.append("")
    else:
        header.append(f"Dataset row count at run time: {summary.get('dataset_row_count')}")
        header.append(f"Random seed: {summary.get('random_seed')}")
        header.append(f"Run timestamp (UTC): {summary.get('run_at_utc')}")
        header.append("")
        header.append("## Abstract")
        header.append("")
        header.append(
            "This benchmark answers one question: after excluding the NASA/JPL "
            "features that directly define `is_potentially_hazardous_asteroid` "
            "(`moid_au`, `absolute_magnitude_h`) and every feature derived from them "
            "(estimated diameter), how much predictive signal remains in the "
            "object's other orbital and physical characteristics? See "
            "`docs/FEATURE_AUDIT.md` for the full feature-by-feature reasoning behind "
            "every experiment below."
        )
        header.append("")

    body = ["## Experiments", ""]
    for experiment_key in FEATURE_SETS:
        body.append(_experiment_section(experiment_key))

    footer = [
        "## Reproducibility",
        "",
        "```bash",
        "python -m src.data.ingestion",
        "python -m src.data.validation",
        "python -m src.experiments.run_all",
        "python -m src.experiments.generate_report",
        "```",
        "",
        "See `docs/REPRODUCIBILITY.md` for seed/version/dataset-identifier tracking, "
        "and `docs/LIMITATIONS.md` for what these numbers do and do not mean.",
        "",
    ]

    return "\n".join(header + body + footer)


def main() -> None:
    REPORT_PATH.write_text(generate())
    print(f"Wrote {REPORT_PATH}")


if __name__ == "__main__":
    main()
