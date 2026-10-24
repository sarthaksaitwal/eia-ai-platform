"""
WASTE rules. Three outputs, no constants.

    Total waste        = sum of quantities across streams
    Recovery (%)       = (reused + recycled) / total waste x 100
    Disposal share (%) = sent to disposal / total waste    x 100

The streams are summed but stay separate as questions, because the legal
obligation follows the category rather than the tonnage. Nothing here
decides compliance: "Do not infer compliance from quantity alone."
"""

from app.calculations.registry import Ctx, MissingInput, Outcome, rule

STREAMS = [
    "waste_hazardous",
    "waste_non_hazardous",
    "waste_municipal",
    "waste_construction_demolition",
    "waste_plastic",
    "waste_ewaste",
    "waste_biomedical",
]

RECOVERED = ["waste_reused", "waste_recycled"]


@rule("waste_total", module="WASTE")
def waste_total(ctx: Ctx) -> Outcome:
    return ctx.sum_of(STREAMS, unit="t/year")


@rule("waste_recovery_rate", module="WASTE", depends_on=("waste_total",))
def waste_recovery_rate(ctx: Ctx) -> Outcome:
    recovered = 0.0
    entered = False
    for code in RECOVERED:
        if ctx.present(code):
            recovered += ctx.number(code, as_unit="t/year")
            entered = True
    if not entered:
        raise MissingInput(*RECOVERED)

    return ctx.ratio(
        recovered,
        ctx.result("waste_total"),
        unit="%",
        scale=100,
        denominator_code="waste_total",
    )


@rule("waste_disposal_share", module="WASTE", depends_on=("waste_total",))
def waste_disposal_share(ctx: Ctx) -> Outcome:
    return ctx.ratio(
        ctx.number("waste_disposed", as_unit="t/year"),
        ctx.result("waste_total"),
        unit="%",
        scale=100,
        denominator_code="waste_total",
    )
