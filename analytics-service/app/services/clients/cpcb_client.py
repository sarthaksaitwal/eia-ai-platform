"""
CPCB real-time air quality via the India Open Government Data platform.

Dataset: "Real time Air Quality Index from various locations" (CPCB, MoEFCC)
https://data.gov.in/resource/real-time-air-quality-index-various-locations

The dataset is not searchable by coordinates, so every station record is
downloaded (a few thousand station x pollutant rows) and nearest stations are
selected in app/services/mappers/cpcb_mapper.py. Requires a data.gov.in key.
"""
from app.services.clients.http import ProviderNotConfigured, get_json

RESOURCE_ID = "3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69"
ENDPOINT = f"https://api.data.gov.in/resource/{RESOURCE_ID}"
PAGE_SIZE = 1000
MAX_PAGES = 20


async def fetch_station_records(*, api_key: str | None) -> list[dict]:
    if not api_key:
        raise ProviderNotConfigured("OGD_API_KEY is not configured.")

    records: list[dict] = []
    for _ in range(MAX_PAGES):
        page = await get_json(
            ENDPOINT,
            params={"api-key": api_key, "format": "json", "limit": PAGE_SIZE, "offset": len(records)},
        )
        batch = page.get("records") or []
        records.extend(batch)
        if not batch or len(records) >= int(page.get("total") or 0):
            break
    return records
