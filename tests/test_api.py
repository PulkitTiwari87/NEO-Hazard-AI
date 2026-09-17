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


def test_dataset_quality_reports_unavailable_without_ingested_data():
    response = client.get("/api/dataset/quality")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "unavailable"
    assert "detail" in body


def test_dataset_correlations_reports_unavailable_without_ingested_data():
    response = client.get("/api/dataset/correlations")
    assert response.status_code == 200
    assert response.json()["status"] == "unavailable"


def test_dataset_correlations_rejects_unknown_method():
    response = client.get("/api/dataset/correlations?method=kendall")
    assert response.status_code == 400


def test_dataset_full_reports_unavailable_without_ingested_data():
    response = client.get("/api/dataset/full")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "unavailable"
    assert body["results"] == []


def test_experiments_index_reports_unavailable_without_run():
    response = client.get("/api/experiments")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "unavailable"
    assert "experiment_definitions" in body
    assert "experiment_a_original" in body["experiment_definitions"]
    assert "experiment_b_leakage_aware" in body["experiment_definitions"]


def test_experiment_combo_endpoints_report_unavailable_without_run():
    for suffix in ["holdout", "cv", "threshold", "calibration", "errors", "explainability"]:
        response = client.get(f"/api/experiments/experiment_a_original/models/random_forest/{suffix}")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"


def test_unknown_experiment_id_returns_404():
    response = client.get("/api/experiments/not_a_real_experiment/models/random_forest/holdout")
    assert response.status_code == 404


def test_anomalies_reports_unavailable_without_run():
    response = client.get("/api/anomalies")
    assert response.status_code == 200
    assert response.json()["status"] == "unavailable"
