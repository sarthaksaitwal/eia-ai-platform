"""Maps WorldPop population statistics onto gis_feature records. Pure (no I/O)."""
import math
from typing import Any

from app.services.mappers.common import gis_feature, to_finite_float

SOURCE_KEY = "worldpop"
DATASET_NOTE = "WorldPop Global 2020 unconstrained 100 m population grid"


def polygon_area_km2(radius_m: float, vertices: int) -> float:
    """Area of the regular polygon used to approximate the search circle."""
    return 0.5 * vertices * radius_m**2 * math.sin(2 * math.pi / vertices) / 1_000_000


def map_population(raw: dict[str, Any], *, radius_m: float, vertices: int) -> list[dict]:
    total = to_finite_float((raw.get("data") or {}).get("total_population"))
    if total is None:
        return []

    radius_km = radius_m / 1000
    area_km2 = polygon_area_km2(radius_m, vertices)
    metadata = {"dataset": DATASET_NOTE, "radius_m": radius_m, "area_km2": round(area_km2, 3)}
    return [
        gis_feature(
            section="socio_economic",
            feature_type=f"population_within_{radius_km:g}km",
            value_numeric=round(total),
            unit="persons",
            source_key=SOURCE_KEY,
            metadata=metadata,
        ),
        gis_feature(
            section="socio_economic",
            feature_type=f"population_density_within_{radius_km:g}km",
            value_numeric=round(total / area_km2, 1),
            unit="persons/km²",
            source_key=SOURCE_KEY,
            metadata={**metadata, "method": "population / buffer area"},
        ),
    ]
