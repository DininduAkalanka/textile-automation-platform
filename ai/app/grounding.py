import re
from typing import Any

# Numbers as a human writes them: 21900, 21,900, 21900.50, 32%, 4.
_NUMBER = re.compile(r"-?\d[\d,]*(?:\.\d+)?")

# Numbers that mean nothing on their own and would produce false alarms: a "top 5"
# list, "last 30 days", the year. Checking these adds noise, not safety.
_IGNORE = {0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 7.0, 10.0, 30.0, 90.0, 100.0, 180.0, 365.0}

# Rounding slack. The model may write "Rs 21,900" for 21900.00, or a margin of
# 32% for 32.4. This is not a licence to be wrong — it is a licence to be readable.
_TOLERANCE = 0.51


def numbers_in(text: str) -> list[float]:
    values: list[float] = []
    for match in _NUMBER.finditer(text):
        try:
            values.append(float(match.group(0).replace(",", "")))
        except ValueError:
            continue
    return values


def numbers_from(data: Any) -> set[float]:
    """Every numeric value anywhere in the tool outputs, at any depth."""
    found: set[float] = set()

    def walk(node: Any) -> None:
        if isinstance(node, bool):
            return
        if isinstance(node, (int, float)):
            found.add(float(node))
        elif isinstance(node, dict):
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)
        elif isinstance(node, str):
            # Dates and ids can contain digits; only treat a string as numeric if
            # the whole thing is a number.
            try:
                found.add(float(node.replace(",", "")))
            except ValueError:
                pass

    walk(data)
    return found


def ungrounded_numbers(answer: str, tool_outputs: Any) -> list[float]:
    """
    Numbers the assistant stated that do NOT appear in any tool's output.

    This is the anti-fabrication check the plan demands (Session 9.2, task 4).

    A shopping assistant that invents a product is embarrassing. A business
    assistant that invents a REVENUE FIGURE is dangerous — an owner would act on
    it. So every number in the answer must be traceable to data the tools actually
    returned. A derived figure (a sum, a percentage) is allowed a little slack for
    rounding, and trivial numbers are ignored; anything else is fabrication and
    the caller must not show it.
    """
    grounded = numbers_from(tool_outputs)
    fabricated: list[float] = []

    for value in numbers_in(answer):
        if abs(value) in _IGNORE:
            continue
        if any(abs(value - known) <= _TOLERANCE for known in grounded):
            continue
        fabricated.append(value)

    return fabricated
