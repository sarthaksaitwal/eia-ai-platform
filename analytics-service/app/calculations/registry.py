"""
The rule registry.

Each output declared in module_outputs is computed by a Python function
registered here under the same code. The `formula_text` stored in the
database is documentation shown in the UI and cited in the report; it is
never parsed. Reviewed code executes, and a string from the database does
not become an expression.

A rule body reads as the arithmetic it is:

    @rule("wastewater_ratio", module="WATER")
    def wastewater_ratio(ctx):
        return ctx.ratio(
            ctx.number("wastewater_generated"),
            ctx.number("water_supplied"),
            unit="%",
            scale=100,
        )

Everything that can legitimately stop a calculation is an exception, so a
rule never has to check for absence before doing the sum. The engine turns
each one into the matching status:

    MissingInput  -> NOT_CALCULATED_MISSING_INPUT
    UnitMismatch  -> NOT_CALCULATED_UNIT_MISMATCH
    NoFactor      -> NOT_CALCULATED_NO_FACTOR
    NotApplicable -> NOT_APPLICABLE

No rule returns zero to mean "nothing was entered". The specification is
explicit: "Never replace unavailable data with zero."
"""

from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from app.calculations.units import UnitMismatch, convert, normalise, same


# --------------------------------------------------------------- exceptions


class MissingInput(Exception):
    """One or more required values were not entered, or were entered as zero
    where zero makes the formula undefined."""

    def __init__(self, *codes: str, reason: Optional[str] = None):
        self.codes = list(codes)
        self.reason = reason
        super().__init__(reason or f"missing: {', '.join(codes)}")


class NoFactor(Exception):
    """No published constant is available for an input that needs one."""


class NotApplicable(Exception):
    """The output does not apply to this assessment, for a recorded reason."""


# ------------------------------------------------------------------ results


@dataclass
class Outcome:
    """What a rule produced. The engine adds provenance before storing it."""

    value_numeric: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    # Set by a rule that reached a verdict itself, as the noise rules do:
    # the exceedance is the value, and the limit it was measured against is
    # part of the answer.
    limit_code: Optional[str] = None
    limit_value: Optional[float] = None
    limit_unit: Optional[str] = None
    comparison: str = "not_compared"
    note: Optional[str] = None


@dataclass
class Registered:
    code: str
    module: str
    fn: Callable[["Ctx"], Outcome]
    # Output codes this rule reads through ctx.result(). The engine orders
    # the run so they are computed first, and reports a cycle rather than
    # recursing.
    depends_on: tuple[str, ...] = ()


_RULES: dict[str, Registered] = {}


def rule(code: str, *, module: str, depends_on: tuple[str, ...] = ()):
    def register(fn: Callable[["Ctx"], Outcome]) -> Callable[["Ctx"], Outcome]:
        if code in _RULES:
            raise RuntimeError(f"two rules are registered for output {code!r}")
        _RULES[code] = Registered(code=code, module=module, fn=fn,
                                  depends_on=depends_on)
        return fn

    return register


def registered(code: str) -> Optional[Registered]:
    return _RULES.get(code)


def all_registered() -> dict[str, Registered]:
    return dict(_RULES)


# ----------------------------------------------------------------- the input


@dataclass
class Value:
    """One assessment_parameter_values row as the engine sees it."""

    parameter_code: str
    label: Optional[str] = None
    value_numeric: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    source_status: str = "USER_REPORTED"
    reporting_period: Optional[str] = None


@dataclass
class Constant:
    """One module_constants row."""

    code: str
    label: str
    value: float
    unit: str
    applies_to: str
    expects_unit: str
    result_unit: str
    tags: dict[str, Any] = field(default_factory=dict)
    source: str = ""
    version: Optional[str] = None
    verified: bool = False


@dataclass
class Limit:
    """One module_limits row."""

    code: str
    label: str
    subject: str
    selector: dict[str, Any]
    comparison: str
    value: float
    value_max: Optional[float] = None
    unit: str = ""
    is_index: bool = False
    source: str = ""
    version: Optional[str] = None
    verified: bool = False


