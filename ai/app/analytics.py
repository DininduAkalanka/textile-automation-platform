"""
Predictive analytics over the PII-free fact views (the Analytics/Reports admin
sections, backed by the vision + tech-stack docs).

Same discipline as tools.py: bounded pydantic args, hand-written parameterised
SQL against `ai_sales_facts` / `ai_inventory_facts`, read-only role. The
model-driven pieces (demand forecast, reorder) hand their number series to
forecasting.forecast_series — the SQL builds the series, the model predicts.

Arg models live here (not tools.py) so tools.py can import them without a cycle.
"""

from __future__ import annotations

from typing import Any, Literal

import asyncpg
from pydantic import BaseModel, Field

from app.forecasting import forecast_series

Period = Literal["7d", "30d", "90d"]
StarPeriod = Literal["30d", "90d", "365d"]
_PERIOD_DAYS: dict[str, int] = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}

# How many weeks of history feed the forecaster.
_HISTORY_WEEKS = 26


# ─── Argument schemas ───────────────────────────────────────────────────────


class ForecastArgs(BaseModel):
    # Forecast the next N weeks for the top products by volume.
    weeks: int = Field(default=4, ge=1, le=12)
    products: int = Field(default=5, ge=1, le=8)


class ReorderArgs(BaseModel):
    weeks: int = Field(default=4, ge=1, le=12)
    products: int = Field(default=8, ge=1, le=15)


class TrendingArgs(BaseModel):
    period: Period = "30d"
    limit: int = Field(default=5, ge=1, le=10)


class TopProductsArgs(BaseModel):
    period: StarPeriod = "90d"
    limit: int = Field(default=5, ge=1, le=10)
    by: Literal["revenue", "quantity"] = "revenue"


class DeadStockArgs(BaseModel):
    # "No sale in this many days, but still in stock."
    days: int = Field(default=60, ge=14, le=180)
    limit: int = Field(default=10, ge=1, le=50)


class BasketArgs(BaseModel):
    limit: int = Field(default=5, ge=1, le=20)


# ─── Shared helpers ─────────────────────────────────────────────────────────


async def _top_by_volume(conn: asyncpg.Connection, limit: int) -> list[asyncpg.Record]:
    return await conn.fetch(
        """
        SELECT product_id, product_name, SUM(quantity)::int AS total_qty
          FROM ai_sales_facts
         WHERE payment_status = 'COMPLETED'
         GROUP BY product_id, product_name
         ORDER BY total_qty DESC
         LIMIT $1
        """,
        limit,
    )


async def _weekly_series(
    conn: asyncpg.Connection, product_id: Any
) -> list[asyncpg.Record]:
    """Zero-filled weekly units for one product over the history window."""
    return await conn.fetch(
        """
        WITH weeks AS (
            SELECT generate_series(
                date_trunc('week', now() - ($2 || ' weeks')::interval),
                date_trunc('week', now()),
                interval '1 week'
            ) AS wk
        )
        SELECT to_char(w.wk, 'YYYY-MM-DD') AS week,
               COALESCE(SUM(f.quantity), 0)::int AS qty
          FROM weeks w
          LEFT JOIN ai_sales_facts f
                 ON f.payment_status = 'COMPLETED'
                AND f.product_id = $1
                AND date_trunc('week', f.paid_at) = w.wk
         GROUP BY w.wk
         ORDER BY w.wk
        """,
        product_id,
        str(_HISTORY_WEEKS),
    )


# ─── Compute functions ──────────────────────────────────────────────────────


async def demand_forecast(pool: asyncpg.Pool, args: ForecastArgs) -> dict[str, Any]:
    """Weekly demand forecast for the top products, each with a confidence flag."""
    async with pool.acquire() as conn:
        top = await _top_by_volume(conn, args.products)
        forecasts = []
        for row in top:
            weekly = await _weekly_series(conn, row["product_id"])
            history = [r["qty"] for r in weekly]
            fc = forecast_series(history, horizon=args.weeks, season_length=0)
            forecasts.append(
                {
                    "product": row["product_name"],
                    "history": [
                        {"week": r["week"], "qty": r["qty"]} for r in weekly
                    ],
                    "forecast": fc,
                    "predicted_next_period": sum(fc["predicted"]),
                }
            )
    return {"weeks": args.weeks, "products": forecasts}


async def reorder_suggestions(
    pool: asyncpg.Pool, args: ReorderArgs
) -> dict[str, Any]:
    """
    The owner's headline decision: forecast next-N-weeks demand per top product,
    compare to what's actually sellable now, and flag anything that will run out.
    Only products that fall short are returned, most urgent (least weeks of
    cover) first.
    """
    async with pool.acquire() as conn:
        top = await _top_by_volume(conn, args.products)
        stock_rows = await conn.fetch(
            "SELECT product_id, sellable FROM ai_inventory_facts"
        )
        stock = {r["product_id"]: max(0, r["sellable"]) for r in stock_rows}

        items = []
        for row in top:
            weekly = await _weekly_series(conn, row["product_id"])
            fc = forecast_series(
                [r["qty"] for r in weekly], horizon=args.weeks, season_length=0
            )
            predicted = sum(fc["predicted"])
            in_stock = stock.get(row["product_id"], 0)
            if predicted <= in_stock:
                continue  # enough cover — not a reorder decision

            weekly_avg = predicted / args.weeks if args.weeks else 0
            items.append(
                {
                    "product": row["product_name"],
                    "predicted": predicted,
                    "in_stock": in_stock,
                    "suggested_reorder": predicted - in_stock,
                    "weeks_of_cover": (
                        round(in_stock / weekly_avg, 1) if weekly_avg else 0.0
                    ),
                    "confidence": fc["confidence"],
                }
            )

        items.sort(key=lambda x: x["weeks_of_cover"])

    return {"weeks": args.weeks, "count": len(items), "items": items}


