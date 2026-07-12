"""
The whitelisted analytics toolset (decision D9, plan Session 9.2).

WHY THIS FILE EXISTS AT ALL.

Doc 08 §5.1 draws the business assistant as "Data Retrieval (SQL Aggregation)"
driven by the LLM — i.e. text-to-SQL against the production database. That is a
security hole: a model that writes SQL can be talked into writing different SQL,
and a hallucinated query is indistinguishable from a correct one until it has run.

Decision D9 overrides it, and this is the override. The model NEVER emits SQL. It
picks a tool by NAME from the six below and supplies arguments that are enums or
bounded integers. Every query here is written by hand, parameterised, and runs
against PII-free views under a role that cannot write.

The attack surface is therefore: six function names and a handful of bounded
arguments. There is nothing to inject into.
"""

import logging
import time
from typing import Any, Literal

import asyncpg
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Bounded periods, not free-form dates. "Last 30 days" is a choice from a list,
# so a model cannot ask for a period that means nothing (or costs a table scan).
Period = Literal["7d", "30d", "90d", "365d"]

_PERIOD_DAYS: dict[str, int] = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}


# ─── Argument schemas: every bound is deliberate ────────────────────────────


class PeriodArgs(BaseModel):
    period: Period = "30d"


class TopProductsArgs(BaseModel):
    period: Period = "30d"
    # Capped at 10: a top-50 list is not an insight, and it bloats the prompt.
    limit: int = Field(default=5, ge=1, le=10)
    by: Literal["revenue", "quantity"] = "revenue"


class RevenueTrendArgs(BaseModel):
    # 180 days max: enough for a seasonal view, bounded so one question cannot
    # drag half a year of rows through the model's context.
    days: int = Field(default=30, ge=7, le=180)


class LowStockArgs(BaseModel):
    limit: int = Field(default=10, ge=1, le=50)


class NoArgs(BaseModel):
    pass


# ─── The tools ──────────────────────────────────────────────────────────────


class AnalyticsTools:
    """
    Six read-only aggregates. Each returns plain JSON-safe values.

    Money is returned as a float here rather than a Decimal string, unlike the
    NestJS analytics service, because these numbers are going into a prompt and a
    chart — not into an invoice. Nothing in this file can create a charge.
    """

    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def get_sales_summary(self, args: PeriodArgs) -> dict[str, Any]:
        """Revenue, paid orders and average order value for a period."""
        days = _PERIOD_DAYS[args.period]

        row = await self._fetchrow(
            """
            SELECT COALESCE(SUM(line_revenue), 0)::float8      AS revenue,
                   COUNT(DISTINCT order_id)::int              AS paid_orders,
                   COALESCE(SUM(quantity), 0)::int            AS units_sold
              FROM ai_sales_facts
             WHERE payment_status = 'COMPLETED'
               AND paid_at >= now() - ($1 || ' days')::interval
            """,
            str(days),
        )

        revenue = row["revenue"]
        orders = row["paid_orders"]

        return {
            "period": args.period,
            "revenue": round(revenue, 2),
            "paid_orders": orders,
            "units_sold": row["units_sold"],
            # Guarded: dividing by zero orders is exactly the kind of NaN that
            # ends up rendered to a user as "Rs NaN".
            "average_order_value": round(revenue / orders, 2) if orders else 0.0,
        }

    async def get_top_products(self, args: TopProductsArgs) -> dict[str, Any]:
        """Best sellers by revenue or by units, over a period."""
        days = _PERIOD_DAYS[args.period]
        # Not string interpolation of user input: `by` is a Literal, so it can
        # only ever be one of two known column names.
        order_by = "revenue" if args.by == "revenue" else "quantity"

        rows = await self._fetch(
            f"""
            SELECT product_name,
                   product_type,
                   SUM(quantity)::int            AS quantity,
                   SUM(line_revenue)::float8     AS revenue
              FROM ai_sales_facts
             WHERE payment_status = 'COMPLETED'
               AND paid_at >= now() - ($1 || ' days')::interval
             GROUP BY product_name, product_type
             ORDER BY {order_by} DESC
             LIMIT $2
            """,
            str(days),
            args.limit,
        )

        return {
            "period": args.period,
            "ranked_by": args.by,
            "products": [
                {
                    "name": r["product_name"],
                    "type": r["product_type"],
                    "quantity": r["quantity"],
                    "revenue": round(r["revenue"], 2),
                }
                for r in rows
            ],
        }

    async def get_revenue_trend(self, args: RevenueTrendArgs) -> dict[str, Any]:
        """
        Daily revenue, zero-filled.

        Zero-filled deliberately: a chart with the empty days missing compresses a
        dead week into nothing and makes a bad month look like a good one.
        """
        rows = await self._fetch(
            """
            WITH days AS (
                SELECT generate_series(
                    (now() - ($1 || ' days')::interval)::date, now()::date, interval '1 day'
                )::date AS day
            )
            SELECT to_char(d.day, 'YYYY-MM-DD')                     AS date,
                   COALESCE(SUM(f.line_revenue), 0)::float8         AS revenue,
                   COUNT(DISTINCT f.order_id)::int                  AS orders
              FROM days d
              LEFT JOIN ai_sales_facts f
                     ON f.payment_status = 'COMPLETED'
                    AND date(f.paid_at) = d.day
             GROUP BY d.day
             ORDER BY d.day
            """,
            str(args.days),
        )

        return {
            "days": args.days,
            "points": [
                {
                    "date": r["date"],
                    "revenue": round(r["revenue"], 2),
                    "orders": r["orders"],
                }
                for r in rows
            ],
        }

    async def get_low_stock(self, args: LowStockArgs) -> dict[str, Any]:
        """What to restock: at or below the minimum level."""
        rows = await self._fetch(
            """
            SELECT product_name, product_type, sellable,
                   quantity_available, minimum_stock_level
              FROM ai_inventory_facts
             WHERE is_low
             ORDER BY (quantity_available - minimum_stock_level) ASC
             LIMIT $1
            """,
            args.limit,
        )

        return {
            "count": len(rows),
            "items": [
                {
                    "name": r["product_name"],
                    "type": r["product_type"],
                    "available": r["quantity_available"],
                    "sellable": r["sellable"],
                    "minimum": r["minimum_stock_level"],
                    "shortfall": r["minimum_stock_level"] - r["quantity_available"],
                }
                for r in rows
            ],
        }

    async def get_profit_by_product(self, args: TopProductsArgs) -> dict[str, Any]:
        """
        Margin, not just turnover — the number that tells an owner what is worth
        selling.

        Products with no cost_price are EXCLUDED rather than treated as costing
        zero. Treating an unknown cost as zero reports 100% margin, which is the
        single most misleading number this system could produce.
        """
        days = _PERIOD_DAYS[args.period]

        rows = await self._fetch(
            """
            SELECT product_name,
                   SUM(line_revenue)::float8               AS revenue,
                   SUM(line_cost)::float8                  AS cost,
                   SUM(line_revenue - line_cost)::float8   AS profit
              FROM ai_sales_facts
             WHERE payment_status = 'COMPLETED'
               AND paid_at >= now() - ($1 || ' days')::interval
               AND cost_price IS NOT NULL
             GROUP BY product_name
             ORDER BY profit DESC
             LIMIT $2
            """,
            str(days),
            args.limit,
        )

        return {
            "period": args.period,
            "note": "Products with no recorded cost price are excluded.",
            "products": [
                {
                    "name": r["product_name"],
                    "revenue": round(r["revenue"], 2),
                    "cost": round(r["cost"], 2),
                    "profit": round(r["profit"], 2),
                    "margin_percent": (
                        round(r["profit"] / r["revenue"] * 100, 1)
                        if r["revenue"]
                        else 0.0
                    ),
                }
                for r in rows
            ],
        }

    async def get_order_status_breakdown(self, args: NoArgs) -> dict[str, Any]:
        """Where every order currently sits — how much work is in the pipeline."""
        rows = await self._fetch(
            """
            SELECT order_status, COUNT(DISTINCT order_id)::int AS count
              FROM ai_sales_facts
             GROUP BY order_status
             ORDER BY count DESC
            """
        )

        return {
            "statuses": [
                {"status": r["order_status"], "count": r["count"]} for r in rows
            ]
        }

    # ─── plumbing ───────────────────────────────────────────────────────────

    async def _fetch(self, sql: str, *params) -> list[asyncpg.Record]:
        async with self._pool.acquire() as conn:
            return await conn.fetch(sql, *params)

    async def _fetchrow(self, sql: str, *params) -> asyncpg.Record:
        async with self._pool.acquire() as conn:
            return await conn.fetchrow(sql, *params)


