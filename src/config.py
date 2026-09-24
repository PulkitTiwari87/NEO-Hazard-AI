"""Centralized configuration for the NEO-Hazard-AI pipeline.

All values are read from environment variables (see .env.example) so that no
credentials or machine-specific paths are hardcoded in source.
"""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    nasa_api_key: str = "DEMO_KEY"
    nasa_neows_base_url: str = "https://api.nasa.gov/neo/rest/v1"
    nasa_sbdb_base_url: str = "https://ssd-api.jpl.nasa.gov/sbdb_query.api"

    data_raw_dir: str = "data/raw"
    data_processed_dir: str = "data/processed"
    model_registry_dir: str = "model_registry"
    results_dir: str = "results"

    random_seed: int = 42

    def resolve(self, relative: str) -> Path:
        path = Path(relative)
        return path if path.is_absolute() else REPO_ROOT / path

    @property
    def raw_dir(self) -> Path:
        return self.resolve(self.data_raw_dir)

    @property
    def processed_dir(self) -> Path:
        return self.resolve(self.data_processed_dir)

    @property
    def model_registry_path(self) -> Path:
        return self.resolve(self.model_registry_dir)

    @property
    def results_path(self) -> Path:
        return self.resolve(self.results_dir)


settings = Settings()

PROCESSED_DATASET_PATH = settings.processed_dir / "neo_dataset.csv"
VALIDATION_REPORT_PATH = settings.processed_dir / "validation_report.json"
MODEL_METRICS_PATH = settings.results_path / "model_metrics.json"
