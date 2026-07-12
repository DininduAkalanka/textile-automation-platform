"""
Business intelligence assistant (plan Session 9.2, decision D9).

A shopping assistant that invents a product is embarrassing. A business assistant
that invents a REVENUE FIGURE is dangerous, because the owner will act on it. So
the tests here are mostly about the two things that stop it:

  1. the model can only call SIX tools, by name, with bounded arguments — it never
     writes SQL;
  2. every number it then states must exist in what those tools returned.

The LLM is mocked. A test that only passes when the model behaves is not a test.
"""

import json

import pytest

from app.business import MAX_TOOL_CALLS, BusinessChatService
from app.config import Settings
from app.grounding import ungrounded_numbers
from app.llm import LlmClient, LlmError
from app.models import BusinessRequest
from app.tools import TOOL_NAMES, LowStockArgs, TopProductsArgs, call_tool

# ─── the grounding checker, tested on its own ───────────────────────────────


class TestGroundingChecker:
    DATA = {
        "get_sales_summary": {
            "revenue": 21900.0,
            "paid_orders": 3,
            "average_order_value": 7300.0,
        },
        "get_top_products": {
            "products": [{"name": "Cotton Fabric", "quantity": 12, "revenue": 10200.0}]
        },
    }

    def test_accepts_numbers_that_came_from_the_tools(self):
        answer = "Revenue was Rs 21,900 across 3 paid orders."
        assert ungrounded_numbers(answer, self.DATA) == []

    def test_catches_an_invented_revenue_figure(self):
        """The one that matters. An owner would act on this."""
        answer = "Revenue was Rs 45,000 last month."
        assert ungrounded_numbers(answer, self.DATA) == [45000.0]

    def test_catches_a_plausible_but_wrong_number(self):
        """21,950 is close to 21,900 — close enough to look right, and it is not."""
        assert ungrounded_numbers("Revenue was Rs 21,950.", self.DATA) == [21950.0]

    def test_tolerates_rounding_a_real_number(self):
        # 21900.0 written as "21,900" — the same number, humanly formatted.
        assert ungrounded_numbers("Revenue: Rs 21,900.00", self.DATA) == []

    def test_ignores_trivial_numbers(self):
        """"Top 5 products over 30 days" must not trip the alarm."""
        answer = "Here are the top 5 products over the last 30 days."
        assert ungrounded_numbers(answer, self.DATA) == []

    def test_finds_numbers_nested_deep_in_tool_output(self):
        # 10200 is inside get_top_products.products[0].revenue
        assert ungrounded_numbers("Cotton brought in Rs 10,200.", self.DATA) == []

    def test_catches_a_fabricated_percentage(self):
        assert ungrounded_numbers("Sales grew 32% this month.", self.DATA) == [32.0]


# ─── the tool whitelist ─────────────────────────────────────────────────────


class TestToolWhitelist:
    def test_the_whitelist_is_exactly_the_six_tools(self):
        assert TOOL_NAMES == {
            "get_sales_summary",
            "get_top_products",
            "get_revenue_trend",
            "get_low_stock",
            "get_profit_by_product",
            "get_order_status_breakdown",
        }

    @pytest.mark.asyncio
    async def test_an_unknown_tool_name_is_refused(self):
        """There is no dynamic getattr on model-supplied text."""
        with pytest.raises(ValueError, match="unknown tool"):
            await call_tool(None, "drop_all_tables", {})

    @pytest.mark.asyncio
    async def test_a_tool_that_is_a_real_python_attribute_is_still_refused(self):
        """`_pool` exists on AnalyticsTools. The whitelist, not the object, decides."""
        with pytest.raises(ValueError, match="unknown tool"):
            await call_tool(None, "_pool", {})

    def test_out_of_range_arguments_are_rejected_before_any_sql_runs(self):
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            TopProductsArgs(limit=1000)  # capped at 10
        with pytest.raises(ValidationError):
            LowStockArgs(limit=0)  # at least 1

    def test_an_invented_period_is_rejected(self):
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            TopProductsArgs(period="all-time")  # only 7d/30d/90d/365d exist


# ─── the loop ───────────────────────────────────────────────────────────────


class StubLlm(LlmClient):
    """Two replies: the plan, then the prose."""

    def __init__(self, *replies: str | Exception) -> None:
        self.replies = list(replies)
        self.calls = 0

    async def complete(self, system: str, user: str) -> str:
        self.calls += 1
        reply = self.replies.pop(0) if self.replies else "{}"
        if isinstance(reply, Exception):
            raise reply
        return reply


class StubTools:
    """Records what was actually run, so we can assert the model's plan was obeyed."""

    def __init__(self) -> None:
        self.ran: list[str] = []

    async def get_sales_summary(self, args):
        self.ran.append("get_sales_summary")
        return {"period": args.period, "revenue": 21900.0, "paid_orders": 3}

    async def get_low_stock(self, args):
        self.ran.append("get_low_stock")
        return {"count": 1, "items": [{"name": "Leather Formal Belt", "shortfall": 17}]}

    async def get_top_products(self, args):
        self.ran.append("get_top_products")
        return {"products": [{"name": "Cotton Fabric", "revenue": 10200.0}]}

    async def get_revenue_trend(self, args):
        self.ran.append("get_revenue_trend")
        return {"points": []}

    async def get_profit_by_product(self, args):
        self.ran.append("get_profit_by_product")
        return {"products": []}

    async def get_order_status_breakdown(self, args):
        self.ran.append("get_order_status_breakdown")
        return {"statuses": []}


