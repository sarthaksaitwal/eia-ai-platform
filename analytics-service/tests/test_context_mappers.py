import pytest

from app.services.mappers import soilgrids_mapper, usgs_mapper, worldpop_mapper

SITE = (28.6139, 77.2090)


def soil_layer(name, factor, target_units, mean):
    return {"name": name, "unit_measure": {"d_factor": factor, "target_units": target_units},
            "depths": [{"label": "0-5cm", "values": {"mean": mean}}]}


@pytest.mark.parametrize(
    "sand, silt, clay, expected",
    [(40, 40, 20, "Loam"), (90, 5, 5, "Sand"), (20, 60, 20, "Silt Loam"), (10, 10, 80, "Clay")],
)
def test_usda_texture_class(sand, silt, clay, expected):
    assert soilgrids_mapper.usda_texture_class(sand, silt, clay) == expected


def test_soil_properties_convert_units_and_derive_texture():
    raw = {"properties": {"layers": [
        soil_layer("phh2o", 10, "-", 72),
        soil_layer("sand", 10, "%", 400),
        soil_layer("silt", 10, "%", 400),
        soil_layer("clay", 10, "%", 200),
        soil_layer("soc", 10, "g/kg", None),
    ]}}
    rows = {row["parameter"]: row for row in soilgrids_mapper.map_properties(raw)}

    assert rows["soil_ph"]["value_numeric"] == 7.2 and rows["soil_ph"]["unit"] == "pH"
    assert rows["soil_texture"]["value_text"] == "Loam"
    assert rows["soil_texture"]["data_type"] == "derived"
    assert "soil_organic_carbon" not in rows
    assert all(row["category"] == "Soil" for row in rows.values())


def test_soil_properties_all_null_is_empty():
    raw = {"properties": {"layers": [soil_layer("phh2o", 10, "-", None)]}}
    assert soilgrids_mapper.map_properties(raw) == []


def test_soil_classification():
    rows = soilgrids_mapper.map_classification({"wrb_class_name": "Vertisols", "wrb_class_probability": [["Vertisols", 47]]})
    assert rows[0]["parameter"] == "soil_type" and rows[0]["value_text"] == "Vertisols"
    assert soilgrids_mapper.map_classification({}) == []


def test_population_and_density_use_polygon_area():
    rows = {row["feature_type"]: row for row in worldpop_mapper.map_population({"data": {"total_population": 12345.6}}, radius_m=1_000, vertices=32)}
    area = worldpop_mapper.polygon_area_km2(1_000, 32)
    assert area == pytest.approx(3.1214, rel=1e-4)
    assert rows["population_within_1km"]["value_numeric"] == 12346
    assert rows["population_density_within_1km"]["value_numeric"] == pytest.approx(12345.6 / area, abs=0.1)


def test_population_missing_is_empty():
    assert worldpop_mapper.map_population({"data": {}}, radius_m=1_000, vertices=32) == []


def test_earthquake_summary():
    raw = {"features": [
        {"id": "a", "properties": {"mag": 5.1, "place": "far and big", "time": 946684800000}, "geometry": {"coordinates": [77.209, 29.6139, 10]}},
        {"id": "b", "properties": {"mag": 4.2, "place": "near and small", "time": 1577836800000}, "geometry": {"coordinates": [77.209, 28.7139, 5]}},
    ]}
    rows = {row["feature_type"]: row for row in usgs_mapper.summarise_earthquakes(raw, SITE, radius_km=300, min_magnitude=4, start_year=1970)}

    assert rows["earthquake_count"]["value_numeric"] == 2
    assert rows["largest_earthquake"]["value_numeric"] == 5.1
    assert rows["largest_earthquake"]["metadata"]["date"] == "2000-01-01"
    assert rows["nearest_earthquake"]["feature_name"] == "near and small"
    assert rows["nearest_earthquake"]["distance_m"] == pytest.approx(11_119, rel=1e-2)


def test_no_earthquakes_still_reports_a_count():
    rows = usgs_mapper.summarise_earthquakes({"features": []}, SITE, radius_km=300, min_magnitude=4, start_year=1970)
    assert [(row["feature_type"], row["value_numeric"]) for row in rows] == [("earthquake_count", 0)]
