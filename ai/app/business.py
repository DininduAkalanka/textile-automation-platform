import json
import logging
import time
from typing import Any

import asyncpg

from app.config import Settings
from app.grounding import ungrounded_numbers
from app.llm import LlmClient, LlmError, parse_json_object
from app.models import BusinessRequest, BusinessResponse, ChartSpec
from app.tools import TOOL_SPECS, AnalyticsTools, call_tool

logger = logging.getLogger(__name__)

MAX_TOOL_CALLS = 3


def _tool_menu() -> str:
    lines = []
    for spec in TOOL_SPECS:
        schema = spec["args"].model_json_schema()
        props = schema.get("properties", {})
        arg_help = (
            ", ".join(
                f"{name}: {prop.get('enum') or prop.get('type')}"
                for name, prop in props.items()
            )
            or "no arguments"
        )
        lines.append(f"- {spec['name']}({arg_help}) — {spec['description']}")
    return "\n".join(lines)


PLAN_PROMPT = """You are the business analyst for a Sri Lankan textile shop. The \
owner asks questions in plain English; you answer with data from the shop's own \
records. All money is Sri Lankan Rupees (Rs).

You cannot query the database. You may ONLY call these tools:

{tools}

Decide which tools answer the owner's question. You may call at most {max_calls}.

RULES:
- Choose tools by name from the list. Never invent a tool.
- If the question cannot be answered by these tools (for example "why did sales \
drop?" — the data shows WHAT happened, never WHY), still call the tools that \
show what the data does say.
- Prefer get_profit_by_product over get_top_products when the owner asks about \
profit or margin: turnover and profit are not the same thing.

Reply with STRICT JSON and nothing else:
{{"calls": [{{"tool": "<name>", "args": {{...}}}}]}}"""


ANSWER_PROMPT = """You are the business analyst for a Sri Lankan textile shop. \
All money is Sri Lankan Rupees (Rs).

Below is the DATA returned by the tools you chose. Answer the owner's question \
using ONLY these numbers.

ABSOLUTE RULES:
1. Every number you state must appear in the DATA. NEVER estimate, extrapolate or \
invent a figure. If the data does not contain it, say so.
2. Do not explain WHY something happened unless the data shows it. The records \
show what sold and when — they do not show the weather, a competitor, or a \
holiday. Saying "sales fell because of the monsoon" is a guess dressed as a fact.
3. If the data is thin (very few orders), say so plainly rather than drawing a \
confident conclusion from three sales.
4. Be brief and direct, like an accountant who respects the owner's time.

Reply with STRICT JSON and nothing else:
{{"insight": "<2-4 sentences>",
  "recommendation": "<one concrete action, or null>",
  "chartSpec": {{"type": "line|bar|donut", "title": "...", \
"categories": ["..."], "series": [<numbers>]}} or null}}

Include a chartSpec only when the data is genuinely a series worth plotting \
(a trend over time, a ranking). Otherwise null."""


