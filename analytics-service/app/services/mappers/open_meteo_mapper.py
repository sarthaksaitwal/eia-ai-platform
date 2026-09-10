"""
Maps raw Open-Meteo responses onto observation / gis_feature records.
Kept pure (no I/O) so these are trivially unit-testable.

Every Open-Meteo value is model or dataset output on a grid, never a station
measurement, so records carry an explicit data_type (modelled, reanalysis,
projection, remote_sensed or derived) and the grid cell actually used.
"""
import math
from collections import defaultdict
from datetime import date
from statistics import mean
from typing import Any, Optional, Sequence

from app.services.distance_service import Point, destination_point
from app.services.mappers.common import (
    DERIVED,
    MODELLED,
    PROJECTION,
    REANALYSIS,
    REMOTE_SENSED,
    gis_feature,
    observation,
    parse_utc_datetime,
    to_finite_float,
)

SOURCE_AIR_QUALITY = "open_meteo_air_quality"
SOURCE_WEATHER = "open_meteo_weather"
SOURCE_ARCHIVE = "open_meteo_archive"
SOURCE_CLIMATE = "open_meteo_climate"
SOURCE_ELEVATION = "open_meteo_elevation"
SOURCE_FLOOD = "open_meteo_flood"

# API field -> (parameter key, display name)
AIR_QUALITY_FIELDS = {
    "pm2_5": ("pm25", "PM2.5"),
    "pm10": ("pm10", "PM10"),
    "nitrogen_dioxide": ("no2", "NO2"),
    "sulphur_dioxide": ("so2", "SO2"),
    "carbon_monoxide": ("co", "CO"),
    "ozone": ("o3", "O3"),
}

WEATHER_FIELDS = {
    "temperature_2m": ("air_temperature", "Air Temperature"),
    "relative_humidity_2m": ("relative_humidity", "Relative Humidity"),
    "precipitation": ("precipitation", "Precipitation"),
    "wind_speed_10m": ("wind_speed", "Wind Speed"),
    "wind_direction_10m": ("wind_direction", "Wind Direction"),
    "surface_pressure": ("atmospheric_pressure", "Atmospheric Pressure"),
    "cloud_cover": ("cloud_cover", "Cloud Cover"),
    "shortwave_radiation": ("solar_radiation", "Solar Radiation"),
    "et0_fao_evapotranspiration": ("evapotranspiration", "Reference Evapotranspiration (ET0)"),
    "soil_moisture_0_to_1cm": ("soil_moisture", "Soil Moisture (0-1 cm)"),
    "soil_temperature_0cm": ("soil_temperature", "Soil Temperature (surface)"),
    "boundary_layer_height": ("boundary_layer_height", "Boundary Layer Height"),
}

PROJECTION_BASELINE_YEARS = (2001, 2010)
PROJECTION_FUTURE_YEARS = (2040, 2049)

# Copernicus DEM GLO-90 resolution; terrain is sampled on a cross of this spacing.
TERRAIN_SPACING_M = 90.0


def _grid(raw: dict[str, Any]) -> dict[str, Any]:
    # Open-Meteo snaps requests to its model grid; keep the cell actually used
    # so its offset from the site is traceable.
    return {"grid_latitude": raw.get("latitude"), "grid_longitude": raw.get("longitude")}


def _map_current(raw: dict[str, Any], fields: dict, *, section: str, category: str, source_key: str) -> list[dict]:
    current = raw.get("current") or {}
    units = raw.get("current_units") or {}
    recorded_at = parse_utc_datetime(current.get("time"))

    rows = []
    for api_key, (parameter, parameter_name) in fields.items():
        value = to_finite_float(current.get(api_key))
        if value is None:
            continue
        rows.append(
            observation(
                section=section,
                category=category,
                parameter=parameter,
                parameter_name=parameter_name,
                value_numeric=value,
                unit=units.get(api_key),
                recorded_at=recorded_at,
                source_key=source_key,
                data_type=MODELLED,
                metadata={"api_parameter": api_key, **_grid(raw)},
            )
        )
    return rows


