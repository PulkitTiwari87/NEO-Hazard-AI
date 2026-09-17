"""Split strategy for the experiment framework.

Row grain: one row per unique NEO object (`src/data/validation.py::clean`
deduplicates by `neo_id` before this pipeline ever sees the data — see
docs/METHODOLOGY.md). Because grain is already object-level, a plain
`StratifiedKFold`/`train_test_split` cannot leak the same object across
folds — there is only one row for it to appear in. `GroupKFold` /
`StratifiedGroupKFold` are documented here as unnecessary rather than
silently skipped, per the task's "verify dataset grain, document it"
requirement (see `verify_object_level_grain`).

Two-level structure, enforced by construction:

    real data
       |
       +-- outer holdout test set (never touched below this line)
       |
       +-- training set
              |
              +-- 5-fold StratifiedKFold
                     |
                     +-- model selection / hyperparameter tuning
"""
from __future__ import annotations

import pandas as pd
from sklearn.model_selection import StratifiedKFold, train_test_split

OUTER_TEST_SIZE = 0.2
N_CV_FOLDS = 5


class GrainError(RuntimeError):
    pass


def verify_object_level_grain(df: pd.DataFrame, id_column: str = "neo_id") -> None:
    """Fail loudly if the same object appears more than once. This is a
    precondition for using plain StratifiedKFold instead of a grouped
    split — see module docstring.
    """
    duplicate_count = int(df[id_column].duplicated().sum())
    if duplicate_count > 0:
        raise GrainError(
            f"Dataset has {duplicate_count} duplicate '{id_column}' value(s). "
            "Plain StratifiedKFold/train_test_split assumes one row per object; "
            "either re-run src.data.validation (which deduplicates) or switch to "
            "StratifiedGroupKFold/GroupKFold keyed on the object id."
        )


def make_outer_holdout(x: pd.DataFrame, y: pd.Series, random_seed: int, test_size: float = OUTER_TEST_SIZE):
    """Single stratified split producing the untouched final test set.

    Must be called exactly once per experiment, before any CV, tuning, or
    threshold selection touches the data — see module docstring.
    """
    return train_test_split(x, y, test_size=test_size, random_state=random_seed, stratify=y)


def make_cv_splitter(random_seed: int, n_splits: int = N_CV_FOLDS) -> StratifiedKFold:
    return StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_seed)
