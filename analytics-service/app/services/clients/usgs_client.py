"""
Thin client around the USGS Earthquake Catalog (ComCat) FDSN event API
(https://earthquake.usgs.gov/fdsnws/event/1/).

Provides historical seismicity near a site. It is context only: the
regulatory seismic zone in India comes from BIS IS 1893 / GSI maps.
"""
from datetime import date

from app.services.clients.http import get_json

EVENT_ENDPOINT = "https://earthquake.usgs.gov/fdsnws/event/1/query"


async def search_earthquakes(
    latitude: float, longitude: float, *, radius_km: float, min_magnitude: float, start_date: date
) -> dict:
    return await get_json(
        EVENT_ENDPOINT,
        params={
            "format": "geojson",
            "latitude": latitude,
            "longitude": longitude,
            "maxradiuskm": radius_km,
            "minmagnitude": min_magnitude,
            "starttime": start_date.isoformat(),
            "orderby": "magnitude",
            "limit": 2000,
        },
    )
