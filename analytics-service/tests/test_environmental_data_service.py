import asyncio

import httpx
import pytest

from app.config import settings
from app.services import environmental_data_service as service
from app.services.clients import (
    cpcb_client,
    open_meteo_client,
    openaq_client,
    osm_client,
    soilgrids_client,
    usgs_client,
    worldpop_client,
)
from app.services.clients.http import ProviderNotConfigured
from app.services.distance_service import haversine_m

SITE = (28.6139, 77.209)


@pytest.fixture
def fake_providers(monkeypatch):
    async def air_quality(latitude, longitude):
        return {"current": {"time": "2026-09-10T16:00", "pm2_5": 98.7}, "current_units": {"pm2_5": "μg/m³"}}

    async def weather(latitude, longitude):
        return {"current": {"time": "2026-09-10T16:45", "temperature_2m": 29.4}, "current_units": {"temperature_2m": "°C"}}

    async def empty(*args, **kwargs):
        return {}

    async def elevation(points):
        return {"elevation": [214.0] * 5}

    async def overpass(query):
        return {"elements": []}

    async def classification(latitude, longitude):
        return {"wrb_class_name": "Cambisols"}

    async def population(ring):
        return {"data": {"total_population": 1000.0}}

    async def earthquakes(*args, **kwargs):
        return {"features": []}

    async def openaq_search(*args, api_key, **kwargs):
        if not api_key:
            raise ProviderNotConfigured("OPENAQ_API_KEY is not configured.")
        return {"results": []}

    async def cpcb_records(*, api_key):
        request = httpx.Request("GET", "https://api.data.gov.in/resource/x?api-key=SECRET-KEY")
        raise httpx.HTTPStatusError("Bad Gateway", request=request, response=httpx.Response(502, request=request))

    for module, name, function in [
        (open_meteo_client, "fetch_air_quality", air_quality),
        (open_meteo_client, "fetch_weather", weather),
        (open_meteo_client, "fetch_historical_daily", empty),
        (open_meteo_client, "fetch_climate_projection", empty),
        (open_meteo_client, "fetch_elevation", elevation),
        (open_meteo_client, "fetch_river_discharge", empty),
        (osm_client, "run_query", overpass),
        (soilgrids_client, "fetch_properties", empty),
        (soilgrids_client, "fetch_classification", classification),
        (worldpop_client, "fetch_population", population),
        (usgs_client, "search_earthquakes", earthquakes),
        (openaq_client, "search_locations", openaq_search),
        (cpcb_client, "fetch_station_records", cpcb_records),
    ]:
        monkeypatch.setattr(module, name, function)
    monkeypatch.setattr(settings, "openaq_api_key", None)


def statuses(result):
    return {provider["source_key"]: provider["status"] for provider in result["providers"]}


async def test_collect_reports_every_provider_and_splits_records(fake_providers):
    result = await service.collect_environmental_data(*SITE, assessment_id="a-1")

    assert statuses(result) == {
        "openaq": "skipped",
        "cpcb_ogd": "error",
        "open_meteo_air_quality": "available",
        "open_meteo_weather": "available",
        "open_meteo_archive": "unavailable",
        "open_meteo_climate": "unavailable",
        "open_meteo_elevation": "available",
        "open_meteo_flood": "unavailable",
        "osm_overpass": "available",  # explicit "none found" findings
        "soilgrids_properties": "unavailable",
        "soilgrids_classification": "available",
        "worldpop": "available",
        "usgs_earthquakes": "available",
    }
    assert {row["parameter"] for row in result["observations"]} == {"pm25", "air_temperature", "soil_type"}
    assert {"elevation", "population_within_1km", "earthquake_count", "nearest_river"} <= {
        row["feature_type"] for row in result["gis_features"]
    }
    assert len(result["sections"]) == 13
    assert result["required_inputs"]
    assert result["request"] == {"assessment_id": "a-1", "latitude": SITE[0], "longitude": SITE[1], "radius_km": settings.default_radius_km}


async def test_error_reasons_never_include_urls_or_keys(fake_providers):
    result = await service.collect_environmental_data(*SITE)
    cpcb = next(provider for provider in result["providers"] if provider["source_key"] == "cpcb_ogd")
    assert cpcb["reason"] == "HTTP 502 from api.data.gov.in"
    assert "SECRET-KEY" not in str(result)


async def test_unexpected_exception_is_isolated(fake_providers, monkeypatch):
    async def broken(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(usgs_client, "search_earthquakes", broken)
    result = await service.collect_environmental_data(*SITE)
    usgs = next(provider for provider in result["providers"] if provider["source_key"] == "usgs_earthquakes")
    assert (usgs["status"], usgs["reason"]) == ("error", "boom")
    assert statuses(result)["open_meteo_weather"] == "available"


async def test_slow_provider_hits_deadline(fake_providers, monkeypatch):
    async def slow(latitude, longitude):
        await asyncio.sleep(1)

    monkeypatch.setattr(settings, "provider_deadline_seconds", 0.05)
    monkeypatch.setattr(soilgrids_client, "fetch_classification", slow)
    result = await service.collect_environmental_data(*SITE)
    soil = next(provider for provider in result["providers"] if provider["source_key"] == "soilgrids_classification")
    assert (soil["status"], soil["reason"]) == ("error", "No result within 0.05 s.")


async def test_partial_worldpop_failure_becomes_warning(fake_providers, monkeypatch):
    async def population(ring):
        if haversine_m(SITE, ring[0]) > 9_000:
            raise httpx.ReadTimeout("slow")
        return {"data": {"total_population": 500.0}}

    monkeypatch.setattr(worldpop_client, "fetch_population", population)
    result = await service.collect_environmental_data(*SITE)
    assert statuses(result)["worldpop"] == "available"
    assert "WorldPop 10 km buffer: Request timed out." in result["warnings"]
    assert "population_within_10km" not in {row["feature_type"] for row in result["gis_features"]}
