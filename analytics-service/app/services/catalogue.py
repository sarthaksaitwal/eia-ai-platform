"""
The environmental data catalogue from the project specification
("EIA Environmental Data Providers and Architecture", sections 1.1-1.13).

Every catalogue item says which record keys (observation.parameter or
gis_feature.feature_type) satisfy it. After a fetch, each item is reported as:

  available       at least one record satisfies it
  unavailable     nothing usable (no integrated source, or provider had no data)
  error           every provider that could supply it failed
  skipped         every provider that could supply it is not configured
  project_input   cannot come from a coordinate; must be entered as an
                  assessment input (consultant, laboratory or project data)

so the response accounts for every item in the specification, including the
ones this service cannot legitimately derive from latitude/longitude.
Project-input items become available once the backend sends a value for them
(an assessment input, or a project field such as land area).
"""
from dataclasses import dataclass, field
from typing import Any, Optional

AVAILABLE = "available"
UNAVAILABLE = "unavailable"
ERROR = "error"
SKIPPED = "skipped"
PROJECT_INPUT = "project_input"

# Where a provided required-input value came from.
ASSESSMENT_INPUT = "assessment_input"
PROJECT = "project"

# Project fields that answer a required input when no assessment input was entered for it.
PROJECT_FIELD_INPUTS = {"land_requirement": ("land_area", "land_area_unit")}


@dataclass(frozen=True)
class RequiredInput:
    category: str
    parameter_name: str
    suggested_unit: Optional[str] = None


@dataclass(frozen=True)
class Item:
    label: str
    spec_provider: str
    keys: tuple[str, ...] = ()
    sources: tuple[str, ...] = ()
    note: Optional[str] = None
    unavailable_reason: Optional[str] = None
    required_input: Optional[RequiredInput] = None
    from_request: Optional[str] = None  # "latitude" / "longitude"


@dataclass(frozen=True)
class Section:
    key: str
    title: str
    items: tuple[Item, ...] = field(default_factory=tuple)


AQ_SOURCES = ("openaq", "cpcb_ogd", "open_meteo_air_quality")
WEATHER = ("open_meteo_weather",)
ARCHIVE = ("open_meteo_archive",)
OSM = ("osm_overpass",)
OSM_NOTE = "From OpenStreetMap - geographic context, not authoritative regulatory evidence."
BHUVAN_NOTE = "Bhuvan/ISRO thematic layers are not integrated; OpenStreetMap is used as context."
PROTECTED_NOTE = "Protected Planet/WDPA API is not integrated (token required); OpenStreetMap is used as context."

SURFACE_WATER_REASON = (
    "No CPCB/CWC surface-water quality dataset is integrated. Official datasets are station and period based "
    "and must be selected and configured explicitly; baseline characterisation may need site sampling."
)
GROUNDWATER_REASON = (
    "No CGWB groundwater dataset is integrated. Regional datasets must be selected and configured explicitly; "
    "baseline characterisation may need project-site sampling."
)


def _pollutant(label: str, key: str) -> Item:
    return Item(label, "OpenAQ / CPCB", (key, f"{key}_aqi_subindex"), AQ_SOURCES,
                note="CPCB values are AQI sub-indices; Open-Meteo values are modelled.")


def _water(label: str, reason: str, provider: str) -> Item:
    return Item(label, provider, unavailable_reason=reason)


def _input(label: str, category: str, parameter_name: str, unit: Optional[str], provider: str = "Project input") -> Item:
    return Item(label, provider, required_input=RequiredInput(category, parameter_name, unit))


