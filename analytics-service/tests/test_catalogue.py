from app.services import catalogue
from app.services.mappers.common import gis_feature, observation

REQUEST = {"latitude": 28.6139, "longitude": 77.209}


def providers(**statuses):
    return {
        key: {"source_key": key, "name": key, "status": status, "reason": None if status == "available" else f"{key} reason"}
        for key, status in statuses.items()
    }


def item(sections, section_key, label):
    section = next(section for section in sections if section["key"] == section_key)
    return next(entry for entry in section["items"] if entry["label"] == label)


def test_catalogue_covers_every_specification_section_in_order():
    assert [section.key for section in catalogue.SECTIONS] == [
        "air_quality", "surface_water", "groundwater", "meteorology", "ecology", "land", "soil",
        "noise", "carbon", "resource", "waste", "socio_economic", "natural_hazards",
    ]


def test_item_available_from_matching_observation():
    record = observation(section="air_quality", category="Air", parameter="pm25", parameter_name="PM2.5",
                         value_numeric=40, unit="µg/m³", source_key="openaq", data_type="observed")
    sections = catalogue.evaluate([record], providers(openaq="available"), REQUEST)
    pm25 = item(sections, "air_quality", "PM2.5")
    assert pm25["status"] == "available"
    assert pm25["sources"] == ["openaq"]
    assert pm25["summary"] == "PM2.5: 40 µg/m³"


def test_none_found_result_is_a_completed_analysis():
    record = gis_feature(section="ecology", feature_type="nearest_wetland", source_key="osm_overpass",
                         value_text="None found within 10 km", metadata={"found": False})
    wetlands = item(catalogue.evaluate([record], {}, REQUEST), "ecology", "Wetlands")
    assert wetlands["status"] == "available"
    assert "None found within 10 km" in wetlands["summary"]


def test_status_follows_provider_outcomes_when_no_records():
    sections = catalogue.evaluate([], providers(openaq="skipped", cpcb_ogd="error", open_meteo_air_quality="error"), REQUEST)
    black_carbon = item(sections, "air_quality", "Black Carbon")
    assert black_carbon["status"] == "skipped"
    assert "openaq reason" in black_carbon["reason"]
    assert item(sections, "air_quality", "PM10")["status"] == "error"


def test_unintegrated_items_project_inputs_and_request_values():
    sections = catalogue.evaluate([], {}, REQUEST)
    assert item(sections, "surface_water", "pH")["status"] == "unavailable"
    assert "CPCB/CWC" in item(sections, "surface_water", "pH")["reason"]
    assert item(sections, "noise", "Leq Day")["status"] == "project_input"
    assert item(sections, "land", "Latitude") | {} == item(sections, "land", "Latitude")
    assert item(sections, "land", "Latitude")["summary"] == "28.6139"


def test_section_status_priority():
    record = observation(section="air_quality", category="Air", parameter="pm10", parameter_name="PM10",
                         value_numeric=1, source_key="open_meteo_air_quality", data_type="modelled")
    statuses = {section["key"]: section["status"] for section in catalogue.evaluate([record], {}, REQUEST)}
    assert statuses["air_quality"] == "available"
    assert statuses["resource"] == "project_input"
    assert statuses["surface_water"] == "unavailable"


def test_required_inputs_match_project_input_items():
    inputs = catalogue.required_inputs()
    project_items = [entry for section in catalogue.SECTIONS for entry in section.items if entry.required_input]
    assert len(inputs) == len(project_items)
    assert {"leq_day", "annual_production", "hazardous_waste", "soil_phosphorus"} <= {entry["parameter_name"] for entry in inputs}
