"""Error analysis over the outer holdout test set: what does the model get
wrong, and are the errors concentrated anywhere in feature space?

Every row here comes from actual test-set predictions (never a resampled,
synthetic, or invented example). Distribution summaries are plain pandas
aggregations over the real error rows — no explanation is asserted beyond
what the numbers in `feature_range_summary` show.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def build_error_table(
    neo_ids: pd.Series,
    x_test: pd.DataFrame,
    y_true,
    y_pred,
    y_proba=None,
) -> pd.DataFrame:
    y_true_arr = np.asarray(y_true).astype(bool)
    y_pred_arr = np.asarray(y_pred).astype(bool)

    def outcome(actual: bool, predicted: bool) -> str:
        if actual and predicted:
            return "true_positive"
        if not actual and not predicted:
            return "true_negative"
        if not actual and predicted:
            return "false_positive"
        return "false_negative"

    table = x_test.reset_index(drop=True).copy()
    table.insert(0, "neo_id", neo_ids.reset_index(drop=True).values)
    table["actual_label"] = np.where(y_true_arr, "potentially_hazardous", "not_hazardous")
    table["predicted_label"] = np.where(y_pred_arr, "potentially_hazardous", "not_hazardous")
    table["model_probability"] = y_proba if y_proba is not None else np.nan
    table["outcome"] = [outcome(a, p) for a, p in zip(y_true_arr, y_pred_arr)]
    return table


def feature_range_summary(error_table: pd.DataFrame, numeric_features: list[str]) -> dict:
    """For each outcome bucket (TP/TN/FP/FN) and each numeric feature,
    report count/mean/median/std actually observed in that bucket — the
    concrete basis for "are errors concentrated in particular feature
    ranges?" (never an inferred causal claim).
    """
    summary: dict[str, dict] = {}
    for outcome, group in error_table.groupby("outcome"):
        feature_stats = {}
        for feature in numeric_features:
            if feature not in group.columns:
                continue
            series = group[feature].dropna()
            if series.empty:
                continue
            feature_stats[feature] = {
                "count": int(series.count()),
                "mean": float(series.mean()),
                "median": float(series.median()),
                "std": float(series.std()) if series.count() > 1 else 0.0,
                "min": float(series.min()),
                "max": float(series.max()),
            }
        summary[outcome] = {"n_rows": int(len(group)), "feature_stats": feature_stats}
    return summary


def error_records(error_table: pd.DataFrame, outcome: str, limit: int = 50) -> list[dict]:
    subset = error_table[error_table["outcome"] == outcome].head(limit)
    return subset.to_dict(orient="records")