def map_air_quality_response(raw: dict[str, Any]) -> list[dict]:
    return _map_current(raw, AIR_QUALITY_FIELDS, section="air_quality", category="Air", source_key=SOURCE_AIR_QUALITY)


def map_weather_response(raw: dict[str, Any]) -> list[dict]:
    return _map_current(raw, WEATHER_FIELDS, section="meteorology", category="Meteorology", source_key=SOURCE_WEATHER)


def _daily_series(raw: dict[str, Any], key: str) -> list[tuple[date, float]]:
    daily = raw.get("daily") or {}
    series = []
    for raw_day, raw_value in zip(daily.get("time") or [], daily.get(key) or []):
        value = to_finite_float(raw_value)
        if value is None:
            continue
        try:
            series.append((date.fromisoformat(raw_day), value))
        except (TypeError, ValueError):
            continue
    return series


def _annual_totals(series: Sequence[tuple[date, float]], min_days: int = 360) -> dict[int, float]:
    """Per-year sums, keeping only years with enough days to be comparable."""
    totals: dict[int, float] = defaultdict(float)
    counts: dict[int, int] = defaultdict(int)
    for day, value in series:
        totals[day.year] += value
        counts[day.year] += 1
    return {year: total for year, total in totals.items() if counts[year] >= min_days}


def _vector_mean_direction(directions: Sequence[float]) -> Optional[float]:
    x = sum(math.sin(math.radians(d)) for d in directions)
    y = sum(math.cos(math.radians(d)) for d in directions)
    if math.hypot(x, y) < 1e-9:
        return None
    return math.degrees(math.atan2(x, y)) % 360


