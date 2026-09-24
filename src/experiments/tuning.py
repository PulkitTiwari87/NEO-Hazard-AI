"""Hyperparameter search spaces and the tuning entrypoint.

Search spaces are kept small and standard (never expanded to chase a
target score — see docs/METHODOLOGY.md and section 15/48 of the research
brief this module implements) and are always driven by RandomizedSearchCV
scored via cross-validation on the training fold only. The outer holdout
test set is never passed into this module.
"""
from __future__ import annotations

from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import RandomizedSearchCV
from xgboost import XGBClassifier

N_ITER = 12


def build_estimators(random_seed: int) -> dict[str, object]:
    """Unfitted estimators. class_weight='balanced' is set per-estimator up
    front (not searched) so the search space stays about model capacity,
    not about re-deriving what the training fold's label balance already
    determines — consistent with the adaptive class-imbalance handling in
    the legacy src/models/train.py.
    """
    return {
        "dummy_most_frequent": DummyClassifier(strategy="most_frequent"),
        "logistic_regression": LogisticRegression(
            max_iter=2000, class_weight="balanced", random_state=random_seed
        ),
        "random_forest": RandomForestClassifier(class_weight="balanced", random_state=random_seed),
        "xgboost": XGBClassifier(random_state=random_seed, eval_metric="logloss"),
    }


PARAM_DISTRIBUTIONS: dict[str, dict] = {
    "logistic_regression": {
        "C": [0.01, 0.03, 0.1, 0.3, 1.0, 3.0, 10.0],
    },
    "random_forest": {
        "n_estimators": [100, 200, 300, 400],
        "max_depth": [None, 4, 6, 8, 12],
        "min_samples_leaf": [1, 2, 4, 8],
        "max_features": ["sqrt", "log2", None],
    },
    "xgboost": {
        "n_estimators": [100, 200, 300],
        "max_depth": [2, 3, 4, 6],
        "learning_rate": [0.01, 0.05, 0.1, 0.2],
        "subsample": [0.6, 0.8, 1.0],
        "colsample_bytree": [0.6, 0.8, 1.0],
    },
}


def tunable_model_names() -> list[str]:
    return list(PARAM_DISTRIBUTIONS)


def tune_pipeline(pipeline, model_name: str, x_train, y_train, cv, random_seed: int, scoring: str = "f1"):
    """Wrap `pipeline` (preprocess + model) in RandomizedSearchCV over the
    model step's parameter distribution, fit on the training fold only, and
    return (best_pipeline, search_results). If `model_name` has no defined
    search space (e.g. the dummy baseline), the pipeline is fit as-is and
    an empty search-results list is returned.
    """
    param_distribution = PARAM_DISTRIBUTIONS.get(model_name)
    if not param_distribution:
        pipeline.fit(x_train, y_train)
        return pipeline, []

    prefixed = {f"model__{key}": value for key, value in param_distribution.items()}
    search = RandomizedSearchCV(
        pipeline,
        param_distributions=prefixed,
        n_iter=min(N_ITER, _search_space_size(param_distribution)),
        scoring=scoring,
        cv=cv,
        random_state=random_seed,
        refit=True,
        n_jobs=-1,
    )
    search.fit(x_train, y_train)

    results = []
    cv_results = search.cv_results_
    for i in range(len(cv_results["params"])):
        results.append(
            {
                "params": cv_results["params"][i],
                "mean_test_score": float(cv_results["mean_test_score"][i]),
                "std_test_score": float(cv_results["std_test_score"][i]),
                "rank_test_score": int(cv_results["rank_test_score"][i]),
            }
        )
    return search.best_estimator_, results


def _search_space_size(param_distribution: dict) -> int:
    size = 1
    for values in param_distribution.values():
        size *= len(values)
    return size
