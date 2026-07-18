import logging
from contextlib import asynccontextmanager

import asyncpg
from fastapi import Depends, FastAPI, Header, HTTPException, status

from app.analytics import (
    BasketArgs,
    DeadStockArgs,
    ForecastArgs,
    ReorderArgs,
    TopProductsArgs,
    TrendingArgs,
    dead_stock,
    demand_forecast,
    frequently_bought_together,
    reorder_suggestions,
    top_products,
    trending,
)
from app.business import BusinessChatService
from app.chat import CustomerChatService
from app.config import Settings, get_settings
from app.llm import build_client
from app.models import (
    BusinessRequest,
    BusinessResponse,
    ChatRequest,
    ChatResponse,
)
from app.retrieval import FtsRetriever

logging.basicConfig(
    level=logging.INFO,
    format='{"level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
)
logger = logging.getLogger("ai")

_state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    # A small pool: this service is not the hot path, and the free-tier Postgres
    # connection limit is shared with the API, which needs it more.
    _state["pool"] = await asyncpg.create_pool(
        settings.database_url_readonly, min_size=1, max_size=5
    )
    _state["settings"] = settings
    _state["llm"] = build_client(settings)

    logger.info(
        "ai_service_started provider=%s model=%s llm_enabled=%s",
        settings.llm_provider,
        settings.llm_model,
        settings.llm_enabled,
    )
    yield
    await _state["pool"].close()


app = FastAPI(title="Textile AI Service", version="1.0.0", lifespan=lifespan)


def require_internal_key(
    x_internal_key: str = Header(default=""),
    settings: Settings = Depends(get_settings),
) -> None:
    """
    The AI service is not a public API. Its only client is the NestJS gateway,
    which holds the shared secret. Without this, anyone who found the service's
    URL could burn the LLM budget (doc 09 §8).
    """
    if x_internal_key != settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid internal key"
        )


@app.get("/health")
async def health() -> dict:
    """
    Touches the database, because a service that is up but cannot read the
    catalogue is not healthy — and the deploy platform's health check needs to
    know the difference.
    """
    database = "up"
    try:
        async with _state["pool"].acquire() as conn:
            await conn.fetchval("SELECT 1")
    except Exception:  # noqa: BLE001 - health must never raise
        database = "down"

    settings: Settings = _state["settings"]
    return {
        "status": "ok" if database == "up" else "degraded",
        "database": database,
        # Useful at a glance in a demo: is the model actually wired up?
        "llm_enabled": settings.llm_enabled,
        "llm_provider": settings.llm_provider,
    }


@app.post(
    "/v1/chat/customer",
    response_model=ChatResponse,
    dependencies=[Depends(require_internal_key)],
)
async def customer_chat(request: ChatRequest) -> ChatResponse:
    settings: Settings = _state["settings"]
    service = CustomerChatService(
        pool=_state["pool"],
        retriever=FtsRetriever(_state["pool"]),
        llm=_state["llm"],
        settings=settings,
    )
    return await service.answer(request)


def require_admin(x_user_role: str = Header(default="")) -> None:
    """
    The business assistant is for the owner alone (doc 09 §4.2: "View AI Reports —
    Admin only").

    The role is asserted by the NestJS gateway, which has already verified the JWT
    with RolesGuard. This header is a claim FORWARDED by a trusted caller, not a
    credential — and it is only trustworthy because require_internal_key has
    already established that the caller IS the gateway. Without that shared secret,
    anyone could set this header and read the shop's revenue.
    """
    if x_user_role.upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="business insights are available to admins only",
        )


@app.post(
    "/v1/chat/business",
    response_model=BusinessResponse,
    dependencies=[Depends(require_internal_key), Depends(require_admin)],
)
async def business_chat(request: BusinessRequest) -> BusinessResponse:
    """
    The owner's analyst (decision D9).

    The model NEVER emits SQL. It picks tools by name from a fixed whitelist; we
    run our own parameterised queries against PII-free views. Every number it then
    states is checked against those tool outputs before the answer is returned.
    """
    settings: Settings = _state["settings"]
    service = BusinessChatService(
        pool=_state["pool"],
        llm=_state["llm"],
        settings=settings,
    )
    return await service.answer(request)


# ─── Predictive analytics (structured JSON for the /admin/analytics dashboard) ─
# Same guards as the business chat: internal key proves the caller is the gateway,
# admin role is the forwarded, gateway-verified claim. No LLM involved — these are
# the raw model/analytics outputs the dashboard charts render directly.

_ANALYTICS_GUARDS = [Depends(require_internal_key), Depends(require_admin)]


@app.post("/v1/analytics/forecast", dependencies=_ANALYTICS_GUARDS)
async def analytics_forecast(args: ForecastArgs) -> dict:
    return await demand_forecast(_state["pool"], args)


@app.post("/v1/analytics/trending", dependencies=_ANALYTICS_GUARDS)
async def analytics_trending(args: TrendingArgs) -> dict:
    return await trending(_state["pool"], args)


@app.post("/v1/analytics/dead-stock", dependencies=_ANALYTICS_GUARDS)
async def analytics_dead_stock(args: DeadStockArgs) -> dict:
    return await dead_stock(_state["pool"], args)


@app.post("/v1/analytics/recommendations", dependencies=_ANALYTICS_GUARDS)
async def analytics_recommendations(args: BasketArgs) -> dict:
    return await frequently_bought_together(_state["pool"], args)


@app.post("/v1/analytics/reorder", dependencies=_ANALYTICS_GUARDS)
async def analytics_reorder(args: ReorderArgs) -> dict:
    return await reorder_suggestions(_state["pool"], args)


@app.post("/v1/analytics/top-products", dependencies=_ANALYTICS_GUARDS)
async def analytics_top_products(args: TopProductsArgs) -> dict:
    return await top_products(_state["pool"], args)
