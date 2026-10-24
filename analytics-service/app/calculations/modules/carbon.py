"""
CARBON rules.

    Grid CO2 (t) = electricity (MWh) x CEA grid factor, MWh = kWh / 1,000
    Fuel CO2 (t) = sum over fuels of (quantity x matching IPCC factor)
    Total        = grid + fossil fuel
    Intensity    = total / annual output

Biogenic CO2 is summed into its own output and kept out of the total. The
2006 IPCC Guidelines record CO2 from biomass combustion as an information
item rather than part of the inventory total, so adding wood and agro
residue to the fossil figure would overstate it.

Every factor here quantifies CO2 only, so every result is labelled tCO2 and
never tCO2e.
"""

from app.calculations.registry import (
    Constant,
    Ctx,
    MissingInput,
    Outcome,
    rule,
)


def _fuel_total(ctx: Ctx, pool: str) -> Outcome:
    """
    Multiplies each fuel that was entered by its own factor and adds the
    results.

    A fuel left blank contributes nothing and is not an error; if no fuel in
    the pool was entered at all, the result is NOT_CALCULATED and names them,
    rather than reporting zero emissions.
    """
    fuels: list[Constant] = [
        c
        for c in ctx.constants_tagged("source_category", "fuel_combustion")
        if c.tags.get("carbon_pool") == pool
    ]
    if not fuels:
        raise MissingInput(
            reason=f"no {pool} fuel emission factors are seeded"
        )

    total = 0.0
    result_unit: str | None = None
    entered = False

    for factor in fuels:
        if not ctx.present(factor.applies_to):
            continue
        # constant_for records the factor as used, which is what puts its
        # citation and version on the stored result.
        quantity = ctx.number(factor.applies_to, as_unit=factor.expects_unit)
        applied = ctx.constant_for(factor.applies_to)
        total += quantity * float(applied.value)
        result_unit = applied.result_unit
        entered = True

    if not entered:
        raise MissingInput(*[f.applies_to for f in fuels])

    return ctx.calculated(total, result_unit)


@rule("carbon_grid_electricity", module="CARBON")
def carbon_grid_electricity(ctx: Ctx) -> Outcome:
    factor = ctx.constant_for("grid_electricity")
    # The question is asked in kWh because that is what a bill shows; the
    # factor is per MWh. units.convert handles exactly this conversion and
    # refuses anything it has not been told about.
    electricity = ctx.number("grid_electricity", as_unit=factor.expects_unit)
    return ctx.calculated(electricity * float(factor.value), factor.result_unit)


@rule("carbon_fuel_fossil", module="CARBON")
def carbon_fuel_fossil(ctx: Ctx) -> Outcome:
    return _fuel_total(ctx, "fossil")


@rule("carbon_fuel_biogenic", module="CARBON")
def carbon_fuel_biogenic(ctx: Ctx) -> Outcome:
    return _fuel_total(ctx, "biogenic")


@rule(
    "carbon_total",
    module="CARBON",
    depends_on=("carbon_grid_electricity", "carbon_fuel_fossil"),
)
def carbon_total(ctx: Ctx) -> Outcome:
    # Sums the sources that were quantified. A source that could not be
    # calculated is absent from the total and the limitation note on this
    # output says the total is partial -- it is not counted as zero.
    components = ["carbon_grid_electricity", "carbon_fuel_fossil"]
    present = [
        value
        for value in (ctx.result_if_present(code) for code in components)
        if value is not None
    ]
    if not present:
        raise MissingInput(
            reason="neither grid electricity nor fuel emissions could be "
                   "quantified, so there is no total to report"
        )
    return ctx.calculated(sum(present), "t CO2/year")


@rule("carbon_intensity", module="CARBON", depends_on=("carbon_total",))
def carbon_intensity(ctx: Ctx) -> Outcome:
    return ctx.ratio(
        ctx.result("carbon_total"),
        ctx.number("annual_production"),
        unit="t CO2/t",
        denominator_code="annual_production",
    )
