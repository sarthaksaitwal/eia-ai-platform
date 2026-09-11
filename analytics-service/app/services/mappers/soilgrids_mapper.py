"""
Maps SoilGrids responses onto soil observations. Kept pure (no I/O).

Values are modelled (250 m grid), so every record is tagged data_type
"modelled" with a note that site sampling is required for baseline
characterisation.
"""
from typing import Any, Optional

from app.services.mappers.common import DERIVED, MODELLED, observation, to_finite_float

SOURCE_PROPERTIES = "soilgrids_properties"
SOURCE_CLASSIFICATION = "soilgrids_classification"

PROPERTY_NAMES = {
    "phh2o": ("soil_ph", "Soil pH (H2O)"),
    "soc": ("soil_organic_carbon", "Soil Organic Carbon"),
    "nitrogen": ("soil_nitrogen", "Soil Total Nitrogen"),
    "clay": ("soil_clay", "Clay Content"),
    "sand": ("soil_sand", "Sand Content"),
    "silt": ("soil_silt", "Silt Content"),
    "cec": ("soil_cec", "Cation Exchange Capacity"),
}

NOTE = "Modelled SoilGrids 250 m value; not a substitute for project-site laboratory sampling."


def usda_texture_class(sand: float, silt: float, clay: float) -> Optional[str]:
    """USDA soil texture triangle (percentages)."""
    if silt + 1.5 * clay < 15:
        return "Sand"
    if silt + 2 * clay < 30:
        return "Loamy Sand"
    if (7 <= clay < 20 and sand > 52) or (clay < 7 and silt < 50):
        return "Sandy Loam"
    if 7 <= clay < 27 and 28 <= silt < 50 and sand <= 52:
        return "Loam"
    if silt >= 80 and clay < 12:
        return "Silt"
    if (silt >= 50 and 12 <= clay < 27) or (50 <= silt < 80 and clay < 12):
        return "Silt Loam"
    if 20 <= clay < 35 and silt < 28 and sand > 45:
        return "Sandy Clay Loam"
    if 27 <= clay < 40 and 20 < sand <= 45:
        return "Clay Loam"
    if 27 <= clay < 40 and sand <= 20:
        return "Silty Clay Loam"
    if clay >= 35 and sand > 45:
        return "Sandy Clay"
    if clay >= 40 and silt >= 40:
        return "Silty Clay"
    if clay >= 40:
        return "Clay"
    return None


def map_properties(raw: dict[str, Any]) -> list[dict]:
    rows = []
    topsoil: dict[str, float] = {}
    for layer in (raw.get("properties") or {}).get("layers") or []:
        mapped = PROPERTY_NAMES.get(layer.get("name"))
        units = layer.get("unit_measure") or {}
        factor = to_finite_float(units.get("d_factor")) or 1.0
        if mapped is None:
            continue
        for depth in layer.get("depths") or []:
            value = to_finite_float((depth.get("values") or {}).get("mean"))
            if value is None:
                continue
            converted = round(value / factor, 3)
            label = depth.get("label")
            if label == "0-5cm":
                topsoil[layer["name"]] = converted
            rows.append(
                observation(
                    section="soil",
                    category="Soil",
                    parameter=mapped[0],
                    parameter_name=f"{mapped[1]} ({label})",
                    value_numeric=converted,
                    unit="pH" if layer["name"] == "phh2o" else units.get("target_units"),
                    source_key=SOURCE_PROPERTIES,
                    data_type=MODELLED,
                    metadata={"depth": label, "note": NOTE},
                )
            )

    if all(key in topsoil for key in ("sand", "silt", "clay")):
        texture = usda_texture_class(topsoil["sand"], topsoil["silt"], topsoil["clay"])
        if texture:
            rows.append(
                observation(
                    section="soil",
                    category="Soil",
                    parameter="soil_texture",
                    parameter_name="Soil Texture Class (0-5cm, USDA)",
                    value_text=texture,
                    source_key=SOURCE_PROPERTIES,
                    data_type=DERIVED,
                    metadata={"sand_percent": topsoil["sand"], "silt_percent": topsoil["silt"],
                              "clay_percent": topsoil["clay"], "note": NOTE},
                )
            )
    return rows


def map_classification(raw: dict[str, Any]) -> list[dict]:
    name = raw.get("wrb_class_name")
    if not name:
        return []
    return [
        observation(
            section="soil",
            category="Soil",
            parameter="soil_type",
            parameter_name="Soil Type (WRB Reference Soil Group)",
            value_text=name,
            source_key=SOURCE_CLASSIFICATION,
            data_type=MODELLED,
            metadata={"class_probabilities": raw.get("wrb_class_probability"), "note": NOTE},
        )
    ]
