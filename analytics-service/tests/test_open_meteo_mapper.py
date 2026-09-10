from datetime import date, timedelta

import pytest

from app.services.distance_service import haversine_m
from app.services.mappers import open_meteo_mapper as mapper

SAMPLE_AIR_QUALITY_RESPONSE = {
    "latitude": 28.6,
    "longitude": 77.2,
    "current": {
        "time": "2026-09-10T14:00",
        "pm10": 42.3,
        "pm2_5": 18.7,
        "carbon_monoxide": 210.0,
        "nitrogen_dioxide": 12.5,
        "sulphur_dioxide": 3.1,
        "ozone": 55.0,
    },
    "current_units": {key: "µg/m³" for key in ("pm10", "pm2_5", "carbon_monoxide", "nitrogen_dioxide", "sulphur_dioxide", "ozone")},
}

SAMPLE_WEATHER_RESPONSE = {
    "current": {
        "time": "2026-09-10T14:00",
        "temperature_2m": 29.4,
        "relative_humidity_2m": 61,
        "wind_speed_10m": 11.2,
        "wind_direction_10m": 210,
        "precipitation": 0.0,
        "boundary_layer_height": 60.0,
    },
    "current_units": {"temperature_2m": "°C", "relative_humidity_2m": "%", "boundary_layer_height": "m"},
}


def _daily_response(start_year: int, years: int, **series) -> dict:
    days, day = [], date(start_year, 1, 1)
    while day.year < start_year + years:
        days.append(day)
        day += timedelta(days=1)
    daily = {"time": [d.isoformat() for d in days]}
    daily.update({key: [function(d) for d in days] for key, function in series.items()})
    return {"latitude": 1.0, "longitude": 2.0, "daily": daily}


def test_air_quality_rows_are_modelled_air_observations():
    rows = mapper.map_air_quality_response(SAMPLE_AIR_QUALITY_RESPONSE)
    assert {row["parameter"] for row in rows} == {"pm25", "pm10", "no2", "so2", "co", "o3"}
    assert all(row["category"] == "Air" and row["section"] == "air_quality" and row["data_type"] == "modelled" for row in rows)

    pm25 = next(row for row in rows if row["parameter"] == "pm25")
    assert pm25["value_numeric"] == 18.7
    assert pm25["unit"] == "µg/m³"
    assert pm25["recorded_at"].tzinfo is not None
    assert pm25["metadata"]["grid_latitude"] == 28.6


def test_weather_rows_use_meteorology_category():
    rows = mapper.map_weather_response(SAMPLE_WEATHER_RESPONSE)
    assert {row["parameter"] for row in rows} == {
        "air_temperature", "relative_humidity", "wind_speed", "wind_direction", "precipitation", "boundary_layer_height",
    }
    assert all(row["category"] == "Meteorology" and row["source_key"] == "open_meteo_weather" for row in rows)


def test_missing_and_non_numeric_values_are_skipped():
    raw = {"current": {"time": "2026-09-10T14:00", "temperature_2m": "n/a", "cloud_cover": 20}, "current_units": {"cloud_cover": "%"}}
    assert [row["parameter"] for row in mapper.map_weather_response(raw)] == ["cloud_cover"]


def test_empty_responses_produce_no_rows():
    assert mapper.map_weather_response({}) == []
    assert mapper.map_air_quality_response({}) == []
    assert mapper.summarise_historical_climate({}) == []
    assert mapper.summarise_climate_projection({}) == []
    assert mapper.summarise_river_discharge({}) == []


