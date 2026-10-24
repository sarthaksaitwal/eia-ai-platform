"""
Unit handling for the calculation engine.

The rule is deliberately strict: a value is used only when its unit is the
one the formula expects, or when it can be converted by one of the two
conversions the specification states outright. Anything else stops the
calculation with NOT_CALCULATED_UNIT_MISMATCH.

That strictness is the point. The old coefficient table held twelve CO2
factors expecting tonnes of fuel while the only questions asked for
kilolitres of diesel and cubic metres of gas. Converting those needs a
density and a calorific value that nobody supplied, and a silent guess
would have produced a wrong number that looked right.
"""

from typing import Optional

# Kept in step with CONVERSIONS in backend/src/db/seedModules.js, which
# validates the seeded constants against this same table before writing.
#
# Both entries come straight from the specification:
#   "MWh = kWh / 1,000"
#   "convert kg to tonnes by dividing by 1,000"
ENGINE_CONVERSIONS: dict[tuple[str, str], float] = {
    ("kWh/year", "MWh/year"): 0.001,
    ("kg/year", "t/year"): 0.001,
}


class UnitMismatch(Exception):
    """A value cannot be expressed in the unit a formula requires."""


def normalise(unit: Optional[str]) -> str:
    """
    Units are compared as written, after trimming. No alias table: 'm3/day'
    and 'm^3/day' are different strings and are treated as different units,
    because the seeder writes exactly one spelling and a value whose unit
    does not match it has not been entered as asked.
    """
    return (unit or "").strip()


def same(a: Optional[str], b: Optional[str]) -> bool:
    return normalise(a) == normalise(b)


def convert(value: float, from_unit: Optional[str], to_unit: Optional[str]) -> float:
    """
    Returns `value` expressed in `to_unit`.

    Raises UnitMismatch when the units differ and no stated conversion
    connects them.
    """
    source = normalise(from_unit)
    target = normalise(to_unit)

    if source == target:
        return value

    factor = ENGINE_CONVERSIONS.get((source, target))
    if factor is None:
        raise UnitMismatch(
            f"cannot express {source or 'a unitless value'} as "
            f"{target or 'a unitless value'}: no conversion between them is "
            "defined, and the engine does not infer one"
        )
    return value * factor
