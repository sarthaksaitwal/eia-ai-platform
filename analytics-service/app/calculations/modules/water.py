"""
WATER rules. No constants: every one of these is arithmetic on values the
user supplied.

    Total demand   = sum of demand by use
    Supply gap     = max(0, total demand - confirmed supply)
    Wastewater (%) = wastewater generated / water supplied  x 100
    Reuse (%)      = reused water / total water demand      x 100
"""

from app.calculations.registry import Ctx, Outcome, rule

DEMAND_BY_USE = [
    "water_demand_domestic",
    "water_demand_process",
    "water_demand_cooling",
    "water_demand_other",
]


@rule("water_total_demand", module="WATER")
def water_total_demand(ctx: Ctx) -> Outcome:
    return ctx.sum_of(DEMAND_BY_USE, unit="m3/day")


@rule("water_supply_gap", module="WATER", depends_on=("water_total_demand",))
def water_supply_gap(ctx: Ctx) -> Outcome:
    demand = ctx.result("water_total_demand")
    supply = ctx.number("water_confirmed_supply")

    # max(0, ...) as specified. A surplus is not a negative gap, and
    # reporting one would invite it being read as a shortfall.
    return ctx.calculated(max(0.0, demand - supply), "m3/day")


@rule("wastewater_ratio", module="WATER")
def wastewater_ratio(ctx: Ctx) -> Outcome:
    return ctx.ratio(
        ctx.number("wastewater_generated"),
        ctx.number("water_supplied"),
        unit="%",
        scale=100,
        denominator_code="water_supplied",
    )


@rule("water_reuse_ratio", module="WATER", depends_on=("water_total_demand",))
def water_reuse_ratio(ctx: Ctx) -> Outcome:
    return ctx.ratio(
        ctx.number("water_reused"),
        ctx.result("water_total_demand"),
        unit="%",
        scale=100,
        denominator_code="water_total_demand",
    )
