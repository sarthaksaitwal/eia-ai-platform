"""
Thin client around the WorldPop statistics API (https://www.worldpop.org/sdi/introapi).

Returns total population inside a polygon from the WorldPop Global 100 m
population grid. Census of India has no coordinate API, so this is used as
the gridded population source.
"""
import json
from typing import Sequence

from app.services.clients.http import get_json

STATS_ENDPOINT = "https://api.worldpop.org/v1/services/stats"
DATASET = "wpgppop"
YEAR = 2020  # latest year available for the global per-country dataset
TIMEOUT_SECONDS = 120.0


async def fetch_population(ring: Sequence[tuple[float, float]]) -> dict:
    """ring is a closed list of (latitude, longitude) points."""
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {},
                "geometry": {"type": "Polygon", "coordinates": [[[round(lon, 6), round(lat, 6)] for lat, lon in ring]]},
            }
        ],
    }
    payload = await get_json(
        STATS_ENDPOINT,
        params={"dataset": DATASET, "year": YEAR, "geojson": json.dumps(geojson, separators=(",", ":")), "runasync": "false"},
        timeout=TIMEOUT_SECONDS,
    )
    if payload.get("error"):
        raise ValueError(f"WorldPop error: {payload.get('error_message')}")
    return payload
