import re
from abc import ABC, abstractmethod

import asyncpg

from app.models import ProductDoc

# Only the columns a shopping assistant legitimately needs. The AI's DB role
# cannot see users, orders, payments or measurements anyway (see the
# ai_readonly_role migration) — this is the second layer of that same rule.
_SELECT = """
    SELECT p.id::text,
           p.name,
           p.description,
           p.price::float8      AS price,
           p.product_type::text AS product_type,
           p.fabric_type,
           p.color,
           p.unit,
           p.requires_measurement,
           COALESCE(i.quantity_available - i.quantity_reserved, 0) AS stock,
           (p.images ->> 0)     AS image
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.id
     WHERE p.is_active
"""

# The OR-of-lexemes tsquery, as a scalar subexpression.
#
# Written out rather than assembled by string-replacing _SELECT: the first version
# of this did exactly that, produced `FROM products p, q LEFT JOIN inventory i`,
# and Postgres rejected it because the LEFT JOIN bound to `q` and `p` fell out of
# scope. Clever string surgery on SQL is how you get a 500 in front of a customer.
_OR_TERMS = """
    NULLIF(
        array_to_string(tsvector_to_array(to_tsvector('english', $1)), ' | '),
        ''
    )
"""


class Retriever(ABC):
    """
    The retrieval interface (plan Session 9.1, task 2).

    Abstract so a PgVectorRetriever can replace the FTS one later without the
    chat pipeline changing a line — decision D10 names that as the upgrade path.
    """

    @abstractmethod
    async def retrieve(self, query: str, k: int = 8) -> list[ProductDoc]: ...


class FtsRetriever(Retriever):
    """
    Postgres full-text search over products.search_vector (decision D10).

    THE IMPORTANT PART — why this is not just websearch_to_tsquery:

    websearch_to_tsquery ANDs every term. "school uniform fabric for kids" becomes
    'school' & 'uniform' & 'fabric' & 'kid', and no single product contains all
    four words, so it returns NOTHING. A shopping assistant fed natural language
    would come back empty on a perfectly reasonable request and tell the customer
    we don't stock what we obviously stock.

    So: try the strict AND query first (precise — if a product really does match
    every term, that is the best answer). If it yields too little, fall back to an
    OR of the same lexemes and let ts_rank sort them. "school uniform fabric for
    kids" then correctly returns Polyester Blend Uniform Fabric, School Uniform
    Trousers, Cotton Poplin Shirting.

    Precision first, recall second — never nothing.
    """

    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def retrieve(self, query: str, k: int = 8) -> list[ProductDoc]:
        cleaned = _sanitise(query)
        if not cleaned:
            return []

        async with self._pool.acquire() as conn:
            rows = await self._strict(conn, cleaned, k)

            # Too few hits to be useful -> widen. Half of k is the threshold: one
            # exact match is a good answer, but it is not a shortlist.
            if len(rows) < max(2, k // 2):
                loose = await self._loose(conn, cleaned, k)
                seen = {r["id"] for r in rows}
                rows.extend(r for r in loose if r["id"] not in seen)

        return [ProductDoc(**dict(row)) for row in rows[:k]]

    async def _strict(self, conn: asyncpg.Connection, query: str, k: int):
        """AND semantics — every term must appear."""
        return await conn.fetch(
            f"""
            {_SELECT}
              AND p.search_vector @@ websearch_to_tsquery('english', $1)
            ORDER BY ts_rank(p.search_vector, websearch_to_tsquery('english', $1)) DESC
            LIMIT $2
            """,
            query,
            k,
        )

    async def _loose(self, conn: asyncpg.Connection, query: str, k: int):
        """
        OR semantics over the same lexemes.

        Postgres does the tokenising: to_tsvector normalises and stems the query,
        tsvector_to_array pulls out the lexemes, and array_to_string ORs them into
        a tsquery. The query string is a bind parameter throughout — it is never
        concatenated into SQL — so there is no injection surface even though we are
        constructing a tsquery from user input.

        NULLIF guards the empty case: a query of pure stopwords ("for the a")
        produces no lexemes, and to_tsquery('') would raise. to_tsquery(NULL)
        returns NULL instead, and `search_vector @@ NULL` is NULL, so the row is
        simply excluded. No rows, no error.
        """
        return await conn.fetch(
            f"""
            {_SELECT}
              AND p.search_vector @@ to_tsquery('english', {_OR_TERMS})
            ORDER BY ts_rank(p.search_vector, to_tsquery('english', {_OR_TERMS})) DESC
            LIMIT $2
            """,
            query,
            k,
        )


async def hydrate(pool: asyncpg.Pool, ids: list[str]) -> list[ProductDoc]:
    """
    Read products back from the database by id.

    This is the hallucination guard (CODING_STANDARDS §9.1, doc 09 §8). The model
    returns ids; we return PRODUCTS. An id the model invented simply does not come
    back, so it cannot reach the customer. The price and stock shown are the
    database's, not the model's.
    """
    if not ids:
        return []

    async with pool.acquire() as conn:
        rows = await conn.fetch(f"{_SELECT} AND p.id::text = ANY($1::text[])", ids)

    by_id = {row["id"]: ProductDoc(**dict(row)) for row in rows}
    # Preserve the model's ordering — it ranked them for a reason.
    return [by_id[i] for i in ids if i in by_id]


_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _sanitise(query: str) -> str:
    """Strip control characters and collapse whitespace. Length is capped upstream."""
    return _CONTROL_CHARS.sub(" ", query).strip()