class BusinessChatService:
    """
    The owner's analyst (plan Session 9.2, decision D9).

    The loop:
        plan   -> the model picks tools by NAME from a fixed whitelist
        call   -> we run OUR SQL, against PII-free views, under a read-only role
        answer -> the model writes prose over the numbers we returned
        CHECK  -> every number in that prose must exist in the tool output

    The model never sees SQL, never writes SQL, and never sees a customer's name.
    The last step is what makes the answer trustworthy: a business assistant that
    invents a revenue figure is worse than none, because the owner would act on it.
    """

    def __init__(
        self,
        pool: asyncpg.Pool,
        llm: LlmClient | None,
        settings: Settings,
    ) -> None:
        self._tools = AnalyticsTools(pool)
        self._llm = llm
        self._s = settings

    async def answer(self, request: BusinessRequest) -> BusinessResponse:
        started = time.perf_counter()
        question = request.message.strip()[: self._s.max_message_chars]

        if self._llm is None:
            return await self._without_model(question)

        # ── 1. Plan: which tools? ───────────────────────────────────────────
        try:
            calls = await self._plan(question)
        except LlmError as exc:
            logger.warning("business_plan_failed error=%s", exc)
            return await self._without_model(question)

        # ── 2. Execute OUR queries ──────────────────────────────────────────
        #
        # THE call cap lives here and nowhere else — at the point where a query
        # would actually run. Capping in the planner as well would be redundant,
        # and worse: a test could then pass because of the other cap, so deleting
        # one would go unnoticed. One guard, one test, one thing to break.
        data: dict[str, Any] = {}
        for call in calls[:MAX_TOOL_CALLS]:
            name = call.get("tool")
            try:
                data[name] = await call_tool(self._tools, name, call.get("args", {}))
            except (ValueError, TypeError) as exc:
                # An invented tool name or an out-of-range argument. Skip it and
                # carry on with whatever else was legitimate.
                logger.warning("rejected_tool_call tool=%s error=%s", name, exc)

        if not data:
            return await self._without_model(question)

        # ── 3. Answer over the numbers ──────────────────────────────────────
        try:
            insight, recommendation, chart = await self._compose(question, data)
        except LlmError as exc:
            logger.warning("business_answer_failed error=%s", exc)
            return await self._without_model(question, data)

        # ── 4. Grounding check ──────────────────────────────────────────────
        prose = f"{insight} {recommendation or ''}"
        fabricated = ungrounded_numbers(prose, data)

        if fabricated:
            # The model stated a number that is in no tool's output. Do not show
            # it. The owner gets the real data and an honest note instead of a
            # confident lie.
            logger.error(
                "ungrounded_numbers_blocked numbers=%s question=%s",
                fabricated,
                question[:120],
            )
            return BusinessResponse(
                insight=(
                    "I could not verify every figure in my answer against the "
                    "shop's records, so I am showing you the raw data instead of "
                    "a summary I cannot stand behind."
                ),
                data=data,
                recommendation=None,
                chartSpec=None,
                grounded=False,
                toolsUsed=list(data.keys()),
            )

        logger.info(
            "business_chat tools=%s ms=%s",
            list(data.keys()),
            round((time.perf_counter() - started) * 1000),
        )

        return BusinessResponse(
            insight=insight,
            data=data,
            recommendation=recommendation,
            chartSpec=chart,
            grounded=True,
            toolsUsed=list(data.keys()),
        )

    # ─── steps ──────────────────────────────────────────────────────────────

    async def _plan(self, question: str) -> list[dict[str, Any]]:
        assert self._llm is not None

        raw = await self._llm.complete(
            PLAN_PROMPT.format(tools=_tool_menu(), max_calls=MAX_TOOL_CALLS),
            f"OWNER'S QUESTION:\n{question}",
        )
        parsed = parse_json_object(raw)
        calls = parsed.get("calls", [])

        if not isinstance(calls, list):
            raise LlmError("plan was not a list of calls")

        # Deliberately NOT capped here — the model may ask for thirty. The cap is
        # applied in answer(), where a query would actually run. See the note there.
        return [c for c in calls if isinstance(c, dict)]

    async def _compose(
        self, question: str, data: dict[str, Any]
    ) -> tuple[str, str | None, ChartSpec | None]:
        assert self._llm is not None

        raw = await self._llm.complete(
            ANSWER_PROMPT,
            f"OWNER'S QUESTION:\n{question}\n\nDATA:\n{json.dumps(data, default=str)}",
        )
        parsed = parse_json_object(raw)

        insight = str(parsed.get("insight", "")).strip()
        if not insight:
            raise LlmError("empty insight")

        recommendation = parsed.get("recommendation")
        recommendation = (
            str(recommendation).strip()
            if recommendation and str(recommendation).lower() != "null"
            else None
        )

        chart = None
        spec = parsed.get("chartSpec")
        if isinstance(spec, dict) and spec.get("type") in {"line", "bar", "donut"}:
            try:
                chart = ChartSpec(**spec)
            except Exception:  # noqa: BLE001 — a bad chart must not lose the answer
                logger.warning("discarded_malformed_chartspec")

        return insight, recommendation, chart

    async def _without_model(
        self, question: str, data: dict[str, Any] | None = None
    ) -> BusinessResponse:
        """
        No key, or the model failed.

        Still genuinely useful: run the three tools that answer most questions an
        owner actually asks, and hand over the numbers. No prose, no invention —
        just the data, honestly labelled as unsummarised.
        """
        if data is None:
            data = {}
            for name in ("get_sales_summary", "get_top_products", "get_low_stock"):
                try:
                    data[name] = await call_tool(self._tools, name, {})
                except Exception as exc:  # noqa: BLE001
                    logger.warning("fallback_tool_failed tool=%s error=%s", name, exc)

        summary = data.get("get_sales_summary", {})
        low = data.get("get_low_stock", {})

        parts = []
        if summary:
            parts.append(
                f"Revenue over the last {summary.get('period', '30d')}: "
                f"Rs {summary.get('revenue', 0):,.2f} from "
                f"{summary.get('paid_orders', 0)} paid orders."
            )
        if low.get("count"):
            parts.append(f"{low['count']} product(s) are at or below minimum stock.")

        return BusinessResponse(
            insight=" ".join(parts) or "No sales data available for this period.",
            data=data,
            recommendation=None,
            chartSpec=None,
            grounded=True,  # every number here came straight from a tool
            toolsUsed=list(data.keys()),
        )
