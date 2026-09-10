from fastapi import APIRouter

from app.schemas import EnvironmentalDataRequest, EnvironmentalDataResponse
from app.services import environmental_data_service as service

router = APIRouter(tags=["environmental-data"])


@router.post("/environmental/fetch", response_model=EnvironmentalDataResponse)
async def fetch_environmental_data(body: EnvironmentalDataRequest):
    """
    Collects environmental baseline data and GIS context for a coordinate.

    Stateless - nothing is stored. The Node backend calls this endpoint and
    persists observations -> environmental_data, gis_features ->
    gis_analysis_results, and providers -> data_sources + data_fetch_logs.
    `sections` reports the status of every item in the environmental data
    specification; `required_inputs` lists what must come from the project.
    """
    return await service.collect_environmental_data(
        body.latitude,
        body.longitude,
        radius_km=body.radius_km,
        assessment_id=body.assessment_id,
    )
