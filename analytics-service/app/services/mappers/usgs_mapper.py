"""Maps USGS earthquake search results onto gis_feature records. Pure (no I/O)."""
from datetime import datetime, timezone
from typing import Any

from app.services.distance_service import Point, haversine_m
from app.services.mappers.common import gis_feature, to_finite_float

SOURCE_KEY = "usgs_earthquakes"
NOTE = "Historical seismicity from the USGS ComCat catalogue; not the BIS IS 1893 seismic zone."


def _event(feature: dict[str, Any], origin: Point) -> dict | None:
    properties = feature.get("properties") or {}
    coordinates = (feature.get("geometry") or {}).get("coordinates") or []
    magnitude = to_finite_float(properties.get("mag"))
    if magnitude is None or len(coordinates) < 2:
        return None
    time_ms = to_finite_float(properties.get("time"))
    return {
        "id": feature.get("id"),
        "magnitude": magnitude,
        "place": properties.get("place"),
        "distance_m": haversine_m(origin, (coordinates[1], coordinates[0])),
        "depth_km": to_finite_float(coordinates[2]) if len(coordinates) > 2 else None,
        "date": datetime.fromtimestamp(time_ms / 1000, tz=timezone.utc).date().isoformat() if time_ms else None,
    }


def summarise_earthquakes(
    raw: dict[str, Any], origin: Point, *, radius_km: float, min_magnitude: float, start_year: int
) -> list[dict]:
    events = [event for feature in raw.get("features") or [] if (event := _event(feature, origin))]
    search = {"search_radius_km": radius_km, "min_magnitude": min_magnitude, "since_year": start_year, "note": NOTE}

    rows = [
        gis_feature(
            section="natural_hazards",
            feature_type="earthquake_count",
            value_numeric=len(events),
            unit="count",
            source_key=SOURCE_KEY,
            metadata=search,
        )
    ]
    if not events:
        return rows

    largest = max(events, key=lambda event: event["magnitude"])
    nearest = min(events, key=lambda event: event["distance_m"])
    for feature_type, event in (("largest_earthquake", largest), ("nearest_earthquake", nearest)):
        rows.append(
            gis_feature(
                section="natural_hazards",
                feature_type=feature_type,
                feature_name=event["place"],
                distance_m=event["distance_m"],
                value_numeric=event["magnitude"],
                unit="magnitude",
                source_key=SOURCE_KEY,
                source_reference=f"usgs:event/{event['id']}",
                metadata={**search, "date": event["date"], "depth_km": event["depth_km"]},
            )
        )
    return rows