# --------------------------------------------------------------- the context


class Ctx:
    """
    What a rule is given. It reads values, constants, limits and the results
    of earlier outputs, and records everything it touched so the stored
    result can explain itself.
    """

    def __init__(
        self,
        values: dict[str, Value],
        constants: list[Constant],
        limits: list[Limit],
        parameter_units: dict[str, Optional[str]],
        context: dict[str, Any],
        results: dict[str, Outcome],
    ):
        self._values = values
        self._constants = constants
        self._limits = limits
        self._parameter_units = parameter_units
        self._context = context
        self._results = results

        self.inputs_used: list[dict[str, Any]] = []
        self.constants_used: list[dict[str, Any]] = []
        self.limits_used: list[dict[str, Any]] = []
        # Output codes this rule read through result(). The engine uses these
        # to carry the provisional flag forward: a total built from a
        # provisional component is itself provisional, however clean its own
        # arithmetic is.
        self.outputs_used: list[str] = []

    # -- assessment context -------------------------------------------------

    def context(self, key: str) -> Optional[Any]:
        """A value describing the site rather than answering a question, such
        as the notified area classification from project_locations."""
        return self._context.get(key)

    # -- reading values -----------------------------------------------------

    def present(self, code: str) -> bool:
        value = self._values.get(code)
        return value is not None and value.value_numeric is not None

    def number(self, code: str, *, as_unit: Optional[str] = None) -> float:
        """
        The numeric answer to one question, in the unit the formula wants.

        Raises MissingInput when it was not answered, and UnitMismatch when
        it was answered in a unit this engine will not convert.
        """
        value = self._values.get(code)
        if value is None or value.value_numeric is None:
            raise MissingInput(code)

        target = as_unit if as_unit is not None else self._parameter_units.get(code)
        number = float(value.value_numeric)

        if target is not None and not same(value.unit, target):
            # convert() raises UnitMismatch when no stated conversion applies.
            number = convert(number, value.unit, target)

        self._record_input(value)
        return number

    def text(self, code: str) -> Optional[str]:
        value = self._values.get(code)
        if value is None:
            return None
        if value.value_text:
            self._record_input(value)
        return value.value_text

    def _record_input(self, value: Value) -> None:
        if any(used["code"] == value.parameter_code for used in self.inputs_used):
            return
        self.inputs_used.append({
            "code": value.parameter_code,
            "label": value.label,
            "value": value.value_numeric,
            "text": value.value_text,
            "unit": value.unit,
            "source_status": value.source_status,
            "reporting_period": value.reporting_period,
        })

    # -- reading constants --------------------------------------------------

    def constant_for(self, parameter_code: str) -> Constant:
        """The published constant that multiplies this parameter."""
        for constant in self._constants:
            if constant.applies_to == parameter_code:
                self._record_constant(constant)
                return constant
        raise NoFactor(
            f"no published factor is available for {parameter_code!r}"
        )

    def constants_tagged(self, key: str, value: Any) -> list[Constant]:
        """Every constant carrying a tag, e.g. carbon_pool = 'fossil'. Not
        recorded as used until one is actually applied."""
        return [c for c in self._constants if c.tags.get(key) == value]

    def _record_constant(self, constant: Constant) -> None:
        if any(used["code"] == constant.code for used in self.constants_used):
            return
        self.constants_used.append({
            "code": constant.code,
            "label": constant.label,
            "value": constant.value,
            "unit": constant.unit,
            "source": constant.source,
            "version": constant.version,
            "verified": constant.verified,
        })

    # -- reading limits -----------------------------------------------------

    def limit(self, subject: str, selector: dict[str, Any]) -> Limit:
        """
        The published limit for a subject under a selector, matched on
        equality of every key the selector names.
        """
        for limit in self._limits:
            if limit.subject != subject:
                continue
            if all(limit.selector.get(k) == v for k, v in selector.items()):
                self._record_limit(limit)
                return limit
        described = ", ".join(f"{k}={v!r}" for k, v in selector.items())
        raise MissingInput(
            reason=f"no published limit for {subject} with {described}"
        )

    def _record_limit(self, limit: Limit) -> None:
        if any(used["code"] == limit.code for used in self.limits_used):
            return
        self.limits_used.append({
            "code": limit.code,
            "label": limit.label,
            "value": limit.value,
            "unit": limit.unit,
            "source": limit.source,
            "version": limit.version,
            "verified": limit.verified,
        })

    # -- reading earlier outputs -------------------------------------------

    def result(self, output_code: str) -> float:
        """
        The numeric result of an output computed earlier in this run. Raises
        MissingInput when that output did not produce one, so a total never
        silently treats a failed component as zero.
        """
        outcome = self._results.get(output_code)
        if outcome is None or outcome.value_numeric is None:
            raise MissingInput(reason=f"{output_code} was not calculated")
        self._record_output(output_code)
        return outcome.value_numeric

    def result_if_present(self, output_code: str) -> Optional[float]:
        outcome = self._results.get(output_code)
        if outcome is None or outcome.value_numeric is None:
            return None
        self._record_output(output_code)
        return outcome.value_numeric

    def _record_output(self, output_code: str) -> None:
        if output_code not in self.outputs_used:
            self.outputs_used.append(output_code)

    # -- building outcomes --------------------------------------------------

    def calculated(self, value: float, unit: Optional[str], **extra) -> Outcome:
        return Outcome(value_numeric=value, unit=unit, **extra)

    def sum_of(self, codes: list[str], *, unit: str) -> Outcome:
        """
        Adds whichever of these questions were answered.

        A blank question is not zero: if none of them was answered the result
        is NOT_CALCULATED and names them all, rather than reporting a total
        of nought.
        """
        total = 0.0
        found = False
        for code in codes:
            if self.present(code):
                total += self.number(code, as_unit=unit)
                found = True
        if not found:
            raise MissingInput(*codes)
        return self.calculated(total, unit)

    def ratio(
        self,
        numerator: float,
        denominator: float,
        *,
        unit: str,
        scale: float = 1.0,
        denominator_code: Optional[str] = None,
    ) -> Outcome:
        """
        A ratio, with the zero denominator handled as the specification
        requires: "If denominator is zero/missing, return NOT_CALCULATED."
        Dividing by zero is not an error to swallow, it is an absent result.
        """
        if denominator == 0:
            raise MissingInput(
                *( [denominator_code] if denominator_code else [] ),
                reason="the denominator is zero, so the ratio is undefined",
            )
        return self.calculated(numerator / denominator * scale, unit)

    def against_limit(
        self,
        measured: float,
        limit: Limit,
        *,
        unit: str,
    ) -> Outcome:
        """
        An exceedance and its verdict in one step.

        Exceedance = measured - limit, positive meaning the measured level is
        above the published limit, which is the direction the Noise Rules
        schedule is read in.

        An index is never compared: CPCB publishes AQI sub-indices and MPCB a
        Water Quality Index, and neither is on the same scale as a limit.
        """
        if limit.is_index:
            raise NotApplicable(
                f"{limit.code} is an index, not a concentration or level, "
                "and cannot be compared with a measured value"
            )

        exceedance = measured - float(limit.value)
        verdict = "outside_limit" if exceedance > 0 else "within_limit"
        return Outcome(
            value_numeric=exceedance,
            unit=unit,
            limit_code=limit.code,
            limit_value=float(limit.value),
            limit_unit=limit.unit or None,
            comparison=verdict,
        )


__all__ = [
    "Constant",
    "Ctx",
    "Limit",
    "MissingInput",
    "NoFactor",
    "NotApplicable",
    "Outcome",
    "Registered",
    "UnitMismatch",
    "Value",
    "all_registered",
    "normalise",
    "registered",
    "rule",
]
