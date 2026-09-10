"""
Parsing helpers and record builders shared by the provider mappers.

Two record shapes leave this service, and the Node backend persists them as-is:

  observation  -> one environmental_data row (a value with a unit and a time)
  gis_feature  -> one gis_analysis_results row (a spatial relationship)

Both carry the catalogue section they belong to and the source_key of the
provider that produced them.
"""
import math
from datetime import datetime, timezone
from typing import Any, Optional

# How a value was obtained. Kept on every observation so modelled or derived
# numbers are never presented as station measurements.
OBSERVED = "observed"  # measured at a monitoring station
MODELLED = "modelled"  # model output on a grid
REANALYSIS = "reanalysis"  # historical model reconstruction (e.g. ERA5)
PROJECTION = "projection"  # future climate model run
REMOTE_SENSED = "remote_sensed"  # gridded dataset derived from satellite/airborne sensing (e.g. DEM)
DERIVED = "derived"  # computed by this service from other values


def parse_utc_datetime(raw: str | None) -> datetime | None:
    """Parses an ISO-8601 string into an aware UTC datetime.

    Naive strings are treated as UTC - Open-Meteo returns GMT times unless a
    different timezone is requested. A trailing 'Z' (used by OpenAQ) is handled
    explicitly because datetime.fromisoformat() only accepts it from Python 3.11.
    """
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def to_finite_float(value: Any) -> float | None:
    """Returns value as a float, or None if it is missing, non-numeric, NaN or infinite."""
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def observation(
    *,
    section: str,
    category: str,
    parameter: str,
    parameter_name: str,
    source_key: str,
    data_type: str,
    value_numeric: Optional[float] = None,
    value_text: Optional[str] = None,
    unit: Optional[str] = None,
    recorded_at: Optional[datetime] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> dict:
    return {
        "section": section,
        "category": category,
        "parameter": parameter,
        "parameter_name": parameter_name,
        "value_numeric": value_numeric,
        "value_text": value_text,
        "unit": unit,
        "recorded_at": recorded_at,
        "source_key": source_key,
        "data_type": data_type,
        "metadata": metadata or {},
    }


def gis_feature(
    *,
    section: str,
    feature_type: str,
    source_key: str,
    feature_name: Optional[str] = None,
    distance_m: Optional[float] = None,
    inside_boundary: Optional[bool] = None,
    value_numeric: Optional[float] = None,
    value_text: Optional[str] = None,
    unit: Optional[str] = None,
    source_reference: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> dict:
    return {
        "section": section,
        "feature_type": feature_type,
        # gis_analysis_results.feature_name is VARCHAR(200)
        "feature_name": feature_name[:200] if feature_name else None,
        "distance_m": round(distance_m, 1) if distance_m is not None else None,
        "inside_boundary": inside_boundary,
        # Sensitivity classification needs validated rules/thresholds, which
        # belong to the calculation engine - it is never guessed here.
        "sensitivity_level": None,
        "value_numeric": value_numeric,
        "value_text": value_text,
        "unit": unit,
        "source_key": source_key,
        "source_reference": source_reference,
        "metadata": metadata or {},
    }
