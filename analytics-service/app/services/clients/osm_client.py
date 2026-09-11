"""
Runs Overpass QL queries against OpenStreetMap (https://wiki.openstreetmap.org/wiki/Overpass_API).

Public Overpass instances are frequently overloaded (504s, or a 200 response
whose "remark" reports a timeout with partial data), so each configured
endpoint is tried in order until one returns a complete result. The query
itself is built in app/services/mappers/osm_mapper.py.
"""
import logging

import httpx

from app.config import settings
from app.services.clients.http import async_client

logger = logging.getLogger(__name__)


class OverpassError(Exception):
    pass


async def run_query(query: str) -> dict:
    errors: list[str] = []
    for endpoint in settings.overpass_endpoint_list:
        try:
            async with async_client(timeout=settings.overpass_timeout_seconds + 15) as client:
                response = await client.post(endpoint, data={"data": query})
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else type(exc).__name__
            errors.append(f"{httpx.URL(endpoint).host}: {status}")
            logger.warning("Overpass endpoint %s failed: %s", endpoint, status)
            continue

        remark = payload.get("remark") or ""
        if "error" in remark.lower():
            # Partial results would silently under-report nearby features.
            errors.append(f"{httpx.URL(endpoint).host}: {remark[:120]}")
            logger.warning("Overpass endpoint %s returned an incomplete result: %s", endpoint, remark)
            continue
        return payload

    raise OverpassError("All Overpass endpoints failed (" + "; ".join(errors or ["none configured"]) + ").")
