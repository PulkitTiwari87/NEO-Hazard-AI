"""Schema definitions for NASA's NeoWs (Near Earth Object Web Service) API.

Source: https://api.nasa.gov (NeoWs "Browse" and "Lookup" endpoints), as
described in NASA's own public API documentation. These models describe the
JSON contract NASA publishes for that API — they are NOT derived from any
sample dataset and do not encode any observation values. Field names,
nesting, and the fact that several numeric fields are transmitted as JSON
strings (e.g. "eccentricity": "0.223") all come directly from that published
API contract.

IMPORTANT: this schema has not yet been reconciled against a live API
response in this environment, because outbound network access to
api.nasa.gov is currently blocked by this session's egress policy (see
docs/DATA_SOURCE.md). All fields are declared Optional so that
src.data.validation can detect and report any drift between this documented
schema and whatever NASA actually returns once ingestion is run, rather than
crashing or silently coercing values.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class DiameterRange(BaseModel):
    estimated_diameter_min: Optional[float] = None
    estimated_diameter_max: Optional[float] = None


class EstimatedDiameter(BaseModel):
    kilometers: Optional[DiameterRange] = None
    meters: Optional[DiameterRange] = None
    miles: Optional[DiameterRange] = None
    feet: Optional[DiameterRange] = None


class RelativeVelocity(BaseModel):
    kilometers_per_second: Optional[str] = None
    kilometers_per_hour: Optional[str] = None
    miles_per_hour: Optional[str] = None


class MissDistance(BaseModel):
    astronomical: Optional[str] = None
    lunar: Optional[str] = None
    kilometers: Optional[str] = None
    miles: Optional[str] = None


class CloseApproachData(BaseModel):
    close_approach_date: Optional[str] = None
    close_approach_date_full: Optional[str] = None
    epoch_date_close_approach: Optional[int] = None
    relative_velocity: Optional[RelativeVelocity] = None
    miss_distance: Optional[MissDistance] = None
    orbiting_body: Optional[str] = None


class OrbitClass(BaseModel):
    orbit_class_type: Optional[str] = None
    orbit_class_description: Optional[str] = None
    orbit_class_range: Optional[str] = None


class OrbitalData(BaseModel):
    orbit_id: Optional[str] = None
    orbit_determination_date: Optional[str] = None
    first_observation_date: Optional[str] = None
    last_observation_date: Optional[str] = None
    data_arc_in_days: Optional[float] = None
    observations_used: Optional[int] = None
    orbit_uncertainty: Optional[str] = None
    minimum_orbit_intersection: Optional[str] = Field(
        default=None, description="MOID with Earth's orbit, in astronomical units (au)."
    )
    jupiter_tisserand_invariant: Optional[str] = None
    epoch_osculation: Optional[str] = None
    eccentricity: Optional[str] = None
    semi_major_axis: Optional[str] = None
    inclination: Optional[str] = None
    ascending_node_longitude: Optional[str] = None
    orbital_period: Optional[str] = None
    perihelion_distance: Optional[str] = None
    perihelion_argument: Optional[str] = None
    aphelion_distance: Optional[str] = None
    perihelion_time: Optional[str] = None
    mean_anomaly: Optional[str] = None
    mean_motion: Optional[str] = None
    equinox: Optional[str] = None
    orbit_class: Optional[OrbitClass] = None


class NearEarthObject(BaseModel):
    """One record from NeoWs `neo/browse` or `neo/{id}` (lookup)."""

    id: str
    neo_reference_id: Optional[str] = None
    name: Optional[str] = None
    designation: Optional[str] = None
    nasa_jpl_url: Optional[str] = None
    absolute_magnitude_h: Optional[float] = None
    estimated_diameter: Optional[EstimatedDiameter] = None
    is_potentially_hazardous_asteroid: Optional[bool] = Field(
        default=None,
        description=(
            "NASA/JPL-provided classification. See docs/LIMITATIONS.md: this "
            "flag reflects orbital criteria (MOID and absolute magnitude "
            "thresholds) used by JPL/CNEOS, and does NOT mean an impact is "
            "predicted or likely."
        ),
    )
    is_sentry_object: Optional[bool] = None
    close_approach_data: list[CloseApproachData] = Field(default_factory=list)
    orbital_data: Optional[OrbitalData] = None


REQUIRED_FIELDS = (
    "id",
    "absolute_magnitude_h",
    "is_potentially_hazardous_asteroid",
)
