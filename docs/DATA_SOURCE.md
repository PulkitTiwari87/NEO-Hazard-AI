# Data Source

## Primary source

- **Source name:** NASA NeoWs — Near Earth Object Web Service
- **Source URL:** https://api.nasa.gov (endpoint used: `GET /neo/rest/v1/neo/browse`)
- **Operator:** NASA, via the api.nasa.gov developer portal. NeoWs itself is
  built from data maintained by NASA JPL's Center for Near-Earth Object
  Studies (CNEOS) / the Small-Body Database.
- **Access method:** REST API, JSON responses, paginated (`page`, `size`
  query parameters), authenticated with an API key (`DEMO_KEY` or a
  personal key registered at api.nasa.gov).
- **Retrieval implementation:** `src/data/ingestion.py`
  (`python -m src.data.ingestion`).
- **Retrieval date / dataset version:** **not yet run.** See "Current
  status" below.

## Supplementary source (referenced, not yet integrated)

- **Source name:** JPL Small-Body Database (SBDB) Query API
- **Source URL:** https://ssd-api.jpl.nasa.gov/sbdb_query.api
- **Why it's relevant:** SBDB is queried directly against JPL's database
  (the authoritative origin of the `pha` — potentially hazardous asteroid —
  flag and full osculating orbital elements) rather than through NASA's
  NeoWs wrapper. It could be a useful cross-check or alternative ingestion
  path in the future. No ingestion code targets it yet.

## Current status (be exact — do not round up)

**In this dev checkout:** no ingestion has been executed, because this
sandboxed environment's network egress policy blocks both `api.nasa.gov`
and `ssd-api.jpl.nasa.gov` (confirmed via direct connectivity tests; both
domains, and general internet access, returned `403` from the egress
proxy — general package registries such as PyPI and npm remained
reachable). `data/raw/` and `data/processed/` here are empty except for
`.gitkeep` files. This is a network policy restriction of this specific
execution environment, not a property of the NASA API or of this
codebase.

**In production (Render):** the `neo-hazard-ai-backend` deployment has
normal internet access, and its `start.sh` runs real ingestion on every
boot. On 2026-09-17 it successfully retrieved 500 real objects (25 pages
of `neo/browse`, `NEOWS_MAX_PAGES=25`) using a real NASA API key,
timestamped `neows_browse_20260917T165500Z.json`, validated cleanly (0
rows dropped), and fed the rest of the pipeline — see
`docs/MODEL_CARD.md` for the resulting real metrics. That data lives only
on Render's ephemeral instance disk (not in this git repo, and not
persisted across redeploys — each boot re-ingests fresh), so the exact
500 objects retrieved that day are not reproducible byte-for-byte, though
the pipeline and its behavior are.

## How to actually run ingestion

```bash
cp .env.example .env
# edit .env and set NASA_API_KEY to your key from https://api.nasa.gov
python -m src.data.ingestion         # fetch all pages of neo/browse
python -m src.data.validation        # flatten, validate, clean -> data/processed/neo_dataset.csv
```

## Documented schema (per NASA's published API contract)

The NeoWs `neo/browse` response nests each object as:

```
{
  "id": "...",
  "name": "...",
  "absolute_magnitude_h": <float>,
  "estimated_diameter": {"kilometers": {"estimated_diameter_min": <float>, "estimated_diameter_max": <float>}, ...},
  "is_potentially_hazardous_asteroid": <bool>,
  "is_sentry_object": <bool>,
  "close_approach_data": [
    {"close_approach_date": "...", "relative_velocity": {"kilometers_per_second": "<string float>"}, "miss_distance": {"kilometers": "<string float>"}, "orbiting_body": "Earth"}, ...
  ],
  "orbital_data": {
    "eccentricity": "<string float>", "semi_major_axis": "<string float>", "inclination": "<string float>",
    "minimum_orbit_intersection": "<string float>",  // MOID, astronomical units
    "orbital_period": "<string float>", "perihelion_distance": "<string float>", "aphelion_distance": "<string float>",
    "mean_anomaly": "<string float>", "mean_motion": "<string float>",
    "orbit_class": {"orbit_class_type": "..."}
  }
}
```

This is documented in `src/data/schema.py` as a set of permissive Pydantic
models (every field `Optional`) specifically so that `src/data/validation.py`
can detect and report schema drift the first time a real response is
fetched, rather than crashing or silently coercing unexpected values. NASA
transmits many numeric orbital/kinematic fields as JSON **strings**, which
`src/data/validation.py` parses defensively (`_to_float`, returning `None`
on failure rather than raising or fabricating a number).

## Units

| Field | Unit |
|---|---|
| `absolute_magnitude_h` | magnitude (dimensionless, logarithmic brightness scale) |
| `estimated_diameter.kilometers.*` | kilometers |
| `relative_velocity.kilometers_per_second` | km/s |
| `miss_distance.kilometers` | kilometers |
| `minimum_orbit_intersection` (MOID) | astronomical units (au) |
| `semi_major_axis`, `perihelion_distance`, `aphelion_distance` | astronomical units (au) |
| `inclination`, `ascending_node_longitude`, `mean_anomaly` | degrees |
| `orbital_period` | days |
| `mean_motion` | degrees/day |
| `data_arc_in_days` | days |

## Licensing / usage

NASA API data accessed via api.nasa.gov is public domain U.S. Government
data. api.nasa.gov's own terms (rate limits per key) apply to the API
itself, not to the underlying data.

## Limitations of this source

See `docs/LIMITATIONS.md` for how NASA's `is_potentially_hazardous_asteroid`
flag should and should not be interpreted.