def _compass(bearing_deg: float) -> str:
    points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return points[int((bearing_deg % 360 + 22.5) // 45) % 8]


def summarise_historical_climate(raw: dict[str, Any]) -> list[dict]:
    """Climate normals and extremes from ERA5 daily reanalysis."""
    series = {key: _daily_series(raw, key) for key in (
        "temperature_2m_mean", "temperature_2m_max", "temperature_2m_min", "precipitation_sum",
        "shortwave_radiation_sum", "et0_fao_evapotranspiration", "wind_speed_10m_max",
        "wind_direction_10m_dominant",
    )}
    days = [day for values in series.values() for day, _ in values]
    if not days:
        return []

    period = {
        "period_start": min(days).isoformat(),
        "period_end": max(days).isoformat(),
        "dataset": "ERA5 reanalysis (Open-Meteo Historical Weather API)",
        **_grid(raw),
    }
    rows: list[dict] = []

    def add(section, category, parameter, name, value, unit, data_type=REANALYSIS, **extra):
        if value is None:
            return
        rows.append(
            observation(
                section=section,
                category=category,
                parameter=parameter,
                parameter_name=name,
                value_numeric=round(value, 3),
                unit=unit,
                source_key=SOURCE_ARCHIVE,
                data_type=data_type,
                metadata={**period, **extra},
            )
        )

    def values(key):
        return [value for _, value in series[key]]

    met = ("meteorology", "Meteorology")
    hazard = ("natural_hazards", "Natural Hazards")

    if values("temperature_2m_mean"):
        add(*met, "historical_mean_temperature", "Mean Air Temperature", mean(values("temperature_2m_mean")), "°C")
    if values("temperature_2m_max"):
        add(*met, "historical_mean_daily_max_temperature", "Mean Daily Maximum Temperature", mean(values("temperature_2m_max")), "°C")
        day, value = max(series["temperature_2m_max"], key=lambda item: item[1])
        add(*hazard, "highest_max_temperature", "Highest Daily Maximum Temperature", value, "°C", date=day.isoformat())
    if values("temperature_2m_min"):
        add(*met, "historical_mean_daily_min_temperature", "Mean Daily Minimum Temperature", mean(values("temperature_2m_min")), "°C")
        day, value = min(series["temperature_2m_min"], key=lambda item: item[1])
        add(*hazard, "lowest_min_temperature", "Lowest Daily Minimum Temperature", value, "°C", date=day.isoformat())

    rainfall_years = _annual_totals(series["precipitation_sum"])
    if rainfall_years:
        mean_rainfall = mean(rainfall_years.values())
        add(*met, "historical_annual_rainfall", "Mean Annual Rainfall", mean_rainfall, "mm/year", complete_years=len(rainfall_years))
        driest = min(rainfall_years, key=rainfall_years.get)
        add(
            *hazard, "driest_year_rainfall", "Driest Year Rainfall", rainfall_years[driest], "mm/year", DERIVED,
            year=driest,
            percent_of_mean=round(100 * rainfall_years[driest] / mean_rainfall, 1) if mean_rainfall else None,
        )
    if series["precipitation_sum"]:
        day, value = max(series["precipitation_sum"], key=lambda item: item[1])
        add(*hazard, "max_daily_rainfall", "Maximum 1-Day Rainfall", value, "mm", date=day.isoformat())

    et0_years = _annual_totals(series["et0_fao_evapotranspiration"])
    if et0_years:
        add(*met, "historical_annual_evapotranspiration", "Mean Annual Reference Evapotranspiration", mean(et0_years.values()), "mm/year")

    if values("shortwave_radiation_sum"):
        mean_mj = mean(values("shortwave_radiation_sum"))
        add(*met, "historical_daily_solar_radiation", "Mean Daily Solar Radiation", mean_mj, "MJ/m²/day")
        add(
            "carbon", "Carbon", "solar_energy_potential", "Mean Daily Solar Irradiation (GHI)", mean_mj / 3.6, "kWh/m²/day", DERIVED,
            note="Renewable-energy screening context only; not a plant yield estimate.",
        )

    if values("wind_speed_10m_max"):
        add(*met, "historical_mean_daily_max_wind_speed", "Mean Daily Maximum Wind Speed", mean(values("wind_speed_10m_max")), "km/h")
    direction = _vector_mean_direction(values("wind_direction_10m_dominant"))
    if direction is not None:
        add(*met, "mean_dominant_wind_direction", "Mean Dominant Wind Direction", direction, "°", DERIVED, compass=_compass(direction))

    return rows


def _window_values(series: Sequence[tuple[date, float]], years: tuple[int, int]) -> list[float]:
    return [value for day, value in series if years[0] <= day.year <= years[1]]


def summarise_climate_projection(
    raw: dict[str, Any],
    *,
    baseline: tuple[int, int] = PROJECTION_BASELINE_YEARS,
    future: tuple[int, int] = PROJECTION_FUTURE_YEARS,
) -> list[dict]:
    """Future-period means and change against the same model's own baseline
    (comparing a model with itself avoids mixing in its absolute bias)."""
    daily = raw.get("daily") or {}
    # Multi-model responses suffix each variable with the model name.
    models = sorted(key.split("temperature_2m_mean_", 1)[1] for key in daily if key.startswith("temperature_2m_mean_"))
    rows: list[dict] = []

    for model in models:
        meta = {
            "model": model,
            "baseline_period": f"{baseline[0]}-{baseline[1]}",
            "future_period": f"{future[0]}-{future[1]}",
            "dataset": "CMIP6 HighResMIP (Open-Meteo Climate API)",
            **_grid(raw),
        }

        def add(parameter, name, value, unit):
            rows.append(
                observation(
                    section="meteorology",
                    category="Meteorology",
                    parameter=parameter,
                    parameter_name=name,
                    value_numeric=round(value, 3),
                    unit=unit,
                    source_key=SOURCE_CLIMATE,
                    data_type=PROJECTION,
                    metadata=meta,
                )
            )

        temperatures = _daily_series(raw, f"temperature_2m_mean_{model}")
        future_t = _window_values(temperatures, future)
        baseline_t = _window_values(temperatures, baseline)
        if future_t:
            add("projected_mean_temperature", f"Projected Mean Temperature ({meta['future_period']})", mean(future_t), "°C")
            if baseline_t:
                add("projected_temperature_change", "Projected Temperature Change", mean(future_t) - mean(baseline_t), "°C")

        rainfall_years = _annual_totals(_daily_series(raw, f"precipitation_sum_{model}"))
        future_p = [total for year, total in rainfall_years.items() if future[0] <= year <= future[1]]
        baseline_p = [total for year, total in rainfall_years.items() if baseline[0] <= year <= baseline[1]]
        if future_p:
            add("projected_annual_rainfall", f"Projected Annual Rainfall ({meta['future_period']})", mean(future_p), "mm/year")
            if baseline_p and mean(baseline_p) > 0:
                add("projected_rainfall_change", "Projected Rainfall Change", 100 * (mean(future_p) - mean(baseline_p)) / mean(baseline_p), "%")

    return rows


def terrain_sample_points(origin: Point) -> list[Point]:
    """Site plus points TERRAIN_SPACING_M north, east, south and west."""
    return [origin] + [destination_point(origin, TERRAIN_SPACING_M, bearing) for bearing in (0, 90, 180, 270)]


def map_terrain(raw: dict[str, Any]) -> list[dict]:
    """Elevation, slope and aspect from elevations sampled at terrain_sample_points()."""
    elevations = [to_finite_float(value) for value in raw.get("elevation") or []]
    if len(elevations) != 5 or elevations[0] is None:
        return []

    dataset = {"dataset": "Copernicus DEM GLO-90 (Open-Meteo Elevation API)"}
    centre, north, east, south, west = elevations
    rows = [
        gis_feature(section="land", feature_type="elevation", source_key=SOURCE_ELEVATION,
                    value_numeric=centre, unit="m", metadata=dataset)
    ]
    if None in (north, east, south, west):
        return rows

    dz_dx = (east - west) / (2 * TERRAIN_SPACING_M)
    dz_dy = (north - south) / (2 * TERRAIN_SPACING_M)
    gradient = math.hypot(dz_dx, dz_dy)
    method = {**dataset, "method": f"central differences over a {TERRAIN_SPACING_M:g} m cross of DEM samples"}

    rows.append(
        gis_feature(section="land", feature_type="slope", source_key=SOURCE_ELEVATION,
                    value_numeric=round(math.degrees(math.atan(gradient)), 2), unit="°", metadata=method)
    )
    if gradient == 0:
        rows.append(gis_feature(section="land", feature_type="aspect", source_key=SOURCE_ELEVATION,
                                value_text="Flat", metadata=method))
    else:
        # The gradient points uphill; aspect is the direction the slope faces (downhill).
        aspect = (math.degrees(math.atan2(dz_dx, dz_dy)) + 180) % 360
        rows.append(gis_feature(section="land", feature_type="aspect", source_key=SOURCE_ELEVATION,
                                value_numeric=round(aspect, 1), value_text=_compass(aspect), unit="°", metadata=method))
    return rows


def summarise_river_discharge(raw: dict[str, Any]) -> list[dict]:
    series = _daily_series(raw, "river_discharge")
    if not series:
        return []

    meta = {
        "period_start": series[0][0].isoformat(),
        "period_end": series[-1][0].isoformat(),
        "dataset": "GloFAS river discharge reanalysis (Open-Meteo Flood API)",
        "note": "Nearest GloFAS river grid cell (~5 km); it may not be the watercourse adjacent to the "
                "site. Context only - not an official flood-hazard zonation.",
        **_grid(raw),
    }
    peak_day, peak = max(series, key=lambda item: item[1])
    return [
        observation(section="natural_hazards", category="Natural Hazards", parameter="mean_river_discharge",
                    parameter_name="Mean Daily River Discharge", value_numeric=round(mean(v for _, v in series), 3),
                    unit="m³/s", source_key=SOURCE_FLOOD, data_type=MODELLED, metadata=meta),
        observation(section="natural_hazards", category="Natural Hazards", parameter="peak_river_discharge",
                    parameter_name="Peak Daily River Discharge", value_numeric=round(peak, 3),
                    unit="m³/s", source_key=SOURCE_FLOOD, data_type=MODELLED,
                    metadata={**meta, "date": peak_day.isoformat()}),
    ]
