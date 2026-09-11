from fastapi import APIRouter

from app.schemas import EnvironmentalDataRequest, EnvironmentalDataResponse
from app.services import environmental_data_service as service

router = APIRouter(tags=["environmental-data"])


@router.post("/environmental/fetch", response_model=EnvironmentalDataResponse)
async def fetch_environmental_data(body: EnvironmentalDataRequest):
    """
    Collects environmental baseline data and GIS context for a project site.

    Stateless - nothing is stored. The Node backend sends the site location,
    project context and the assessment inputs entered so far, then persists
    observations -> environmental_data, gis_features -> gis_analysis_results,
    and providers -> data_sources + data_fetch_logs.
    `sections` reports the status of every item in the environmental data
    specification; `required_inputs` lists what must come from the project and
    whether it has been provided.
    """
    return await service.collect_environmental_data(
        body.location.latitude,
        body.location.longitude,
        radius_km=body.radius_km,
        assessment_id=body.assessment_id,
        location=body.location.model_dump(),
        project=body.project.model_dump() if body.project else None,
        assessment_inputs=[entry.model_dump() for entry in body.assessment_inputs],
    )
