"""
Collects every item of the environmental data specification that can
legitimately be derived for a latitude/longitude.

Stateless: no database access. The Node backend persists the returned
observations (environmental_data), gis_features (gis_analysis_results) and
provider outcomes (data_sources + data_fetch_logs).

Providers run concurrently and fail independently. Each reports one of
available / unavailable / error / skipped, so a missing value is never
invented or silently dropped.
"""
import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Awaitable, Callable, Optional

import httpx

from app.config import settings
from app.services import catalogue
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
from app.services.distance_service import circle_polygon
from app.services.mappers import (
    cpcb_mapper,
    open_meteo_mapper,
    openaq_mapper,
    osm_mapper,
    soilgrids_mapper,
    usgs_mapper,
    worldpop_mapper,
)

logger = logging.getLogger(__name__)

POPULATION_RADII_M = (1_000, 5_000, 10_000)
POPULATION_VERTICES = 32
PROJECTION_PERIOD = (date(2001, 1, 1), date(2049, 12, 31))

# Stable keys the Node backend uses to find-or-create data_sources rows.
DATA_SOURCES: dict[str, dict[str, Optional[str]]] = {
    "openaq": {"name": "OpenAQ API v3", "provider": "OpenAQ", "source_type": "api", "endpoint": openaq_client.BASE_URL},
    "cpcb_ogd": {"name": "CPCB Real-time AQI (data.gov.in)", "provider": "CPCB / India OGD", "source_type": "api",
                 "endpoint": cpcb_client.ENDPOINT},
    "open_meteo_air_quality": {"name": "Open-Meteo Air Quality API", "provider": "Open-Meteo", "source_type": "api",
                               "endpoint": open_meteo_client.AIR_QUALITY_ENDPOINT},
    "open_meteo_weather": {"name": "Open-Meteo Weather API", "provider": "Open-Meteo", "source_type": "api",
                           "endpoint": open_meteo_client.WEATHER_ENDPOINT},
    "open_meteo_archive": {"name": "Open-Meteo Historical Weather API (ERA5)", "provider": "Open-Meteo", "source_type": "api",
                           "endpoint": open_meteo_client.ARCHIVE_ENDPOINT},
    "open_meteo_climate": {"name": "Open-Meteo Climate Change API (CMIP6)", "provider": "Open-Meteo", "source_type": "api",
                           "endpoint": open_meteo_client.CLIMATE_ENDPOINT},
    "open_meteo_elevation": {"name": "Open-Meteo Elevation API (Copernicus DEM)", "provider": "Open-Meteo", "source_type": "api",
                             "endpoint": open_meteo_client.ELEVATION_ENDPOINT},
    "open_meteo_flood": {"name": "Open-Meteo Flood API (GloFAS)", "provider": "Open-Meteo", "source_type": "api",
                         "endpoint": open_meteo_client.FLOOD_ENDPOINT},
    "osm_overpass": {"name": "OpenStreetMap Overpass API", "provider": "OpenStreetMap", "source_type": "gis_api",
                     "endpoint": (settings.overpass_endpoint_list or [None])[0]},
    "soilgrids_properties": {"name": "SoilGrids v2.0 Soil Properties", "provider": "ISRIC", "source_type": "api",
                             "endpoint": soilgrids_client.PROPERTIES_ENDPOINT},
    "soilgrids_classification": {"name": "SoilGrids v2.0 WRB Classification", "provider": "ISRIC", "source_type": "api",
                                 "endpoint": soilgrids_client.CLASSIFICATION_ENDPOINT},
    "worldpop": {"name": "WorldPop Statistics API", "provider": "WorldPop", "source_type": "api",
                 "endpoint": worldpop_client.STATS_ENDPOINT},
    "usgs_earthquakes": {"name": "USGS Earthquake Catalog", "provider": "USGS", "source_type": "api",
                         "endpoint": usgs_client.EVENT_ENDPOINT},
}


