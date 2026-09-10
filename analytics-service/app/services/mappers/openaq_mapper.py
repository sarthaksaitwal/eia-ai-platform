"""
Maps OpenAQ v3 responses onto observation / gis_feature records.
Kept pure (no I/O) so these are trivially unit-testable.

/locations/{id}/latest only returns sensorsId + value, so each value is joined
back to the station's sensor list to learn its parameter and unit.

Units are passed through as reported (µg/m³, ppm or ppb). Converting gas
concentrations between ppb and µg/m³ needs temperature and pressure
assumptions, so that is left to an explicit normalisation step.
"""
import math
from datetime import datetime, timedelta
from typing import Any

from app.services.mappers.common import OBSERVED, gis_feature, observation, parse_utc_datetime, to_finite_float

SOURCE_KEY = "openaq"

# OpenAQ parameter name -> (parameter key, display name). Other OpenAQ
# parameters (particle counts, temperature from low-cost sensors) are ignored.
PARAMETER_MAP = {
    "pm1": ("pm1", "PM1"),
    "pm25": ("pm25", "PM2.5"),
    "pm10": ("pm10", "PM10"),
    "no2": ("no2", "NO2"),
    "no": ("no", "NO"),
    "nox": ("nox", "NOx"),
    "so2": ("so2", "SO2"),
    "co": ("co", "CO"),
    "o3": ("o3", "O3"),
    "bc": ("black_carbon", "Black Carbon"),
    "relativehumidity": ("relative_humidity", "Relative Humidity"),
}


def _relevant_parameters(location: dict[str, Any]) -> list[str]:
    names = {
        PARAMETER_MAP[name][1]
        for sensor in location.get("sensors") or []
        if (name := (sensor.get("parameter") or {}).get("name")) in PARAMETER_MAP
    }
    return sorted(names)


def _distance(location: dict[str, Any]) -> float:
    distance = to_finite_float(location.get("distance"))
    return distance if distance is not None else math.inf


def _station_label(location: dict[str, Any]) -> str:
    return f"'{location.get('name')}' (id {location.get('id')})"


def select_locations(
    raw_locations: dict[str, Any], *, max_locations: int, max_age_days: int, now: datetime
) -> tuple[list[dict], list[str]]:
    """Nearest stations that measure a relevant parameter and have reported
    within max_age_days. Returns (locations, warnings)."""
    cutoff = now - timedelta(days=max_age_days)
    fresh, stale_count = [], 0
    for location in raw_locations.get("results") or []:
        if not _relevant_parameters(location):
            continue
        last_reported = parse_utc_datetime((location.get("datetimeLast") or {}).get("utc"))
        if last_reported is None or last_reported < cutoff:
            stale_count += 1
            continue
        fresh.append(location)

    warnings = []
    if stale_count:
        warnings.append(
            f"Ignored {stale_count} OpenAQ station(s) in range that have not reported in the last {max_age_days} days."
        )
    # Ordering of /locations results is not documented, so sort explicitly.
    fresh.sort(key=_distance)
    return fresh[:max_locations], warnings


def station_feature(location: dict[str, Any]) -> dict:
    coordinates = location.get("coordinates") or {}
    last_reported = parse_utc_datetime((location.get("datetimeLast") or {}).get("utc"))
    return gis_feature(
        section="air_quality",
        feature_type="air_monitoring_station",
        feature_name=location.get("name"),
        distance_m=to_finite_float(location.get("distance")),
        source_key=SOURCE_KEY,
        source_reference=f"openaq:location/{location.get('id')}",
        metadata={
            "station_latitude": coordinates.get("latitude"),
            "station_longitude": coordinates.get("longitude"),
            "upstream_provider": (location.get("provider") or {}).get("name"),
            "owner": (location.get("owner") or {}).get("name"),
            "is_reference_monitor": location.get("isMonitor"),
            "last_reported_at": last_reported.isoformat() if last_reported else None,
            "parameters": _relevant_parameters(location),
        },
    )


def map_latest_measurements(
    location: dict[str, Any], raw_latest: dict[str, Any], *, max_age_days: int, now: datetime
) -> tuple[list[dict], list[str]]:
    """Joins a station's latest values to its sensors. Returns (observations, warnings).

    Negative values are dropped: these parameters cannot be negative, and some
    upstream feeds use -999 as a no-data sentinel."""
    parameters_by_sensor = {sensor.get("id"): sensor.get("parameter") or {} for sensor in location.get("sensors") or []}
    cutoff = now - timedelta(days=max_age_days)
    rows = []
    invalid_count = stale_count = 0

    for result in raw_latest.get("results") or []:
        parameter = parameters_by_sensor.get(result.get("sensorsId")) or {}
        mapped = PARAMETER_MAP.get(parameter.get("name"))
        if mapped is None:
            continue
        value = to_finite_float(result.get("value"))
        if value is None or value < 0:
            invalid_count += 1
            continue
        recorded_at = parse_utc_datetime((result.get("datetime") or {}).get("utc"))
        if recorded_at is None or recorded_at < cutoff:
            stale_count += 1
            continue
        rows.append(
            observation(
                section="air_quality",
                category="Air",
                parameter=mapped[0],
                parameter_name=mapped[1],
                value_numeric=value,
                unit=parameter.get("units"),
                recorded_at=recorded_at,
                source_key=SOURCE_KEY,
                data_type=OBSERVED,
                metadata={
                    "api_parameter": parameter.get("name"),
                    "station_id": location.get("id"),
                    "station_name": location.get("name"),
                    "station_distance_m": location.get("distance"),
                    "sensor_id": result.get("sensorsId"),
                    "is_reference_monitor": location.get("isMonitor"),
                },
            )
        )

    warnings = []
    if invalid_count:
        warnings.append(f"Skipped {invalid_count} invalid value(s) from OpenAQ station {_station_label(location)}.")
    if stale_count:
        warnings.append(
            f"Skipped {stale_count} value(s) older than {max_age_days} days from OpenAQ station {_station_label(location)}."
        )
    return rows, warnings
