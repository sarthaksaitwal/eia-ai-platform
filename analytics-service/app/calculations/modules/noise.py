"""
NOISE rules.

    Exceedance (dB) = measured ambient Leq - applicable limit

The applicable limit depends on the site's notified area category and on
the period, so the zone comes from the assessment context rather than from
a question: it is already recorded as project_locations.area_classification.

A site classified 'Rural/Other' has no limit here on purpose. The Noise
Pollution (Regulation and Control) Rules, 2000 schedule lists four
categories and that is not one of them, so the lookup finds nothing and the
result says so instead of borrowing the residential figure.

There is no attenuation or source-combination rule in this module. The
specification forbids it: "do not predict sound level from distance alone
without a validated model".
"""

from app.calculations.registry import Ctx, MissingInput, Outcome, rule


def _exceedance(ctx: Ctx, parameter: str, period: str) -> Outcome:
    zone = ctx.context("area_classification")
    if not zone:
        raise MissingInput(
            reason="the site's area classification is not set, and the "
                   "applicable noise limit depends on it"
        )

    measured = ctx.number(parameter)
    limit = ctx.limit(parameter, {"zone": zone, "period": period})
    return ctx.against_limit(measured, limit, unit="dB")


@rule("noise_exceedance_day", module="NOISE")
def noise_exceedance_day(ctx: Ctx) -> Outcome:
    return _exceedance(ctx, "leq_day", "day")


@rule("noise_exceedance_night", module="NOISE")
def noise_exceedance_night(ctx: Ctx) -> Outcome:
    return _exceedance(ctx, "leq_night", "night")