async def trending(pool: asyncpg.Pool, args: TrendingArgs) -> dict[str, Any]:
    """
    Momentum both ways: what is heating up (risers) and what is cooling down
    (decliners), this period vs the previous equal period. A FULL OUTER JOIN so
    a product that sold last period but stopped still shows as a decliner.
    """
    days = _PERIOD_DAYS[args.period]
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            WITH cur AS (
                SELECT product_id, product_name, SUM(quantity)::int AS qty
                  FROM ai_sales_facts
                 WHERE payment_status = 'COMPLETED'
                   AND paid_at >= now() - ($1 || ' days')::interval
                 GROUP BY product_id, product_name
            ),
            prev AS (
                SELECT product_id, product_name, SUM(quantity)::int AS qty
                  FROM ai_sales_facts
                 WHERE payment_status = 'COMPLETED'
                   AND paid_at >= now() - (($1::int * 2) || ' days')::interval
                   AND paid_at <  now() - ($1 || ' days')::interval
                 GROUP BY product_id, product_name
            )
            SELECT COALESCE(c.product_name, p.product_name) AS name,
                   COALESCE(c.qty, 0)                       AS current_qty,
                   COALESCE(p.qty, 0)                       AS previous_qty
              FROM cur c
              FULL OUTER JOIN prev p ON p.product_id = c.product_id
             WHERE COALESCE(c.qty, 0) > 0 OR COALESCE(p.qty, 0) > 0
            """,
            str(days),
        )

    movers = []
    for r in rows:
        cur, prev = r["current_qty"], r["previous_qty"]
        is_new = prev == 0
        growth = None if prev == 0 else round((cur - prev) / prev * 100, 1)
        movers.append(
            {
                "name": r["name"],
                "current": cur,
                "previous": prev,
                "growth_percent": growth,
                "is_new": is_new,
            }
        )

    # Risers: new products or positive growth, biggest first.
    risers = sorted(
        [m for m in movers if m["is_new"] or (m["growth_percent"] or 0) > 0],
        key=lambda m: (m["growth_percent"] is None, -(m["growth_percent"] or 1e9)),
    )[: args.limit]
    # Decliners: real negative growth (had sales before), most negative first.
    decliners = sorted(
        [
            m
            for m in movers
            if not m["is_new"] and (m["growth_percent"] or 0) < 0
        ],
        key=lambda m: m["growth_percent"] or 0,
    )[: args.limit]

    return {"period": args.period, "risers": risers, "decliners": decliners}


async def top_products(pool: asyncpg.Pool, args: TopProductsArgs) -> dict[str, Any]:
    """Star products — best sellers over a period (365d ≈ 'last year')."""
    days = _PERIOD_DAYS[args.period]
    order_by = "revenue" if args.by == "revenue" else "quantity"
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT product_name,
                   product_type,
                   SUM(quantity)::int        AS quantity,
                   SUM(line_revenue)::float8 AS revenue
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


async def dead_stock(pool: asyncpg.Pool, args: DeadStockArgs) -> dict[str, Any]:
    """In stock, but no sales in the window — capital sitting on a shelf."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            WITH recent AS (
                SELECT product_id, SUM(quantity)::int AS qty_sold
                  FROM ai_sales_facts
                 WHERE payment_status = 'COMPLETED'
                   AND paid_at >= now() - ($1 || ' days')::interval
                 GROUP BY product_id
            )
            SELECT inv.product_name,
                   inv.product_type,
                   inv.quantity_available,
                   inv.sellable
              FROM ai_inventory_facts inv
              LEFT JOIN recent r ON r.product_id = inv.product_id
             WHERE inv.sellable > 0
               AND COALESCE(r.qty_sold, 0) = 0
             ORDER BY inv.quantity_available DESC
             LIMIT $2
            """,
            str(args.days),
            args.limit,
        )

    return {
        "days": args.days,
        "count": len(rows),
        "items": [
            {
                "name": r["product_name"],
                "type": r["product_type"],
                "available": r["quantity_available"],
                "sellable": r["sellable"],
            }
            for r in rows
        ],
    }


async def frequently_bought_together(
    pool: asyncpg.Pool, args: BasketArgs
) -> dict[str, Any]:
    """Product pairs that appear in the same order — a basic association count."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT a.product_name                    AS product_a,
                   b.product_name                    AS product_b,
                   COUNT(DISTINCT a.order_id)::int   AS together_count
              FROM ai_sales_facts a
              JOIN ai_sales_facts b
                ON a.order_id = b.order_id
               AND a.product_id < b.product_id
             WHERE a.payment_status = 'COMPLETED'
             GROUP BY a.product_name, b.product_name
            HAVING COUNT(DISTINCT a.order_id) >= 2
             ORDER BY together_count DESC
             LIMIT $1
            """,
            args.limit,
        )

    return {
        "pairs": [
            {
                "product_a": r["product_a"],
                "product_b": r["product_b"],
                "together_count": r["together_count"],
            }
            for r in rows
        ],
    }
