"""
RESOURCE EFFICIENCY rules. Four ratios, no constants.

    Electricity intensity = (grid + renewable) kWh / annual output
    Water intensity       = annual m3 / annual output
    Material recovery (%) = recovered mass / total material input x 100
    Renewable share   (%) = renewable kWh / total electricity kWh x 100

Total electricity is grid plus on-site renewable. It is the numerator of
the intensity and the denominator of the renewable share, so both come from
the same two questions and cannot disagree with each other.
"""

from app.calculations.registry import Ctx, MissingInput, Outcome, rule

ELECTRICITY = ["grid_electricity", "renewable_electricity"]


def _total_electricity(ctx: Ctx) -> float:
    total = 0.0
    entered = False
    for code in ELECTRICITY:
        if ctx.present(code):
            total += ctx.number(code, as_unit="kWh/year")
            entered = True
    if not entered:
        raise MissingInput(*ELECTRICITY)
    return total


@rule("electricity_intensity", module="RESOURCE")
def electricity_intensity(ctx: Ctx) -> Outcome:
    return ctx.ratio(
        _total_electricity(ctx),
        ctx.number("annual_production"),
        unit="kWh/t",
        denominator_code="annual_production",
    )


@rule("water_intensity", module="RESOURCE")
def water_intensity(ctx: Ctx) -> Outcome:
    return ctx.ratio(
        ctx.number("annual_water_use"),
        ctx.number("annual_production"),
        unit="m3/t",
        denominator_code="annual_production",
    )


@rule("material_recovery_rate", module="RESOURCE")
def material_recovery_rate(ctx: Ctx) -> Outcome:
    return ctx.ratio(
        ctx.number("material_recovered"),
        ctx.number("material_input"),
        unit="%",
        scale=100,
        denominator_code="material_input",
    )


@rule("renewable_share", module="RESOURCE")
def renewable_share(ctx: Ctx) -> Outcome:
    # The renewable figure must be present for this to mean anything. Reading
    # it first means a project that entered only grid electricity gets
    # NOT_CALCULATED naming renewable_electricity, rather than a confident 0%
    # that looks like a measurement.
    renewable = ctx.number("renewable_electricity", as_unit="kWh/year")
    return ctx.ratio(
        renewable,
        _total_electricity(ctx),
        unit="%",
        scale=100,
        denominator_code="grid_electricity",
    )
