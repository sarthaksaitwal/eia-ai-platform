"""
The calculation engine.

Stateless, like the rest of this service. The Node backend reads the module
definitions, the seeded constants and limits, and the values the user
entered, and sends them all here. This returns one result per output and
persists nothing.

What it guarantees, in the order it matters:

  * A result is CALCULATED only when every value it needed was present in
    the unit the formula expects. Otherwise it carries a status saying which
    of those two things failed, and no number.

  * No absent input is read as zero, anywhere.

  * Every result carries the inputs and the cited constants that produced
    it, so the row explains itself without the engine being re-run.

  * A result built on any unverified constant or limit is marked
    provisional. It is shown, and it is labelled.
"""

import time
from typing import Any, Optional

from app.calculations import modules as _modules  # noqa: F401  (registers rules)
from app.calculations.registry import (
    Constant,
    Ctx,
    Limit,
    MissingInput,
    NoFactor,
    NotApplicable,
    Outcome,
    Value,
    registered,
)
from app.calculations.units import UnitMismatch

ENGINE_VERSION = "1.0.0"


class _Unordered(Exception):
    """Output dependencies form a cycle, so no run order exists."""


def _order(outputs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Sorts outputs so that anything read through ctx.result() is computed
    first.

    Dependencies are declared on the rule, not in the database, because they
    are a property of the code that does the arithmetic. An output whose
    dependency is not part of this run is left in place: the rule will ask
    for it, not find it, and report NOT_CALCULATED.
    """
    by_code = {o["code"]: o for o in outputs}
    ordered: list[dict[str, Any]] = []
    done: set[str] = set()
    visiting: set[str] = set()

    def visit(code: str) -> None:
        if code in done or code not in by_code:
            return
        if code in visiting:
            raise _Unordered(f"output {code!r} depends on itself")
        visiting.add(code)

        rule = registered(code)
        for dependency in (rule.depends_on if rule else ()):
            visit(dependency)

        visiting.discard(code)
        done.add(code)
        ordered.append(by_code[code])

    # Stable: outputs are visited in the order the backend sent them, which
    # is module display_order then output display_order.
    for output in outputs:
        visit(output["code"])
    return ordered


def _values(rows: list[dict[str, Any]]) -> dict[str, Value]:
    values: dict[str, Value] = {}
    for row in rows:
        code = row.get("parameter_code")
        if not code:
            continue
        values[code] = Value(
            parameter_code=code,
            label=row.get("label"),
            value_numeric=row.get("value_numeric"),
            value_text=row.get("value_text"),
            unit=row.get("unit"),
            source_status=row.get("source_status") or "USER_REPORTED",
            reporting_period=row.get("reporting_period"),
        )
    return values


def _constants(rows: list[dict[str, Any]]) -> list[Constant]:
    return [
        Constant(
            code=row["code"],
            label=row.get("label", row["code"]),
            value=float(row["value"]),
            unit=row.get("unit", ""),
            applies_to=row["applies_to"],
            expects_unit=row.get("expects_unit", ""),
            result_unit=row.get("result_unit", ""),
            tags=row.get("tags") or {},
            source=row.get("source", ""),
            version=row.get("version"),
            verified=bool(row.get("verified")),
        )
        for row in rows
    ]


def _limits(rows: list[dict[str, Any]]) -> list[Limit]:
    return [
        Limit(
            code=row["code"],
            label=row.get("label", row["code"]),
            subject=row["subject"],
            selector=row.get("selector") or {},
            comparison=row.get("comparison", "max"),
            value=float(row["value"]),
            value_max=(
                float(row["value_max"]) if row.get("value_max") is not None else None
            ),
            unit=row.get("unit", ""),
            is_index=bool(row.get("is_index")),
            source=row.get("source", ""),
            version=row.get("version"),
            verified=bool(row.get("verified")),
        )
        for row in rows
    ]


def _failure(status: str, *, missing: Optional[list[str]] = None,
             note: Optional[str] = None) -> dict[str, Any]:
    return {
        "status": status,
        "value_numeric": None,
        "value_text": None,
        "missing_inputs": missing or None,
        "comparison": "not_compared",
        "limit_code": None,
        "limit_value": None,
        "limit_unit": None,
        "detail": note,
    }


def _run_one(output: dict[str, Any], ctx: Ctx) -> dict[str, Any]:
    """Executes one rule and maps whatever it raised onto a status."""
    code = output["code"]
    rule = registered(code)

    if rule is None:
        # The database declares an output no code implements. Saying so is
        # better than omitting the row, which would look like the output
        # does not exist.
        return _failure(
            "NOT_APPLICABLE",
            note=f"no rule is registered for output {code!r}",
        )

    try:
        outcome: Outcome = rule.fn(ctx)
    except MissingInput as exc:
        return _failure(
            "NOT_CALCULATED_MISSING_INPUT",
            missing=exc.codes or None,
            note=exc.reason,
        )
    except UnitMismatch as exc:
        return _failure("NOT_CALCULATED_UNIT_MISMATCH", note=str(exc))
    except NoFactor as exc:
        return _failure("NOT_CALCULATED_NO_FACTOR", note=str(exc))
    except NotApplicable as exc:
        return _failure("NOT_APPLICABLE", note=str(exc))
    except ZeroDivisionError:
        # ctx.ratio guards every division the rules perform, so reaching
        # here means a rule divided on its own. Reported rather than raised:
        # one broken output must not fail the whole run.
        return _failure(
            "NOT_CALCULATED_MISSING_INPUT",
            note="a division by zero was attempted outside ctx.ratio",
        )

    return {
        "status": "CALCULATED",
        "value_numeric": outcome.value_numeric,
        "value_text": outcome.value_text,
        "unit": outcome.unit or output.get("unit"),
        "missing_inputs": None,
        "comparison": outcome.comparison,
        "limit_code": outcome.limit_code,
        "limit_value": outcome.limit_value,
        "limit_unit": outcome.limit_unit,
        "detail": outcome.note,
        "_outcome": outcome,
    }


def calculate(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Runs every output of every enabled module over one assessment's values.

    `payload` carries the module definitions, the constants and limits, the
    entered values, and the assessment context. Nothing is read from a
    database here.
    """
    started = time.perf_counter()

    context = payload.get("context") or {}
    values = _values(payload.get("values") or [])

    constants: list[Constant] = []
    limits: list[Limit] = []
    outputs: list[dict[str, Any]] = []
    parameter_units: dict[str, Optional[str]] = {}
    skipped: list[dict[str, Any]] = []

    for module in payload.get("modules") or []:
        for parameter in module.get("parameters") or []:
            parameter_units[parameter["code"]] = parameter.get("unit")

        if not module.get("enabled", True):
            # A disabled module keeps its reference data out of the run as
            # well as its outputs, so nothing can be silently borrowed from
            # a module that is not live yet.
            skipped.append({
                "module_code": module["code"],
                "reason": "the module is not enabled",
            })
            continue

        constants.extend(_constants(module.get("constants") or []))
        limits.extend(_limits(module.get("limits") or []))
        for output in module.get("outputs") or []:
            outputs.append({**output, "module_code": module["code"]})

    results: list[dict[str, Any]] = []
    computed: dict[str, Outcome] = {}
    summary: dict[str, int] = {}
    # Output codes whose value rests on something a person has not checked.
    provisional_outputs: set[str] = set()

    try:
        ordered = _order(outputs)
    except _Unordered as exc:
        return {
            "engine_version": ENGINE_VERSION,
            "assessment_id": payload.get("assessment_id"),
            "error": str(exc),
            "results": [],
            "summary": {},
            "skipped_modules": skipped,
            "duration_ms": int((time.perf_counter() - started) * 1000),
        }

    for output in ordered:
        ctx = Ctx(
            values=values,
            constants=constants,
            limits=limits,
            parameter_units=parameter_units,
            context=context,
            results=computed,
        )

        produced = _run_one(output, ctx)
        outcome = produced.pop("_outcome", None)
        if outcome is not None:
            computed[output["code"]] = outcome

        # Provisional whenever anything behind the number is still unchecked
        # by a person, including by inheritance: a total is provisional if
        # any component it summed was. The result is reported either way; it
        # is labelled.
        provisional = any(
            not used.get("verified")
            for used in (ctx.constants_used + ctx.limits_used)
        ) or any(code in provisional_outputs for code in ctx.outputs_used)

        if provisional:
            provisional_outputs.add(output["code"])

        status = produced["status"]
        summary[status] = summary.get(status, 0) + 1

        results.append({
            "module_code": output["module_code"],
            "output_code": output["code"],
            "label": output.get("label"),
            "unit": produced.get("unit") or output.get("unit"),
            "formula_text": output.get("formula_text"),
            "limitation_note": output.get("limitation_note"),
            "inputs_used": ctx.inputs_used or None,
            "constants_used": ctx.constants_used or None,
            "limits_used": ctx.limits_used or None,
            # Which earlier outputs this one was built from, so a total is
            # traceable to its components without re-running the engine.
            "derived_from": ctx.outputs_used or None,
            "provisional": provisional,
            **produced,
        })

    return {
        "engine_version": ENGINE_VERSION,
        "assessment_id": payload.get("assessment_id"),
        "results": results,
        "summary": summary,
        "skipped_modules": skipped,
        "duration_ms": int((time.perf_counter() - started) * 1000),
    }