@dataclass
class ProviderResult:
    records: list[dict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    empty_reason: str = "The provider returned no usable values for this location."


def describe_error(exc: BaseException) -> str:
    # Never include full URLs: data.gov.in takes its API key as a query parameter.
    if isinstance(exc, httpx.HTTPStatusError):
        return f"HTTP {exc.response.status_code} from {exc.request.url.host}"
    if isinstance(exc, httpx.TimeoutException):
        return "Request timed out."
    if isinstance(exc, httpx.RequestError):
        return f"{type(exc).__name__} while contacting the provider."
    if isinstance(exc, asyncio.TimeoutError):
        return f"No result within {settings.provider_deadline_seconds:g} s."
    return str(exc) or type(exc).__name__


async def _run_provider(
    source_key: str, request_parameters: dict, work: Callable[[], Awaitable[ProviderResult]]
) -> tuple[dict, ProviderResult]:
    started = time.monotonic()
    result = ProviderResult()
    status, reason = catalogue.AVAILABLE, None
    try:
        result = await asyncio.wait_for(work(), timeout=settings.provider_deadline_seconds)
    except ProviderNotConfigured as exc:
        status, reason = catalogue.SKIPPED, str(exc)
    except Exception as exc:  # noqa: BLE001 - one failing provider must not fail the others
        status, reason = catalogue.ERROR, describe_error(exc)
        if isinstance(exc, (httpx.HTTPError, asyncio.TimeoutError, osm_client.OverpassError)):
            logger.warning("%s failed: %s", source_key, reason)
        else:
            logger.exception("Unexpected error while collecting %s", source_key)
    else:
        if not result.records:
            status, reason = catalogue.UNAVAILABLE, result.empty_reason

    outcome = {
        "source_key": source_key,
        **DATA_SOURCES[source_key],
        "status": status,
        "reason": reason,
        "record_count": len(result.records),
        "response_time_ms": int((time.monotonic() - started) * 1000),
        "request_parameters": request_parameters,
    }
    return outcome, result


async def collect_environmental_data(
    latitude: float, longitude: float, *, radius_km: Optional[float] = None, assessment_id: Optional[str] = None
) -> dict:
    started = time.monotonic()
    now = datetime.now(timezone.utc)
    origin = (latitude, longitude)
    radius_km = radius_km or settings.default_radius_km
    radius_m = radius_km * 1000
    max_age_days = settings.max_observation_age_days

    coordinates = {"latitude": latitude, "longitude": longitude}
    history_start = date(now.year - settings.climate_history_years, 1, 1)
    history_end = date(now.year - 1, 12, 31)
    history = {**coordinates, "start_date": history_start.isoformat(), "end_date": history_end.isoformat()}

    async def openaq() -> ProviderResult:
        raw = await openaq_client.search_locations(
            latitude, longitude, api_key=settings.openaq_api_key, radius_m=min(radius_m, openaq_client.MAX_RADIUS_M)
        )
        locations, warnings = openaq_mapper.select_locations(
            raw, max_locations=settings.openaq_max_locations, max_age_days=max_age_days, now=now
        )
        latest = await asyncio.gather(
            *(openaq_client.fetch_location_latest(location["id"], api_key=settings.openaq_api_key) for location in locations),
            return_exceptions=True,
        )
        records = []
        for location, response in zip(locations, latest):
            records.append(openaq_mapper.station_feature(location))
            if isinstance(response, BaseException):
                warnings.append(f"OpenAQ station {location.get('id')}: {describe_error(response)}")
                continue
            rows, row_warnings = openaq_mapper.map_latest_measurements(location, response, max_age_days=max_age_days, now=now)
            records += rows
            warnings += row_warnings
        return ProviderResult(records, warnings, f"No OpenAQ station within {radius_km:g} km has reported in the last {max_age_days} days.")

    async def cpcb() -> ProviderResult:
        raw = await cpcb_client.fetch_station_records(api_key=settings.ogd_api_key)
        stations, warnings = cpcb_mapper.select_stations(
            raw, origin=origin, radius_m=radius_m, max_stations=settings.cpcb_max_stations, max_age_days=max_age_days, now=now
        )
        records = []
        for station in stations:
            records.append(cpcb_mapper.station_feature(station))
            rows, row_warnings = cpcb_mapper.map_station_observations(station)
            records += rows
            warnings += row_warnings
        return ProviderResult(records, warnings, f"No CPCB station within {radius_km:g} km has reported in the last {max_age_days} days.")

    async def air_quality() -> ProviderResult:
        return ProviderResult(open_meteo_mapper.map_air_quality_response(await open_meteo_client.fetch_air_quality(latitude, longitude)))

    async def weather() -> ProviderResult:
        return ProviderResult(open_meteo_mapper.map_weather_response(await open_meteo_client.fetch_weather(latitude, longitude)))

    async def archive() -> ProviderResult:
        raw = await open_meteo_client.fetch_historical_daily(latitude, longitude, history_start, history_end)
        return ProviderResult(open_meteo_mapper.summarise_historical_climate(raw))

    async def climate() -> ProviderResult:
        raw = await open_meteo_client.fetch_climate_projection(latitude, longitude, *PROJECTION_PERIOD)
        return ProviderResult(open_meteo_mapper.summarise_climate_projection(raw))

    async def elevation() -> ProviderResult:
        raw = await open_meteo_client.fetch_elevation(open_meteo_mapper.terrain_sample_points(origin))
        return ProviderResult(open_meteo_mapper.map_terrain(raw))

    async def flood() -> ProviderResult:
        raw = await open_meteo_client.fetch_river_discharge(latitude, longitude, history_start, history_end)
        return ProviderResult(open_meteo_mapper.summarise_river_discharge(raw), empty_reason="No GloFAS river cell data for this location.")

    async def osm() -> ProviderResult:
        query = osm_mapper.build_query(origin, max_radius_m=radius_m, timeout_seconds=settings.overpass_timeout_seconds)
        return ProviderResult(osm_mapper.map_overpass_result(await osm_client.run_query(query), origin, max_radius_m=radius_m))

    async def soil_properties() -> ProviderResult:
        raw = await soilgrids_client.fetch_properties(latitude, longitude)
        return ProviderResult(
            soilgrids_mapper.map_properties(raw),
            empty_reason="SoilGrids returned no property values for this location (urban/water areas are masked).",
        )

    async def soil_classification() -> ProviderResult:
        return ProviderResult(soilgrids_mapper.map_classification(await soilgrids_client.fetch_classification(latitude, longitude)))

    async def population() -> ProviderResult:
        responses = await asyncio.gather(
            *(worldpop_client.fetch_population(circle_polygon(origin, radius, POPULATION_VERTICES)) for radius in POPULATION_RADII_M),
            return_exceptions=True,
        )
        records, warnings = [], []
        for radius, response in zip(POPULATION_RADII_M, responses):
            if isinstance(response, BaseException):
                warnings.append(f"WorldPop {radius / 1000:g} km buffer: {describe_error(response)}")
                continue
            records += worldpop_mapper.map_population(response, radius_m=radius, vertices=POPULATION_VERTICES)
        if not records:
            failure = next((response for response in responses if isinstance(response, BaseException)), None)
            if failure is not None:
                raise failure
        return ProviderResult(records, warnings)

    async def earthquakes() -> ProviderResult:
        raw = await usgs_client.search_earthquakes(
            latitude, longitude,
            radius_km=settings.earthquake_search_radius_km,
            min_magnitude=settings.earthquake_min_magnitude,
            start_date=date(settings.earthquake_start_year, 1, 1),
        )
        return ProviderResult(
            usgs_mapper.summarise_earthquakes(
                raw, origin,
                radius_km=settings.earthquake_search_radius_km,
                min_magnitude=settings.earthquake_min_magnitude,
                start_year=settings.earthquake_start_year,
            )
        )

    tasks = [
        ("openaq", {**coordinates, "radius_m": min(radius_m, openaq_client.MAX_RADIUS_M)}, openaq),
        ("cpcb_ogd", {**coordinates, "radius_m": radius_m, "resource_id": cpcb_client.RESOURCE_ID}, cpcb),
        ("open_meteo_air_quality", coordinates, air_quality),
        ("open_meteo_weather", coordinates, weather),
        ("open_meteo_archive", history, archive),
        ("open_meteo_climate", {**coordinates, "start_date": PROJECTION_PERIOD[0].isoformat(),
                                "end_date": PROJECTION_PERIOD[1].isoformat(), "models": open_meteo_client.CLIMATE_MODELS}, climate),
        ("open_meteo_elevation", coordinates, elevation),
        ("open_meteo_flood", history, flood),
        ("osm_overpass", {**coordinates, "radius_m": radius_m}, osm),
        ("soilgrids_properties", coordinates, soil_properties),
        ("soilgrids_classification", coordinates, soil_classification),
        ("worldpop", {**coordinates, "radii_m": list(POPULATION_RADII_M), "year": worldpop_client.YEAR}, population),
        ("usgs_earthquakes", {**coordinates, "radius_km": settings.earthquake_search_radius_km,
                              "min_magnitude": settings.earthquake_min_magnitude,
                              "start_year": settings.earthquake_start_year}, earthquakes),
    ]
    results = await asyncio.gather(*(_run_provider(key, parameters, work) for key, parameters, work in tasks))

    providers = [outcome for outcome, _ in results]
    records = [record for _, result in results for record in result.records]
    request = {"assessment_id": assessment_id, **coordinates, "radius_km": radius_km}

    return {
        "request": request,
        "retrieved_at": now,
        "duration_ms": int((time.monotonic() - started) * 1000),
        "observations": [record for record in records if "parameter" in record],
        "gis_features": [record for record in records if "feature_type" in record],
        "sections": catalogue.evaluate(records, {outcome["source_key"]: outcome for outcome in providers}, request),
        "required_inputs": catalogue.required_inputs(),
        "providers": providers,
        "warnings": [warning for _, result in results for warning in result.warnings],
    }
