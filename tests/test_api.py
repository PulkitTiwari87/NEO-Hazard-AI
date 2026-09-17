"""API tests run against a clean environment with no ingested data and no
trained models (the state a fresh checkout is in) to verify the backend
fails honestly rather than fabricating responses. These deliberately do
NOT stand up a fake dataset/model, since the property under test is the
"nothing here yet" behavior itself.
"""
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_statistics_reports_unavailable_without_ingested_data():
    response = client.get("/api/statistics")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "unavailable"
    assert "detail" in body


def test_models_list_is_empty_without_trained_models():
    response = client.get("/api/models")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "unavailable"
    assert body["models"] == []


def test_predict_returns_503_when_model_not_trained():
    response = client.post("/api/predict", json={"model_name": "random_forest", "absolute_magnitude_h": 20.0})
    assert response.status_code == 503
    assert "not been trained" in response.json()["detail"]


def test_predict_rejects_unknown_fields():
    response = client.post("/api/predict", json={"model_name": "random_forest", "not_a_real_field": 1})
    assert response.status_code == 422


def test_get_neo_404_when_no_dataset():
    response = client.get("/api/neo/does-not-exist")
    assert response.status_code == 404


def test_features_endpoint_lists_documented_definitions():
    response = client.get("/api/features")
    assert response.status_code == 200
    body = response.json()
    assert body["target_column"] == "is_potentially_hazardous_asteroid"
    assert len(body["derived_features"]) > 0


def test_explainability_reports_unavailable_without_shap_run():
    response = client.get("/api/models/random_forest/explainability")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "unavailable"
    assert "detail" in body


def test_limitations_endpoint_is_explicit_about_scope():
    response = client.get("/api/limitations")
    assert response.status_code == 200
    body = response.json()
    assert body["predicts_impacts"] is False
    assert body["is_operational_hazard_system"] is False


def test_feature_audit_endpoint_excludes_label_defining_features_from_leakage_aware_set():
    response = client.get("/api/feature-audit")
    assert response.status_code == 200
    body = response.json()
    assert body["label_defining_features"] == ["moid_au", "absolute_magnitude_h"]
    leakage_aware_columns = set(
        body["feature_sets"]["leakage_aware"]["numeric_features"]
        + body["feature_sets"]["leakage_aware"]["categorical_features"]
    )
    assert "moid_au" not in leakage_aware_columns
    assert "absolute_magnitude_h" not in leakage_aware_columns
    assert "diameter_km_mean" not in leakage_aware_columns


def test_experiments_list_reports_unavailable_without_a_benchmark_run():
    response = client.get("/api/experiments")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "unavailable"
    assert body["experiments"]["leakage_aware"]["models"]["random_forest"]["executed"] is False


def test_experiment_detail_reports_unavailable_without_a_benchmark_run():
    response = client.get("/api/experiments/leakage_aware/random_forest")
    assert response.status_code == 200
    assert response.json()["status"] == "unavailable"


def test_experiment_detail_404_on_unknown_experiment_or_model():
    assert client.get("/api/experiments/not_a_real_experiment/random_forest").status_code == 404
    assert client.get("/api/experiments/leakage_aware/not_a_real_model").status_code == 404


def test_reproducibility_endpoint_reports_seed_and_feature_sets():
    response = client.get("/api/reproducibility")
    assert response.status_code == 200
    body = response.json()
    assert body["random_seed"] == 42
    assert body["n_cv_folds"] == 5
    assert set(body["feature_sets"]) == {
        "original",
        "leakage_aware",
        "physical_kinematic_only",
        "orbital_only",
    }
