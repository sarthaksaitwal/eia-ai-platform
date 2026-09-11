from datetime import datetime, timezone

from app.services.mappers import cpcb_mapper, openaq_mapper
from app.services.mappers.common import parse_utc_datetime

NOW = datetime(2026, 9, 10, 17, 0, tzinfo=timezone.utc)
SITE = (28.6139, 77.2090)


# ---------------------------------------------------------------- OpenAQ

def openaq_location(location_id, *, distance, last="2026-09-10T16:00:00Z", sensors=None):
    return {
        "id": location_id,
        "name": f"Station {location_id}",
        "coordinates": {"latitude": 28.63, "longitude": 77.22},
        "sensors": sensors if sensors is not None else [
            {"id": location_id * 10 + 1, "parameter": {"name": "pm25", "units": "µg/m³"}},
            {"id": location_id * 10 + 2, "parameter": {"name": "no2", "units": "ppb"}},
        ],
        "datetimeLast": {"utc": last},
        "provider": {"name": "CPCB"},
        "owner": {"name": "Government"},
        "isMonitor": True,
        "distance": distance,
    }


def test_parse_utc_datetime_handles_z_and_offsets():
    assert parse_utc_datetime("2024-09-25T22:00:00Z") == datetime(2024, 9, 25, 22, tzinfo=timezone.utc)
    assert parse_utc_datetime("2024-09-25T16:00:00-06:00") == datetime(2024, 9, 25, 22, tzinfo=timezone.utc)
    assert parse_utc_datetime("not a date") is None


def test_openaq_select_locations_sorts_caps_and_drops_stale_or_irrelevant():
    raw = {"results": [
        openaq_location(1, distance=9000),
        openaq_location(2, distance=1000),
        openaq_location(3, distance=500, last="2024-01-01T00:00:00Z"),
        openaq_location(4, distance=100, sensors=[{"id": 41, "parameter": {"name": "temperature", "units": "c"}}]),
        openaq_location(5, distance=5000),
    ]}
    selected, warnings = openaq_mapper.select_locations(raw, max_locations=2, max_age_days=30, now=NOW)
    assert [location["id"] for location in selected] == [2, 5]
    assert warnings == ["Ignored 1 OpenAQ station(s) in range that have not reported in the last 30 days."]


def test_openaq_latest_joins_sensors_and_rejects_invalid_or_stale_values():
    location = openaq_location(7, distance=1200)
    raw_latest = {"results": [
        {"datetime": {"utc": "2026-09-10T16:00:00Z"}, "value": 88.0, "sensorsId": 71},
        {"datetime": {"utc": "2026-09-10T16:00:00Z"}, "value": -999, "sensorsId": 72},
        {"datetime": {"utc": "2025-01-01T00:00:00Z"}, "value": 12.0, "sensorsId": 72},
        {"datetime": {"utc": "2026-09-10T16:00:00Z"}, "value": 5.0, "sensorsId": 999},
    ]}
    rows, warnings = openaq_mapper.map_latest_measurements(location, raw_latest, max_age_days=30, now=NOW)

    assert len(rows) == 1
    assert rows[0]["parameter"] == "pm25" and rows[0]["value_numeric"] == 88.0 and rows[0]["unit"] == "µg/m³"
    assert rows[0]["data_type"] == "observed" and rows[0]["metadata"]["station_id"] == 7
    assert len(warnings) == 2


def test_openaq_station_feature():
    feature = openaq_mapper.station_feature(openaq_location(7, distance=1200))
    assert feature["feature_type"] == "air_monitoring_station"
    assert feature["distance_m"] == 1200.0
    assert feature["source_reference"] == "openaq:location/7"
    assert feature["metadata"]["parameters"] == ["NO2", "PM2.5"]


# ------------------------------------------------------------------ CPCB

def cpcb_record(station, latitude, pollutant, average, last="10-09-2026 22:00:00"):
    return {"station": station, "city": "Delhi", "state": "Delhi", "latitude": str(latitude), "longitude": "77.209",
            "last_update": last, "pollutant_id": pollutant, "min_value": "1", "max_value": "300", "avg_value": average}


CPCB_RECORDS = [
    cpcb_record("Near", 28.62, "PM2.5", "92"),
    cpcb_record("Near", 28.62, "CO", "NA"),
    cpcb_record("Far", 28.80, "PM10", "140"),
    cpcb_record("Stale", 28.615, "PM10", "70", last="01-01-2025 10:00:00"),
    cpcb_record("Out of range", 30.0, "PM10", "60"),
]


def test_cpcb_last_update_is_ist():
    assert cpcb_mapper.parse_ist("10-09-2026 22:00:00") == datetime(2026, 9, 10, 16, 30, tzinfo=timezone.utc)
    assert cpcb_mapper.parse_ist("NA") is None


def test_cpcb_select_stations_filters_range_and_staleness():
    stations, warnings = cpcb_mapper.select_stations(
        CPCB_RECORDS, origin=SITE, radius_m=25_000, max_stations=5, max_age_days=30, now=NOW
    )
    assert [station["station"] for station in stations] == ["Near", "Far"]
    assert warnings == ["Ignored 1 CPCB station(s) in range that have not reported in the last 30 days."]


def test_cpcb_observations_are_aqi_subindices_and_skip_na():
    stations, _ = cpcb_mapper.select_stations(CPCB_RECORDS, origin=SITE, radius_m=25_000, max_stations=1, max_age_days=30, now=NOW)
    rows, warnings = cpcb_mapper.map_station_observations(stations[0])

    assert [row["parameter"] for row in rows] == ["pm25_aqi_subindex"]
    assert rows[0]["unit"] == "AQI sub-index"
    assert rows[0]["value_numeric"] == 92.0
    assert rows[0]["recorded_at"] == datetime(2026, 9, 10, 16, 30, tzinfo=timezone.utc)
    assert warnings == ["CPCB station 'Near' reported NA for 1 pollutant(s)."]
