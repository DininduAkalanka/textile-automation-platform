import logging
from contextlib import asynccontextmanager

import asyncpg
from fastapi import Depends, FastAPI, Header, HTTPException, status

from app.chat import CustomerChatService
from app.config import Settings, get_settings
from app.llm import build_client
from app.models import ChatRequest, ChatResponse
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
