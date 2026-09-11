"""
Thin client around the OpenAQ v3 API (https://docs.openaq.org).

OpenAQ aggregates values *measured* at ground monitoring stations. Two calls
are needed for a site:

  1. GET /v3/locations?coordinates=lat,lon&radius=m  -> nearby stations, each
     listing its sensors (sensor id -> parameter + units)
  2. GET /v3/locations/{id}/latest                   -> last value per sensor

Retrieval only - joining the two into observations lives in
app/services/mappers/openaq_mapper.py. v3 requires an X-API-Key header.
"""
from app.services.clients.http import ProviderNotConfigured, get_json

BASE_URL = "https://api.openaq.org/v3"
LOCATIONS_ENDPOINT = f"{BASE_URL}/locations"
MAX_RADIUS_M = 25_000


def _headers(api_key: str | None) -> dict[str, str]:
    if not api_key:
        raise ProviderNotConfigured("OPENAQ_API_KEY is not configured.")
    return {"X-API-Key": api_key}


async def search_locations(latitude: float, longitude: float, *, api_key: str | None, radius_m: float, limit: int = 100) -> dict:
    headers = _headers(api_key)
    if not 0 < radius_m <= MAX_RADIUS_M:
        raise ValueError(f"OpenAQ radius must be between 1 and {MAX_RADIUS_M} m.")
    return await get_json(
        LOCATIONS_ENDPOINT,
        params={"coordinates": f"{latitude},{longitude}", "radius": int(radius_m), "limit": limit},
        headers=headers,
    )


async def fetch_location_latest(location_id: int, *, api_key: str | None) -> dict:
    return await get_json(f"{LOCATIONS_ENDPOINT}/{location_id}/latest", headers=_headers(api_key))