def test_historical_climate_normals_and_extremes():
    raw = _daily_response(
        2020, 2,
        temperature_2m_mean=lambda d: 25.0,
        temperature_2m_max=lambda d: 45.0 if d == date(2021, 5, 20) else 30.0,
        temperature_2m_min=lambda d: 20.0,
        precipitation_sum=lambda d: (200.0 if d == date(2020, 7, 1) else 1.0) if d.year == 2020 else 0.5,
        shortwave_radiation_sum=lambda d: 18.0,
        et0_fao_evapotranspiration=lambda d: 4.0,
        wind_speed_10m_max=lambda d: 10.0,
        wind_direction_10m_dominant=lambda d: 350.0 if d.toordinal() % 2 else 10.0,
    )
    rows = {row["parameter"]: row for row in mapper.summarise_historical_climate(raw)}

    assert rows["historical_mean_temperature"]["value_numeric"] == 25.0
    assert rows["highest_max_temperature"]["value_numeric"] == 45.0
    assert rows["highest_max_temperature"]["metadata"]["date"] == "2021-05-20"
    # 2020 (leap): 365 x 1.0 + 200 = 565 mm; 2021: 365 x 0.5 = 182.5 mm
    assert rows["historical_annual_rainfall"]["value_numeric"] == pytest.approx(373.75)
    assert rows["driest_year_rainfall"]["metadata"]["year"] == 2021
    assert rows["driest_year_rainfall"]["section"] == "natural_hazards"
    assert rows["max_daily_rainfall"]["value_numeric"] == 200.0
    assert rows["historical_annual_evapotranspiration"]["value_numeric"] == pytest.approx(1462.0)
    assert rows["solar_energy_potential"]["value_numeric"] == pytest.approx(5.0)
    assert rows["solar_energy_potential"]["section"] == "carbon"
    assert rows["mean_dominant_wind_direction"]["metadata"]["compass"] == "N"
    assert rows["historical_mean_temperature"]["metadata"]["period_start"] == "2020-01-01"


def test_climate_projection_compares_model_with_its_own_baseline():
    raw = _daily_response(
        2001, 49,
        temperature_2m_mean_MRI_AGCM3_2_S=lambda d: 20.0 if d.year <= 2010 else 22.0,
        precipitation_sum_MRI_AGCM3_2_S=lambda d: 1.0 if d.year <= 2010 else 1.1,
    )
    rows = {row["parameter"]: row for row in mapper.summarise_climate_projection(raw)}

    assert rows["projected_mean_temperature"]["value_numeric"] == pytest.approx(22.0)
    assert rows["projected_temperature_change"]["value_numeric"] == pytest.approx(2.0)
    assert rows["projected_rainfall_change"]["value_numeric"] == pytest.approx(10.0, rel=1e-2)
    assert rows["projected_temperature_change"]["metadata"]["model"] == "MRI_AGCM3_2_S"
    assert rows["projected_temperature_change"]["data_type"] == "projection"


def test_terrain_slope_and_aspect():
    # Centre, N, E, S, W: rises 9 m per 90 m towards the east.
    rows = {row["feature_type"]: row for row in mapper.map_terrain({"elevation": [100.0, 100.0, 109.0, 100.0, 91.0]})}
    assert rows["elevation"]["value_numeric"] == 100.0
    assert rows["slope"]["value_numeric"] == pytest.approx(5.71, abs=0.01)
    assert rows["aspect"]["value_numeric"] == 270.0  # faces downhill, to the west
    assert rows["aspect"]["value_text"] == "W"


def test_flat_terrain_has_no_aspect_angle():
    rows = {row["feature_type"]: row for row in mapper.map_terrain({"elevation": [50.0] * 5})}
    assert rows["slope"]["value_numeric"] == 0.0
    assert rows["aspect"]["value_text"] == "Flat"
    assert rows["aspect"]["value_numeric"] is None


def test_terrain_requires_all_samples():
    assert mapper.map_terrain({"elevation": [100.0]}) == []


def test_terrain_sample_points_are_90_m_apart():
    site = (20.0, 73.78)
    points = mapper.terrain_sample_points(site)
    assert points[0] == site
    assert all(haversine_m(site, point) == pytest.approx(90.0, rel=1e-6) for point in points[1:])


def test_river_discharge_summary():
    raw = {"latitude": 28.6, "longitude": 77.2, "daily": {"time": ["2025-01-01", "2025-01-02", "2025-01-03"], "river_discharge": [10.0, 40.0, None]}}
    rows = {row["parameter"]: row for row in mapper.summarise_river_discharge(raw)}
    assert rows["mean_river_discharge"]["value_numeric"] == 25.0
    assert rows["peak_river_discharge"]["value_numeric"] == 40.0
    assert rows["peak_river_discharge"]["metadata"]["date"] == "2025-01-02"
