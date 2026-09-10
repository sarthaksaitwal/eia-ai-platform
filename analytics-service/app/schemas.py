from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

ProviderStatus = Literal["available", "unavailable", "error", "skipped"]
ItemStatus = Literal["available", "unavailable", "error", "skipped", "project_input"]


class EnvironmentalDataRequest(BaseModel):
    assessment_id: Optional[str] = Field(default=None, description="Echoed back for traceability only.")
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_km: Optional[float] = Field(
        default=None, gt=0, le=25,
        description="Radius for monitoring stations and wide-area GIS features. Defaults to DEFAULT_RADIUS_KM.",
    )


class RequestEcho(BaseModel):
    assessment_id: Optional[str] = None
    latitude: float
    longitude: float
    radius_km: float


class Observation(BaseModel):
    """One environmental_data row."""

    section: str
    category: str
    parameter: str
    parameter_name: str
    value_numeric: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    recorded_at: Optional[datetime] = None
    source_key: str
    data_type: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class GisFeature(BaseModel):
    """One gis_analysis_results row."""

    section: str
    feature_type: str
    feature_name: Optional[str] = None
    distance_m: Optional[float] = None
    inside_boundary: Optional[bool] = None
    sensitivity_level: Optional[str] = None
    value_numeric: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    source_key: str
    source_reference: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ProviderOutcome(BaseModel):
    """One provider call; maps onto data_sources + data_fetch_logs."""

    source_key: str
    name: str
    provider: str
    source_type: str
    endpoint: Optional[str] = None
    status: ProviderStatus
    reason: Optional[str] = None
    record_count: int
    response_time_ms: int
    request_parameters: dict[str, Any]


class CatalogueItem(BaseModel):
    label: str
    spec_provider: str
    status: ItemStatus
    sources: list[str]
    summary: Optional[str] = None
    reason: Optional[str] = None
    note: Optional[str] = None
    record_count: int


class CatalogueSection(BaseModel):
    key: str
    title: str
    status: ItemStatus
    items: list[CatalogueItem]


class RequiredInput(BaseModel):
    """An assessment input the specification expects from the project/consultant."""

    section: str
    label: str
    category: str
    parameter_name: str
    suggested_unit: Optional[str] = None
    source: str


class EnvironmentalDataResponse(BaseModel):
    request: RequestEcho
    retrieved_at: datetime
    duration_ms: int
    observations: list[Observation]
    gis_features: list[GisFeature]
    sections: list[CatalogueSection]
    required_inputs: list[RequiredInput]
    providers: list[ProviderOutcome]
    warnings: list[str]