SECTIONS: tuple[Section, ...] = (
    Section("air_quality", "Air Quality and Atmospheric Conditions", (
        _pollutant("PM2.5", "pm25"),
        _pollutant("PM10", "pm10"),
        _pollutant("SO2", "so2"),
        _pollutant("NO2", "no2"),
        _pollutant("CO", "co"),
        _pollutant("O3", "o3"),
        Item("Black Carbon", "OpenAQ where available", ("black_carbon",), ("openaq",)),
        Item("Monitoring stations", "OpenAQ / CPCB", ("air_monitoring_station",), ("openaq", "cpcb_ogd")),
        Item("Air temperature", "Open-Meteo", ("air_temperature",), WEATHER),
        Item("Relative humidity", "Open-Meteo / OpenAQ", ("relative_humidity",), WEATHER + ("openaq",)),
        Item("Wind speed", "Open-Meteo", ("wind_speed",), WEATHER),
        Item("Wind direction", "Open-Meteo", ("wind_direction",), WEATHER),
        Item("Atmospheric pressure", "Open-Meteo", ("atmospheric_pressure",), WEATHER),
        Item("Precipitation", "Open-Meteo", ("precipitation",), WEATHER),
        Item("Boundary layer height", "Open-Meteo", ("boundary_layer_height",), WEATHER),
    )),
    Section("surface_water", "Water - Surface Water", tuple(
        _water(label, SURFACE_WATER_REASON, "CPCB/CWC") for label in (
            "pH", "Dissolved Oxygen (DO)", "BOD", "COD", "Electrical conductivity", "Temperature",
            "Total Suspended Solids", "Nitrate", "Phosphate", "Total coliform", "Fecal coliform",
            "Heavy metals", "Monitoring station location",
        )
    )),
    Section("groundwater", "Water - Groundwater", tuple(
        _water(label, GROUNDWATER_REASON, "CGWB") for label in (
            "Groundwater level/depth", "pH", "TDS", "Electrical conductivity", "Chloride", "Fluoride",
            "Nitrate", "Sulphate", "Iron", "Arsenic", "Heavy metals", "Groundwater quality classification",
        )
    )),
    Section("meteorology", "Meteorological / Climate Data", (
        Item("Temperature", "Open-Meteo", ("air_temperature", "historical_mean_temperature"), WEATHER + ARCHIVE),
        Item("Relative humidity", "Open-Meteo", ("relative_humidity",), WEATHER),
        Item("Rainfall", "Open-Meteo", ("precipitation", "historical_annual_rainfall"), WEATHER + ARCHIVE),
        Item("Wind speed", "Open-Meteo", ("wind_speed", "historical_mean_daily_max_wind_speed"), WEATHER + ARCHIVE),
        Item("Wind direction", "Open-Meteo", ("wind_direction", "mean_dominant_wind_direction"), WEATHER + ARCHIVE),
        Item("Solar radiation", "Open-Meteo", ("solar_radiation", "historical_daily_solar_radiation"), WEATHER + ARCHIVE),
        Item("Cloud cover", "Open-Meteo", ("cloud_cover",), WEATHER),
        Item("Atmospheric pressure", "Open-Meteo", ("atmospheric_pressure",), WEATHER),
        Item("Evapotranspiration", "Open-Meteo", ("evapotranspiration", "historical_annual_evapotranspiration"), WEATHER + ARCHIVE),
        Item("Soil moisture", "Open-Meteo", ("soil_moisture",), WEATHER),
        Item("Soil temperature", "Open-Meteo", ("soil_temperature",), WEATHER),
        Item("Boundary layer height", "Open-Meteo", ("boundary_layer_height",), WEATHER),
        Item("Historical climate", "Open-Meteo",
             ("historical_mean_temperature", "historical_annual_rainfall", "historical_mean_daily_max_temperature"), ARCHIVE),
        Item("Climate projections", "Open-Meteo Climate API",
             ("projected_mean_temperature", "projected_temperature_change", "projected_annual_rainfall", "projected_rainfall_change"),
             ("open_meteo_climate",)),
    )),
    Section("ecology", "Ecology / Biodiversity", (
        Item("Protected areas", "Protected Planet / WDPA", ("protected_area", "nearest_protected_area"), OSM, PROTECTED_NOTE),
        Item("National parks", "Protected Planet / government datasets", ("nearest_national_park",), OSM, PROTECTED_NOTE),
        Item("Wildlife sanctuaries", "Protected Planet / government datasets", ("nearest_wildlife_sanctuary",), OSM, PROTECTED_NOTE),
        Item("Biosphere reserves", "Government / Bhuvan", ("nearest_biosphere_reserve",), OSM, PROTECTED_NOTE),
        Item("Eco-sensitive areas", "Government / Bhuvan where available",
             unavailable_reason="MoEFCC eco-sensitive zone notifications/boundaries are not integrated."),
        Item("Forest areas", "Bhuvan / forest datasets", ("nearest_forest",), OSM, BHUVAN_NOTE),
        Item("Land-use / land-cover", "Bhuvan", ("site_land_use", "site_land_cover"), OSM, BHUVAN_NOTE),
        Item("Wetlands", "Bhuvan / government datasets", ("nearest_wetland",), OSM, BHUVAN_NOTE),
        Item("Lakes", "Bhuvan / OSM", ("nearest_lake",), OSM, OSM_NOTE),
        Item("Rivers", "Bhuvan / OSM", ("nearest_river",), OSM, OSM_NOTE),
        Item("Water bodies", "Bhuvan / OSM", ("nearest_water_body",), OSM, OSM_NOTE),
        Item("Ecologically sensitive zones", "Government GIS datasets",
             unavailable_reason="Government ecologically sensitive zone datasets are not integrated."),
        Item("Distance to protected area", "Our PostGIS calculation", ("nearest_protected_area",), OSM, PROTECTED_NOTE),
        Item("Distance to forest", "Our PostGIS calculation", ("nearest_forest",), OSM, OSM_NOTE),
        Item("Distance to wetland", "Our PostGIS calculation", ("nearest_wetland",), OSM, OSM_NOTE),
        Item("Distance to river/lake", "Our PostGIS calculation", ("nearest_river", "nearest_lake"), OSM, OSM_NOTE),
    )),
    Section("land", "Land / GIS Context Data", (
        Item("Latitude", "Project input", from_request="latitude"),
        Item("Longitude", "Project input", from_request="longitude"),
        Item("Elevation", "Open-Meteo / DEM", ("elevation",), ("open_meteo_elevation",)),
        Item("Land-use type", "Bhuvan", ("site_land_use",), OSM, BHUVAN_NOTE),
        Item("Land-cover type", "Bhuvan", ("site_land_cover",), OSM, BHUVAN_NOTE),
        Item("Forest proximity", "Bhuvan / government GIS", ("nearest_forest",), OSM, BHUVAN_NOTE),
        Item("River proximity", "Bhuvan / OSM", ("nearest_river",), OSM, OSM_NOTE),
        Item("Lake proximity", "Bhuvan / OSM", ("nearest_lake",), OSM, OSM_NOTE),
        Item("Wetland proximity", "Bhuvan / government GIS", ("nearest_wetland",), OSM, BHUVAN_NOTE),
        Item("Protected-area proximity", "Protected Planet", ("nearest_protected_area",), OSM, PROTECTED_NOTE),
        Item("Settlement proximity", "OSM / Bhuvan", ("nearest_settlement",), OSM, OSM_NOTE),
        Item("Road proximity", "OSM", ("nearest_road",), OSM, OSM_NOTE),
        Item("Railway proximity", "OSM", ("nearest_railway",), OSM, OSM_NOTE),
        Item("Airport proximity", "OSM", ("nearest_airport",), OSM, OSM_NOTE),
        Item("School proximity", "OSM", ("nearest_school",), OSM, OSM_NOTE),
        Item("Hospital proximity", "OSM", ("nearest_hospital",), OSM, OSM_NOTE),
        Item("Industrial-area proximity", "OSM / government GIS", ("nearest_industrial_area",), OSM, OSM_NOTE),
        Item("Urban-area proximity", "Bhuvan / OSM", ("nearest_urban_area",), OSM, OSM_NOTE),
        Item("Drainage / watershed", "Bhuvan", unavailable_reason="Bhuvan drainage/watershed layers are not integrated."),
        Item("Flood-prone area", "Bhuvan / government GIS",
             unavailable_reason="Official flood-hazard zonation is not integrated (see natural hazards for river discharge context)."),
        Item("Terrain / slope", "DEM / Bhuvan", ("slope",), ("open_meteo_elevation",)),
        Item("Aspect", "DEM / Bhuvan", ("aspect",), ("open_meteo_elevation",)),
    )),
    Section("soil", "Soil Data", (
        Item("Soil type", "Government soil datasets / Bhuvan", ("soil_type",), ("soilgrids_classification",),
             "SoilGrids (ISRIC) modelled 250 m map; not a substitute for site sampling."),
        Item("Soil texture", "Government soil datasets", ("soil_texture", "soil_clay", "soil_sand", "soil_silt"),
             ("soilgrids_properties",), "SoilGrids modelled values."),
        Item("Soil pH", "Soil datasets", ("soil_ph",), ("soilgrids_properties",), "SoilGrids modelled values."),
        Item("Organic carbon", "Soil datasets", ("soil_organic_carbon",), ("soilgrids_properties",), "SoilGrids modelled values."),
        Item("Nitrogen", "Soil datasets", ("soil_nitrogen",), ("soilgrids_properties",), "SoilGrids modelled values."),
        _input("Phosphorus", "Soil", "soil_phosphorus", "mg/kg", "Soil datasets / laboratory"),
        _input("Potassium", "Soil", "soil_potassium", "mg/kg", "Soil datasets / laboratory"),
        _input("Salinity / EC", "Soil", "soil_electrical_conductivity", "dS/m", "Soil datasets / laboratory"),
        _input("Heavy-metal contamination", "Soil", "soil_heavy_metals", "mg/kg", "Available datasets / project sampling"),
    )),
    Section("noise", "Noise", (
        Item("Nearby roads", "OSM / government GIS", ("nearest_road",), OSM, OSM_NOTE),
        Item("Nearby railway", "OSM / government GIS", ("nearest_railway",), OSM, OSM_NOTE),
        Item("Nearby airports", "OSM / government GIS", ("nearest_airport",), OSM, OSM_NOTE),
        Item("Nearby industrial facilities", "OSM / government GIS", ("nearest_industrial_area",), OSM, OSM_NOTE),
        Item("Nearby settlements", "OSM / government GIS", ("nearest_settlement",), OSM, OSM_NOTE),
        _input("Leq Day", "Noise", "leq_day", "dB(A)", "Project / consultant measurement"),
        _input("Leq Night", "Noise", "leq_night", "dB(A)", "Project / consultant measurement"),
        _input("Lmax", "Noise", "lmax", "dB(A)", "Project / consultant measurement"),
        _input("Lmin", "Noise", "lmin", "dB(A)", "Project / consultant measurement"),
        _input("Measurement location", "Noise", "noise_measurement_location", None, "Project / consultant measurement"),
        _input("Measurement date/time", "Noise", "noise_measurement_datetime", None, "Project / consultant measurement"),
    )),
    Section("carbon", "Carbon / Climate", (
        Item("Solar radiation", "Open-Meteo", ("historical_daily_solar_radiation", "solar_radiation"), ARCHIVE + WEATHER),
        Item("Temperature", "Open-Meteo", ("historical_mean_temperature", "air_temperature"), ARCHIVE + WEATHER),
        Item("Historical climate", "Open-Meteo", ("historical_mean_temperature", "historical_annual_rainfall"), ARCHIVE),
        Item("Renewable-energy potential context", "Open-Meteo / GIS", ("solar_energy_potential",), ARCHIVE),
        Item("Grid/contextual information", "Government / utility datasets",
             unavailable_reason="Grid emission factors must come from an authoritative source (e.g. CEA CO2 Baseline "
                                "Database) and belong in engineering_coefficients."),
        _input("Electricity consumption", "Carbon", "electricity_consumption", "MWh/year"),
        _input("Coal consumption", "Carbon", "coal_consumption", "t/year"),
        _input("Diesel consumption", "Carbon", "diesel_consumption", "kL/year"),
        _input("Natural gas consumption", "Carbon", "natural_gas_consumption", "Sm³/year"),
        _input("Petrol consumption", "Carbon", "petrol_consumption", "kL/year"),
        _input("Fuel oil consumption", "Carbon", "fuel_oil_consumption", "kL/year"),
        _input("Biomass consumption", "Carbon", "biomass_consumption", "t/year"),
        _input("Production quantity", "Carbon", "annual_production", "t/year"),
    )),
    Section("resource", "Resource Consumption", (
        _input("Freshwater consumption", "Resource", "freshwater_consumption", "m³/year"),
        _input("Groundwater consumption", "Resource", "groundwater_consumption", "m³/year"),
        _input("Surface-water consumption", "Resource", "surface_water_consumption", "m³/year"),
        _input("Electricity consumption", "Resource", "electricity_consumption", "MWh/year"),
        _input("Fuel consumption", "Resource", "fuel_consumption", None),
        _input("Raw-material consumption", "Resource", "raw_material_consumption", "t/year"),
        _input("Land requirement", "Resource", "land_requirement", "ha"),
        _input("Recycled water", "Resource", "recycled_water", "m³/year"),
        _input("Water reuse", "Resource", "water_reuse", "m³/year"),
        _input("Wastewater generation", "Resource", "wastewater_generation", "m³/year"),
    )),
    Section("waste", "Waste", (
        _input("Hazardous waste", "Waste", "hazardous_waste", "t/year"),
        _input("Non-hazardous waste", "Waste", "non_hazardous_waste", "t/year"),
        _input("Municipal waste", "Waste", "municipal_waste", "t/year"),
        _input("Biomedical waste", "Waste", "biomedical_waste", "t/year", "Project input where applicable"),
        _input("E-waste", "Waste", "e_waste", "t/year"),
        _input("Wastewater / sludge", "Waste", "sludge", "t/year"),
        _input("Fly ash", "Waste", "fly_ash", "t/year", "Project input where applicable"),
        _input("Waste generation rate", "Waste", "waste_generation_rate", "t/t product", "Project input / calculation"),
        _input("Recycling rate", "Waste", "recycling_rate", "%"),
        _input("Disposal method", "Waste", "disposal_method", None),
    )),
    Section("socio_economic", "Socio-economic / Human Environment", (
        Item("Population density", "Census / government datasets",
             ("population_density_within_1km", "population_density_within_5km", "population_density_within_10km"),
             ("worldpop",), "WorldPop 2020 gridded population; Census of India has no coordinate API."),
        Item("Nearby settlements", "OSM / Bhuvan", ("nearest_settlement", "settlement_count"), OSM, OSM_NOTE),
        Item("Population within 1/5/10 km", "Census / government + GIS",
             ("population_within_1km", "population_within_5km", "population_within_10km"), ("worldpop",),
             "WorldPop 2020 gridded population."),
        Item("Schools", "OSM", ("nearest_school", "school_count"), OSM, OSM_NOTE),
        Item("Hospitals", "OSM", ("nearest_hospital", "hospital_count"), OSM, OSM_NOTE),
        Item("Residential areas", "OSM / Bhuvan", ("nearest_residential_area",), OSM, OSM_NOTE),
        Item("Industrial areas", "OSM / government GIS", ("nearest_industrial_area",), OSM, OSM_NOTE),
        Item("Roads", "OSM", ("nearest_road",), OSM, OSM_NOTE),
        Item("Railways", "OSM", ("nearest_railway",), OSM, OSM_NOTE),
        Item("Employment context", "Government datasets",
             unavailable_reason="Census/PLFS employment datasets are not integrated."),
    )),
    Section("natural_hazards", "Natural Hazards", (
        Item("Flood risk", "Bhuvan / government GIS", ("mean_river_discharge", "peak_river_discharge"), ("open_meteo_flood",),
             "GloFAS river discharge context only; official flood-hazard zonation is not integrated."),
        Item("Drought", "Government / remote-sensing datasets", ("driest_year_rainfall",), ARCHIVE,
             "Rainfall variability context only; not an official drought classification."),
        Item("Cyclone exposure", "IMD / government datasets", unavailable_reason="IMD cyclone hazard datasets are not integrated."),
        Item("Earthquake / seismic zone", "Government / GSI / official seismic maps",
             ("earthquake_count", "largest_earthquake", "nearest_earthquake"), ("usgs_earthquakes",),
             "Historical seismicity (USGS); the BIS IS 1893 seismic zone is not integrated."),
        Item("Landslide susceptibility", "Government / GSI / Bhuvan",
             unavailable_reason="GSI/Bhuvan landslide susceptibility maps are not integrated."),
        Item("Extreme rainfall", "Open-Meteo / IMD", ("max_daily_rainfall",), ARCHIVE),
        Item("Extreme temperature", "Open-Meteo / IMD", ("highest_max_temperature", "lowest_min_temperature"), ARCHIVE),
        Item("Forest-fire susceptibility", "Government / remote-sensing datasets",
             unavailable_reason="Forest-fire datasets (FSI / NASA FIRMS) are not integrated."),
    )),
)


