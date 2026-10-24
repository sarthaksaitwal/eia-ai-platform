from fastapi import APIRouter

from app.calculations import engine
from app.calculations.registry import all_registered
from app.schemas import CalculationRequest, CalculationResponse

router = APIRouter(tags=["calculations"])


@router.post("/calculations/run", response_model=CalculationResponse)
async def run_calculations(body: CalculationRequest):
    """
    Computes every output of every enabled module for one assessment.

    Stateless: the Node backend sends the seeded module definitions, their
    constants and limits, the values the user entered and the site context,
    then persists the response to calculation_runs and module_results.

    Each result carries its status, and a result is CALCULATED only when
    every value it needed was present in a unit the formula accepts. The
    other statuses say which of those two things failed and carry no number,
    so an absent input is never reported as zero.
    """
    return engine.calculate(body.model_dump())


@router.get("/calculations/rules")
async def list_rules():
    """
    Which outputs this build can actually compute.

    The database declares outputs and this service implements them, so the
    two can disagree: an output seeded without a rule is reported
    NOT_APPLICABLE at run time. This endpoint makes that visible before a
    run instead of after one.
    """
    rules = all_registered()
    return {
        "engine_version": engine.ENGINE_VERSION,
        "count": len(rules),
        "rules": sorted(
            (
                {
                    "output_code": code,
                    "module_code": rule.module,
                    "depends_on": list(rule.depends_on),
                }
                for code, rule in rules.items()
            ),
            key=lambda entry: (entry["module_code"], entry["output_code"]),
        ),
    }
