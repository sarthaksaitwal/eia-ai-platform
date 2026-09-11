"""
Maps CPCB real-time AQI records (data.gov.in) onto observation / gis_feature
records. Kept pure (no I/O) so these are trivially unit-testable.

Important: this dataset publishes National AQI *sub-index* values per
pollutant (dimensionless, e.g. CO sub-index 49), not concentrations. They are
stored under distinct parameter keys (e.g. "pm25_aqi_subindex") so they are
never mixed with µg/m³ concentrations from other providers.

last_update is Indian Standard Time in "DD-MM-YYYY HH:MM:SS" form.
"""
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from typing import Any

from app.services.distance_service import Point, haversine_m
from app.services.mappers.common import OBSERVED, gis_feature, observation, to_finite_float

SOURCE_KEY = "cpcb_ogd"
IST = timezone(timedelta(hours=5, minutes=30))

# CPCB pollutant_id -> (parameter key, display name)
POLLUTANTS = {
    "PM2.5": ("pm25", "PM2.5"),
    "PM10": ("pm10", "PM10"),
    "NO2": ("no2", "NO2"),
    "SO2": ("so2", "SO2"),
    "CO": ("co", "CO"),
    "OZONE": ("o3", "O3"),
    "NH3": ("nh3", "NH3"),
}


def parse_ist(raw: str | None) -> datetime | None:
    try:
        return datetime.strptime(raw, "%d-%m-%Y %H:%M:%S").replace(tzinfo=IST).astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def group_stations(records: list[dict[str, Any]], origin: Point) -> list[dict]:
    """Collapses station x pollutant rows into one entry per station with its distance."""
    stations: "OrderedDict[str, dict]" = OrderedDict()
    for record in records:
        name = record.get("station")
        latitude, longitude = to_finite_float(record.get("latitude")), to_finite_float(record.get("longitude"))
        if not name or latitude is None or longitude is None:
            continue
        station = stations.setdefault(
            name,
            {
                "station": name,
                "city": record.get("city"),
                "state": record.get("state"),
                "latitude": latitude,
                "longitude": longitude,
                "distance_m": haversine_m(origin, (latitude, longitude)),
                "last_update": parse_ist(record.get("last_update")),
                "records": [],
            },
        )
        station["records"].append(record)
    return list(stations.values())


def select_stations(
    records: list[dict[str, Any]], *, origin: Point, radius_m: float, max_stations: int, max_age_days: int, now: datetime
) -> tuple[list[dict], list[str]]:
    cutoff = now - timedelta(days=max_age_days)
    in_range = [station for station in group_stations(records, origin) if station["distance_m"] <= radius_m]
    fresh = [station for station in in_range if station["last_update"] and station["last_update"] >= cutoff]

    warnings = []
    if len(fresh) < len(in_range):
        warnings.append(
            f"Ignored {len(in_range) - len(fresh)} CPCB station(s) in range that have not reported in the last {max_age_days} days."
        )
    fresh.sort(key=lambda station: station["distance_m"])
    return fresh[:max_stations], warnings


def station_feature(station: dict) -> dict:
    return gis_feature(
        section="air_quality",
        feature_type="air_monitoring_station",
        feature_name=station["station"],
        distance_m=station["distance_m"],
        source_key=SOURCE_KEY,
        source_reference=f"cpcb:station/{station['station']}",
        metadata={
            "station_latitude": station["latitude"],
            "station_longitude": station["longitude"],
            "city": station["city"],
            "state": station["state"],
            "last_reported_at": station["last_update"].isoformat() if station["last_update"] else None,
            "network": "CPCB CAAQMS",
        },
    )


def map_station_observations(station: dict) -> tuple[list[dict], list[str]]:
    rows, missing = [], 0
    for record in station["records"]:
        mapped = POLLUTANTS.get(record.get("pollutant_id"))
        if mapped is None:
            continue
        average = to_finite_float(record.get("avg_value"))
        if average is None or average < 0:
            missing += 1  # CPCB publishes "NA" when a pollutant is not reporting
            continue
        rows.append(
            observation(
                section="air_quality",
                category="Air",
                parameter=f"{mapped[0]}_aqi_subindex",
                parameter_name=f"{mapped[1]} AQI Sub-index",
                value_numeric=average,
                unit="AQI sub-index",
                recorded_at=station["last_update"],
                source_key=SOURCE_KEY,
                data_type=OBSERVED,
                metadata={
                    "pollutant_id": record.get("pollutant_id"),
                    "min_value": to_finite_float(record.get("min_value")),
                    "max_value": to_finite_float(record.get("max_value")),
                    "station_name": station["station"],
                    "station_distance_m": round(station["distance_m"], 1),
                    "note": "CPCB National AQI sub-index (dimensionless), not a concentration.",
                },
            )
        )

    warnings = [f"CPCB station '{station['station']}' reported NA for {missing} pollutant(s)."] if missing else []
    return rows, warnings
