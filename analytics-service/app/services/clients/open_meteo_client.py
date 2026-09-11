"""
Thin client around Open-Meteo's free, key-less APIs.

Air Quality API:        https://open-meteo.com/en/docs/air-quality-api
Weather (forecast) API: https://open-meteo.com/en/docs
Historical Weather API: https://open-meteo.com/en/docs/historical-weather-api
Climate Change API:     https://open-meteo.com/en/docs/climate-api
Elevation API:          https://open-meteo.com/en/docs/elevation-api
Flood API:              https://open-meteo.com/en/docs/flood-api

Retrieval only - no calculation or interpretation happens in this module.
Raw responses are mapped in app/services/mappers/open_meteo_mapper.py.
All times are requested in GMT so the mapper can treat them as UTC.
"""
from datetime import date
from typing import Sequence

from app.services.clients.http import get_json

AIR_QUALITY_ENDPOINT = "https://air-quality-api.open-meteo.com/v1/air-quality"
WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_ENDPOINT = "https://archive-api.open-meteo.com/v1/archive"
CLIMATE_ENDPOINT = "https://climate-api.open-meteo.com/v1/climate"
ELEVATION_ENDPOINT = "https://api.open-meteo.com/v1/elevation"
FLOOD_ENDPOINT = "https://flood-api.open-meteo.com/v1/flood"

AIR_QUALITY_PARAMS = "pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone"
WEATHER_PARAMS = (
    "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,"
    "surface_pressure,cloud_cover,shortwave_radiation,et0_fao_evapotranspiration,"
    "soil_moisture_0_to_1cm,soil_temperature_0cm,boundary_layer_height"
)
HISTORICAL_DAILY_PARAMS = (
    "temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,"
    "shortwave_radiation_sum,et0_fao_evapotranspiration,wind_speed_10m_max,wind_direction_10m_dominant"
)
# Two independent high-resolution CMIP6 models, both covering 1950-2050.
CLIMATE_MODELS = "MRI_AGCM3_2_S,EC_Earth3P_HR"
CLIMATE_DAILY_PARAMS = "temperature_2m_mean,precipitation_sum"


async def fetch_air_quality(latitude: float, longitude: float) -> dict:
    return await get_json(
        AIR_QUALITY_ENDPOINT,
        params={"latitude": latitude, "longitude": longitude, "current": AIR_QUALITY_PARAMS, "timezone": "GMT"},
    )


async def fetch_weather(latitude: float, longitude: float) -> dict:
    return await get_json(
        WEATHER_ENDPOINT,
        params={"latitude": latitude, "longitude": longitude, "current": WEATHER_PARAMS, "timezone": "GMT"},
    )


async def fetch_historical_daily(latitude: float, longitude: float, start_date: date, end_date: date) -> dict:
    return await get_json(
        ARCHIVE_ENDPOINT,
        params={
            "latitude": latitude,
            "longitude": longitude,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "daily": HISTORICAL_DAILY_PARAMS,
            "timezone": "GMT",
        },
    )


async def fetch_climate_projection(latitude: float, longitude: float, start_date: date, end_date: date) -> dict:
    return await get_json(
        CLIMATE_ENDPOINT,
        params={
            "latitude": latitude,
            "longitude": longitude,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "models": CLIMATE_MODELS,
            "daily": CLIMATE_DAILY_PARAMS,
        },
    )


async def fetch_elevation(points: Sequence[tuple[float, float]]) -> dict:
    """Elevation for several (latitude, longitude) points in one request."""
    return await get_json(
        ELEVATION_ENDPOINT,
        params={
            "latitude": ",".join(f"{lat:.6f}" for lat, _ in points),
            "longitude": ",".join(f"{lon:.6f}" for _, lon in points),
        },
    )


async def fetch_river_discharge(latitude: float, longitude: float, start_date: date, end_date: date) -> dict:
    return await get_json(
        FLOOD_ENDPOINT,
        params={
            "latitude": latitude,
            "longitude": longitude,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "daily": "river_discharge",
        },
    )
