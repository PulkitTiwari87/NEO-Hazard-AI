"""Reproducible ingestion of real NEO data from NASA's NeoWs API.

Usage:
    python -m src.data.ingestion [--max-pages N] [--page-size N]

This module NEVER fabricates data. If the NASA API is unreachable, returns
an error, or the API key is invalid, ingestion fails loudly with a clear
exception — it does not fall back to synthetic or placeholder records.

Each run writes:
  - data/raw/neows_browse_<UTC timestamp>.json   (the raw NASA response pages, concatenated)
  - data/raw/neows_browse_<UTC timestamp>.metadata.json  (provenance record)

Raw files are never overwritten or modified by later pipeline stages; the
validation stage (src.data.validation) reads the most recent raw file and
writes its own outputs to data/processed/.
"""
from __future__ import annotations

import argparse
import json
import logging
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

from src.config import settings

logger = logging.getLogger(__name__)

NEOWS_BROWSE_ENDPOINT = "/neo/browse"
MAX_RETRIES = 5
BACKOFF_BASE_SECONDS = 2.0


class IngestionError(RuntimeError):
    """Raised when real NEO data cannot be retrieved. Never caught to fabricate substitutes."""


@dataclass
class RetrievalMetadata:
    source_name: str
    source_url: str
    api_version: str
    retrieval_started_utc: str
    retrieval_finished_utc: str
    pages_fetched: int
    records_fetched: int
    requested_page_size: int
    max_pages_requested: int | None


def _get_with_retry(session: requests.Session, url: str, params: dict[str, Any]) -> dict[str, Any]:
    last_exc: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = session.get(url, params=params, timeout=30)
        except requests.RequestException as exc:
            last_exc = exc
            logger.warning("Request error on attempt %d/%d: %s", attempt, MAX_RETRIES, exc)
        else:
            if response.status_code == 200:
                return response.json()
            if response.status_code == 429:
                logger.warning("Rate limited (429) on attempt %d/%d.", attempt, MAX_RETRIES)
            elif response.status_code in (401, 403):
                raise IngestionError(
                    f"NASA API rejected the request with status {response.status_code}. "
                    f"Check NASA_API_KEY. Response body: {response.text[:500]}"
                )
            else:
                last_exc = IngestionError(
                    f"NASA API returned unexpected status {response.status_code}: {response.text[:500]}"
                )
                logger.warning("%s", last_exc)
        time.sleep(BACKOFF_BASE_SECONDS * (2 ** (attempt - 1)))
    raise IngestionError(
        f"Failed to fetch {url} after {MAX_RETRIES} attempts."
    ) from last_exc


def fetch_neows_browse(
    max_pages: int | None = None,
    page_size: int = 20,
    api_key: str | None = None,
    base_url: str | None = None,
) -> tuple[list[dict[str, Any]], RetrievalMetadata]:
    """Fetch all (or up to max_pages) pages of NASA's NeoWs `neo/browse` endpoint.

    Returns the raw list of NEO JSON objects exactly as NASA returns them,
    plus retrieval provenance metadata. Raises IngestionError on any failure
    rather than returning partial or substitute data silently.
    """
    api_key = api_key or settings.nasa_api_key
    base_url = base_url or settings.nasa_neows_base_url
    # Diagnostic only: confirms whether a custom key reached the process
    # without ever logging the key itself.
    logger.info(
        "NASA_API_KEY in use: %s",
        "DEMO_KEY (default)" if api_key == "DEMO_KEY" else f"custom key (length={len(api_key)})",
    )
    url = f"{base_url}{NEOWS_BROWSE_ENDPOINT}"

    if not api_key:
        raise IngestionError("NASA_API_KEY is not set. Set it in .env (see .env.example).")

    started = datetime.now(timezone.utc).isoformat()
    session = requests.Session()

    all_records: list[dict[str, Any]] = []
    page = 0
    total_pages: int | None = None

    while True:
        if max_pages is not None and page >= max_pages:
            break
        payload = _get_with_retry(
            session, url, params={"api_key": api_key, "page": page, "size": page_size}
        )
        near_earth_objects = payload.get("near_earth_objects")
        if near_earth_objects is None:
            raise IngestionError(
                f"Unexpected NeoWs response shape: missing 'near_earth_objects' key. "
                f"Keys present: {list(payload.keys())}"
            )
        all_records.extend(near_earth_objects)

        page_info = payload.get("page", {})
        total_pages = page_info.get("total_pages", total_pages)
        page += 1
        if total_pages is not None and page >= total_pages:
            break

    finished = datetime.now(timezone.utc).isoformat()
    metadata = RetrievalMetadata(
        source_name="NASA NeoWs (Near Earth Object Web Service)",
        source_url=url,
        api_version="v1",
        retrieval_started_utc=started,
        retrieval_finished_utc=finished,
        pages_fetched=page,
        records_fetched=len(all_records),
        requested_page_size=page_size,
        max_pages_requested=max_pages,
    )
    return all_records, metadata


def save_raw(records: list[dict[str, Any]], metadata: RetrievalMetadata, output_dir: Path | None = None) -> Path:
    output_dir = output_dir or settings.raw_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    data_path = output_dir / f"neows_browse_{timestamp}.json"
    metadata_path = output_dir / f"neows_browse_{timestamp}.metadata.json"

    data_path.write_text(json.dumps(records, indent=2))
    metadata_path.write_text(json.dumps(asdict(metadata), indent=2))

    logger.info("Wrote %d raw records to %s", len(records), data_path)
    return data_path


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Ingest real NEO data from NASA's NeoWs API.")
    parser.add_argument("--max-pages", type=int, default=None, help="Limit the number of pages fetched.")
    parser.add_argument("--page-size", type=int, default=20, help="Records per page (NeoWs max is 20).")
    args = parser.parse_args()

    records, metadata = fetch_neows_browse(max_pages=args.max_pages, page_size=args.page_size)
    path = save_raw(records, metadata)
    print(f"Ingested {metadata.records_fetched} records across {metadata.pages_fetched} pages -> {path}")


if __name__ == "__main__":
    main()
