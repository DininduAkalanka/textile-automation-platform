from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Configuration for the AI service (plan Session 9.1).

    Every value comes from the environment. The service holds no secrets of its
    own and, critically, no write credentials: DATABASE_URL_READONLY points at
    the `textile_ai_readonly` Postgres role, which can SELECT the catalog and
    nothing else. See the 20260712010000_ai_readonly_role migration.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Read-only DB. If someone pastes the admin URL in here by mistake, the
    # service still cannot write, because it never issues a write statement --
    # but the role is the real guarantee.
    database_url_readonly: str = (
        "postgresql://textile_ai_readonly:ai_readonly_local_dev_password"
        "@postgres:5432/textile_db"
    )

    # Shared secret with the NestJS gateway. The AI service is not exposed to the
    # internet; the API is its only client.
    internal_api_key: str = "local-dev-internal-key"

    # Provider-agnostic by design (plan Session 9.1, task 3). Switching provider
    # is an env change, not a code change.
    llm_provider: Literal["anthropic", "openai"] = "anthropic"
    llm_api_key: str = ""
    llm_model: str = "claude-sonnet-5"

    # Low temperature: this is a shopping assistant, not a poet. It must pick
    # from a fixed list of products, so creativity is a liability.
    llm_temperature: float = 0.2
    llm_max_tokens: int = 700
    llm_timeout_seconds: float = 30.0

    # How many products the retriever hands the model. Enough to choose from,
    # few enough to keep the prompt tight and the latency low (doc 13: p50 < 3s).
    retrieval_k: int = 8

    # Hard cap on user input. Long inputs are the usual vehicle for prompt
    # injection payloads, and no genuine shopping question needs 5000 characters.
    max_message_chars: int = 500
    max_history_turns: int = 6

    @property
    def llm_enabled(self) -> bool:
        """
        Without a key the service still runs: retrieval, validation and the
        guardrails all work, and /v1/chat/customer degrades to a ranked product
        list with a plain message. That is deliberate -- the plan requires the
        LLM to be mockable in CI, and a demo must never hard-fail because a key
        is missing.
        """
        return bool(self.llm_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