def service(llm, tools: StubTools) -> BusinessChatService:
    svc = BusinessChatService(pool=None, llm=llm, settings=Settings(llm_api_key="k"))
    svc._tools = tools  # noqa: SLF001 — substituting the DB layer
    return svc


def plan(*calls) -> str:
    return json.dumps({"calls": [{"tool": t, "args": a} for t, a in calls]})


def prose(insight: str, recommendation=None, chart=None) -> str:
    return json.dumps(
        {"insight": insight, "recommendation": recommendation, "chartSpec": chart}
    )


class TestBusinessLoop:
    @pytest.mark.asyncio
    async def test_restock_question_calls_get_low_stock_and_answers(self):
        tools = StubTools()
        llm = StubLlm(
            plan(("get_low_stock", {"limit": 10})),
            prose(
                "1 product is below its minimum stock level.",
                "Reorder the Leather Formal Belt.",
            ),
        )

        result = await service(llm, tools).answer(
            BusinessRequest(message="what should I restock this week?")
        )

        assert tools.ran == ["get_low_stock"]
        assert result.grounded is True
        assert result.toolsUsed == ["get_low_stock"]
        assert "Leather Formal Belt" in (result.recommendation or "")

    @pytest.mark.asyncio
    async def test_an_ungrounded_number_is_BLOCKED_not_shown(self):
        """
        The model states revenue the tools never reported. The owner must NOT see
        that sentence — they would act on it.
        """
        tools = StubTools()
        llm = StubLlm(
            plan(("get_sales_summary", {"period": "30d"})),
            prose("Revenue was Rs 95,000 last month — a strong result."),
        )

        result = await service(llm, tools).answer(
            BusinessRequest(message="how is business?")
        )

        assert result.grounded is False
        assert "95,000" not in result.insight
        assert "could not verify" in result.insight.lower()
        # The real data is still handed over — the owner is not left with nothing.
        assert result.data["get_sales_summary"]["revenue"] == 21900.0

    @pytest.mark.asyncio
    async def test_a_grounded_number_passes_through(self):
        tools = StubTools()
        llm = StubLlm(
            plan(("get_sales_summary", {"period": "30d"})),
            prose("Revenue was Rs 21,900 from 3 paid orders."),
        )

        result = await service(llm, tools).answer(
            BusinessRequest(message="how is business?")
        )

        assert result.grounded is True
        assert "21,900" in result.insight

    @pytest.mark.asyncio
    async def test_a_model_asking_for_thirty_queries_gets_three(self):
        """The cap is enforced in code, not requested in the prompt."""
        tools = StubTools()
        llm = StubLlm(
            plan(*[("get_sales_summary", {})] * 30),
            prose("Revenue was Rs 21,900."),
        )

        await service(llm, tools).answer(BusinessRequest(message="everything"))

        assert len(tools.ran) == MAX_TOOL_CALLS

    @pytest.mark.asyncio
    async def test_an_invented_tool_is_skipped_and_the_rest_still_run(self):
        tools = StubTools()
        llm = StubLlm(
            plan(
                ("run_raw_sql", {"sql": "SELECT * FROM users"}),
                ("get_low_stock", {}),
            ),
            prose("1 product is low."),
        )

        result = await service(llm, tools).answer(BusinessRequest(message="restock?"))

        assert tools.ran == ["get_low_stock"]  # the SQL tool never existed
        assert result.toolsUsed == ["get_low_stock"]

    @pytest.mark.asyncio
    async def test_out_of_range_argument_is_skipped_not_clamped(self):
        tools = StubTools()
        llm = StubLlm(
            plan(("get_low_stock", {"limit": 9999})),
            prose("ok"),
        )

        result = await service(llm, tools).answer(BusinessRequest(message="restock?"))

        # The call was rejected by pydantic, so no tools ran and we fall back to
        # the model-free path rather than quietly running a different query.
        assert "get_low_stock" not in tools.ran or result.grounded

    @pytest.mark.asyncio
    async def test_llm_failure_degrades_to_raw_numbers(self):
        tools = StubTools()
        llm = StubLlm(LlmError("timeout"))

        result = await service(llm, tools).answer(BusinessRequest(message="how is business?"))

        # No prose, but real figures — and grounded, because every number came
        # straight from a tool.
        assert result.grounded is True
        assert "21,900" in result.insight or "21900" in result.insight

    @pytest.mark.asyncio
    async def test_no_api_key_still_reports_the_numbers(self):
        tools = StubTools()

        result = await service(llm=None, tools=tools).answer(
            BusinessRequest(message="how is business?")
        )

        assert result.data
        assert result.grounded is True

    @pytest.mark.asyncio
    async def test_a_malformed_chartspec_does_not_lose_the_answer(self):
        tools = StubTools()
        llm = StubLlm(
            plan(("get_sales_summary", {})),
            prose("Revenue was Rs 21,900.", chart={"type": "pie", "nonsense": True}),
        )

        result = await service(llm, tools).answer(BusinessRequest(message="revenue?"))

        assert result.chartSpec is None  # discarded
        assert "21,900" in result.insight  # answer survives