# ─── The registry the model is allowed to pick from ─────────────────────────
#
# This dict IS the whitelist. A tool name that is not a key here cannot be
# called, however convincingly the model asks.

TOOL_SPECS: list[dict[str, Any]] = [
    {
        "name": "get_sales_summary",
        "description": "Total revenue, number of paid orders and average order value over a period.",
        "args": PeriodArgs,
    },
    {
        "name": "get_top_products",
        "description": "Best-selling products by revenue or by units sold.",
        "args": TopProductsArgs,
    },
    {
        "name": "get_revenue_trend",
        "description": "Daily revenue over the last N days. Use this when asked about trends or for a chart over time.",
        "args": RevenueTrendArgs,
    },
    {
        "name": "get_low_stock",
        "description": "Products at or below their minimum stock level. Use this when asked what to restock or reorder.",
        "args": LowStockArgs,
    },
    {
        "name": "get_profit_by_product",
        "description": "Most profitable products by margin, using cost price. Use this when asked about profit or margin, not just sales.",
        "args": TopProductsArgs,
    },
    {
        "name": "get_order_status_breakdown",
        "description": "How many orders are in each status (pending, in production, completed...).",
        "args": NoArgs,
    },
]

TOOL_NAMES = {spec["name"] for spec in TOOL_SPECS}


async def call_tool(
    tools: AnalyticsTools, name: str, raw_args: dict[str, Any]
) -> dict[str, Any]:
    """
    Dispatch a tool call, validating its arguments first.

    Two guards, both load-bearing:

      1. `name` must be in the whitelist. An unknown name is refused outright —
         there is no dynamic getattr on user-supplied text.
      2. Arguments go through the pydantic model, so an out-of-range limit or an
         invented period is rejected BEFORE any SQL runs.

    Every call is logged (tool, args, ms) per D9.
    """
    spec = next((s for s in TOOL_SPECS if s["name"] == name), None)
    if spec is None:
        raise ValueError(f"unknown tool: {name}")

    args = spec["args"](**(raw_args or {}))
    method = getattr(tools, name)

    started = time.perf_counter()
    result = await method(args)
    elapsed_ms = round((time.perf_counter() - started) * 1000)

    logger.info(
        "ai_tool_call tool=%s args=%s ms=%s",
        name,
        args.model_dump(),
        elapsed_ms,
    )

    return result
