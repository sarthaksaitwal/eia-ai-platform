"""
Thin client around the ISRIC SoilGrids v2.0 REST API (https://rest.isric.org).

SoilGrids is a global *modelled* 250 m soil map. It is screening context only:
generic soil maps are not equivalent to project-site laboratory sampling.
The service can be slow (tens of seconds), so a longer timeout is used.
"""
from app.services.clients.http import get_json

PROPERTIES_ENDPOINT = "https://rest.isric.org/soilgrids/v2.0/properties/query"
CLASSIFICATION_ENDPOINT = "https://rest.isric.org/soilgrids/v2.0/classification/query"

PROPERTIES = ("phh2o", "soc", "nitrogen", "clay", "sand", "silt", "cec")
DEPTHS = ("0-5cm", "5-15cm", "15-30cm")
TIMEOUT_SECONDS = 90.0


async def fetch_properties(latitude: float, longitude: float) -> dict:
    params = [("lon", longitude), ("lat", latitude), ("value", "mean")]
    params += [("property", name) for name in PROPERTIES] + [("depth", depth) for depth in DEPTHS]
    return await get_json(PROPERTIES_ENDPOINT, params=params, timeout=TIMEOUT_SECONDS)


async def fetch_classification(latitude: float, longitude: float) -> dict:
    return await get_json(
        CLASSIFICATION_ENDPOINT,
        params={"lon": longitude, "lat": latitude, "number_classes": 3},
        timeout=TIMEOUT_SECONDS,
    )
