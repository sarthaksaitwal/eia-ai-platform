from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

ProviderStatus = Literal["available", "unavailable", "error", "skipped"]
ItemStatus = Literal["available", "unavailable", "error", "skipped", "project_input"]


class SiteLocation(BaseModel):
    """projects -> project_locations row for the assessed site."""

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    # Declared by the project, not derived from the coordinate: ambient noise
    # limits depend on the area class, and NAAQS SO2/NO2 limits are stricter in
    # a notified ecologically sensitive area.
    area_classification: Optional[str] = None
    ecologically_sensitive: Optional[bool] = None


class ProjectContext(BaseModel):
    """Project fields relevant to the environmental baseline."""

    id: Optional[str] = None
    name: Optional[str] = None
    industry: Optional[str] = None
    project_type: Optional[str] = None
    capacity: Optional[float] = Field(default=None, ge=0)
    capacity_unit: Optional[str] = None
    land_area: Optional[float] = Field(default=None, ge=0)
    land_area_unit: Optional[str] = None
    employees: Optional[int] = Field(default=None, ge=0)
    operating_hours_per_day: Optional[float] = Field(default=None, ge=0, le=24)


class AssessmentInput(BaseModel):
    """One assessment_inputs row entered by the project developer or consultant."""

    category: str
    parameter_name: str = Field(min_length=1)
    value_numeric: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    source: Optional[str] = None


class EnvironmentalDataRequest(BaseModel):
    assessment_id: Optional[str] = Field(default=None, description="Echoed back for traceability only.")
    location: SiteLocation
    radius_km: Optional[float] = Field(
        default=None, gt=0, le=25,
        description="Radius for monitoring stations and wide-area GIS features. Defaults to DEFAULT_RADIUS_KM.",
    )
    project: Optional[ProjectContext] = None
    assessment_inputs: list[AssessmentInput] = Field(
        default_factory=list,
        description="Values already entered for the assessment; they satisfy the matching required inputs.",
    )


class RequestEcho(BaseModel):
    assessment_id: Optional[str] = None
    latitude: float
    longitude: float
    radius_km: float
    location: SiteLocation
    project: Optional[ProjectContext] = None
    assessment_input_count: int = 0


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
    provided: bool = False


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


# ===============================================================
# Calculation engine
# ===============================================================
#
# The Node backend owns persistence, so it sends the engine
# everything the run needs: the module definitions as seeded, the
# constants and limits, the values the user entered, and the site
# context. Nothing below is read from a database by this service.


CalculationStatus = Literal[
    "CALCULATED",
    "NOT_CALCULATED_MISSING_INPUT",
    "NOT_CALCULATED_UNIT_MISMATCH",
    "NOT_CALCULATED_NO_FACTOR",
    "NOT_APPLICABLE",
    "VERIFICATION_REQUIRED",
]

Comparison = Literal["within_limit", "outside_limit", "not_compared"]


class ParameterDefinition(BaseModel):
    """One module_parameters row. The unit is the part the engine needs:
    it is what an entered value must match, or be convertible to."""

    code: str = Field(min_length=1)
    label: Optional[str] = None
    unit: Optional[str] = None
    value_type: str = "numeric"
    required: bool = False


class ConstantDefinition(BaseModel):
    """One module_constants row."""

    code: str = Field(min_length=1)
    label: Optional[str] = None
    value: float
    unit: str = ""
    applies_to: str = Field(min_length=1)
    expects_unit: str = ""
    result_unit: str = ""
    tags: dict[str, Any] = Field(default_factory=dict)
    source: str = ""
    version: Optional[str] = None
    verified: bool = False


class LimitDefinition(BaseModel):
    """One module_limits row."""

    code: str = Field(min_length=1)
    label: Optional[str] = None
    subject: str = Field(min_length=1)
    selector: dict[str, Any] = Field(default_factory=dict)
    comparison: str = "max"
    value: float
    value_max: Optional[float] = None
    unit: str = ""
    is_index: bool = False
    source: str = ""
    version: Optional[str] = None
    verified: bool = False


class OutputDefinition(BaseModel):
    """One module_outputs row. `formula_text` is carried through onto the
    result for the report; it is never parsed."""

    code: str = Field(min_length=1)
    label: Optional[str] = None
    unit: Optional[str] = None
    formula_text: Optional[str] = None
    operation: Optional[str] = None
    comparable: bool = False
    limitation_note: Optional[str] = None


class ModuleDefinition(BaseModel):
    code: str = Field(min_length=1)
    name: Optional[str] = None
    # A disabled module contributes neither outputs nor reference data, so
    # nothing can be borrowed from a module that is not live yet.
    enabled: bool = True
    parameters: list[ParameterDefinition] = Field(default_factory=list)
    constants: list[ConstantDefinition] = Field(default_factory=list)
    limits: list[LimitDefinition] = Field(default_factory=list)
    outputs: list[OutputDefinition] = Field(default_factory=list)


class EnteredValue(BaseModel):
    """One assessment_parameter_values row."""

    parameter_code: str = Field(min_length=1)
    label: Optional[str] = None
    value_numeric: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    source_status: str = "USER_REPORTED"
    reporting_period: Optional[str] = None


class CalculationRequest(BaseModel):
    assessment_id: Optional[str] = Field(
        default=None, description="Echoed back for traceability only."
    )
    # Facts about the site rather than answers to questions. The noise zone
    # lives here because it is already recorded on project_locations, and
    # asking for it again would let the two answers disagree.
    context: dict[str, Any] = Field(default_factory=dict)
    modules: list[ModuleDefinition] = Field(default_factory=list)
    values: list[EnteredValue] = Field(default_factory=list)


class ModuleResult(BaseModel):
    module_code: str
    output_code: str
    label: Optional[str] = None
    status: CalculationStatus
    value_numeric: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    # Which parameter codes were absent, when the status says so.
    missing_inputs: Optional[list[str]] = None
    comparison: Comparison = "not_compared"
    limit_code: Optional[str] = None
    limit_value: Optional[float] = None
    limit_unit: Optional[str] = None
    inputs_used: Optional[list[dict[str, Any]]] = None
    constants_used: Optional[list[dict[str, Any]]] = None
    limits_used: Optional[list[dict[str, Any]]] = None
    derived_from: Optional[list[str]] = None
    formula_text: Optional[str] = None
    limitation_note: Optional[str] = None
    # True when any constant or limit behind the number is still unchecked
    # by a person, or when a component it was built from was provisional.
    provisional: bool = False
    # Why a calculation did not happen, in a sentence meant for the user.
    detail: Optional[str] = None


class SkippedModule(BaseModel):
    module_code: str
    reason: str


class CalculationResponse(BaseModel):
    engine_version: str
    assessment_id: Optional[str] = None
    results: list[ModuleResult]
    # Counts by status, for the run summary.
    summary: dict[str, int] = Field(default_factory=dict)
    skipped_modules: list[SkippedModule] = Field(default_factory=list)
    duration_ms: int = 0
    error: Optional[str] = None