def _record_key(record: dict) -> str:
    return record.get("parameter") or record.get("feature_type") or ""


def _summary(record: dict) -> str:
    if record.get("value_text") and record.get("value_numeric") is None:
        text = record["value_text"]
    elif record.get("value_numeric") is not None:
        text = f"{record['value_numeric']:g} {record.get('unit') or ''}".strip()
    else:
        text = ""
    if record.get("distance_m") is not None:
        text = f"{text} {record['distance_m']:,.0f} m".strip()
    name = record.get("feature_name") or record.get("parameter_name")
    return f"{name}: {text}" if name and text else (name or text)


def provided_inputs(assessment_inputs: Optional[list[dict]], project: Optional[dict]) -> dict[str, list[dict]]:
    """Required-input values sent by the backend, keyed by parameter_name.

    Inputs without a value are ignored. A project field only fills a required
    input when no assessment input was entered for it."""
    provided: dict[str, list[dict]] = {}
    for entry in assessment_inputs or []:
        if entry.get("value_numeric") is None and not (entry.get("value_text") or "").strip():
            continue
        provided.setdefault(entry["parameter_name"], []).append({**entry, "origin": ASSESSMENT_INPUT})

    project = project or {}
    for parameter_name, (value_field, unit_field) in PROJECT_FIELD_INPUTS.items():
        if parameter_name not in provided and project.get(value_field) is not None:
            provided[parameter_name] = [{
                "parameter_name": parameter_name,
                "value_numeric": project[value_field],
                "unit": project.get(unit_field),
                "origin": PROJECT,
            }]
    return provided


def _input_summary(label: str, entry: dict) -> str:
    value = f"{entry['value_numeric']:g}" if entry.get("value_numeric") is not None else entry.get("value_text")
    return f"{label}: {value} {entry.get('unit') or ''}".strip()


def evaluate(
    records: list[dict], providers: dict[str, dict], request: dict[str, Any], provided: Optional[dict[str, list[dict]]] = None
) -> list[dict]:
    """Status of every catalogue item for one fetch. providers is keyed by source_key;
    provided comes from provided_inputs()."""
    by_key: dict[str, list[dict]] = {}
    for record in records:
        by_key.setdefault(_record_key(record), []).append(record)

    sections = []
    for section in SECTIONS:
        items = [_evaluate_item(item, by_key, providers, request, provided or {}) for item in section.items]
        sections.append({"key": section.key, "title": section.title, "status": _section_status(items), "items": items})
    return sections


def _evaluate_item(item: Item, by_key: dict, providers: dict, request: dict, provided: dict) -> dict:
    result = {
        "label": item.label,
        "spec_provider": item.spec_provider,
        "status": UNAVAILABLE,
        "sources": [],
        "summary": None,
        "reason": None,
        "note": item.note,
        "record_count": 0,
    }

    if item.from_request:
        return {**result, "status": AVAILABLE, "sources": ["request"], "summary": str(request.get(item.from_request))}
    if item.required_input:
        entries = provided.get(item.required_input.parameter_name, [])
        if entries:
            return {
                **result,
                "status": AVAILABLE,
                "sources": sorted({entry["origin"] for entry in entries}),
                "summary": _input_summary(item.label, entries[-1]),
                "record_count": len(entries),
            }
        return {
            **result,
            "status": PROJECT_INPUT,
            "reason": "Cannot be derived from latitude/longitude; enter it as an assessment input.",
        }
    if item.unavailable_reason:
        return {**result, "reason": item.unavailable_reason}

    matches = [record for key in item.keys for record in by_key.get(key, [])]
    if matches:
        # "None found within X km" is a completed analysis, so it still counts
        # as available - the summary carries the finding.
        found = [record for record in matches if record.get("metadata", {}).get("found", True)]
        best = found[0] if found else matches[0]
        return {
            **result,
            "status": AVAILABLE,
            "sources": sorted({record["source_key"] for record in matches}),
            "summary": _summary(best),
            "record_count": len(matches),
        }

    outcomes = [providers[source] for source in item.sources if source in providers]
    statuses = {outcome["status"] for outcome in outcomes}
    reasons = "; ".join(f"{outcome['name']}: {outcome['reason']}" for outcome in outcomes if outcome.get("reason"))
    if outcomes and statuses == {SKIPPED}:
        return {**result, "status": SKIPPED, "reason": reasons}
    if outcomes and statuses <= {ERROR, SKIPPED}:
        return {**result, "status": ERROR, "reason": reasons}
    return {**result, "reason": reasons or "No provider returned this value for the location."}


def _section_status(items: list[dict]) -> str:
    statuses = {item["status"] for item in items}
    for status in (AVAILABLE, ERROR, SKIPPED, UNAVAILABLE):
        if status in statuses:
            return status
    return PROJECT_INPUT


def required_inputs(provided: Optional[dict[str, list[dict]]] = None) -> list[dict]:
    """Assessment inputs the specification expects from the project/consultant."""
    provided = provided or {}
    return [
        {
            "section": section.key,
            "label": item.label,
            "category": item.required_input.category,
            "parameter_name": item.required_input.parameter_name,
            "suggested_unit": item.required_input.suggested_unit,
            "source": item.spec_provider,
            "provided": item.required_input.parameter_name in provided,
        }
        for section in SECTIONS
        for item in section.items
        if item.required_input
    ]
