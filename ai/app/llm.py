import json
import logging
import re
from abc import ABC, abstractmethod

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)


class LlmError(Exception):
    """The model could not be reached, or returned something unusable."""


class LlmClient(ABC):
    """
    Provider-agnostic (plan Session 9.1, task 3).

    Switching provider is an env change (LLM_PROVIDER), not a code change. The
    pipeline above never learns which model answered.
    """

    @abstractmethod
    async def complete(self, system: str, user: str) -> str: ...


class AnthropicClient(LlmClient):
    """Claude via the Messages API."""

    _URL = "https://api.anthropic.com/v1/messages"

    def __init__(self, settings: Settings) -> None:
        self._s = settings

    async def complete(self, system: str, user: str) -> str:
        payload = {
            "model": self._s.llm_model,
            "max_tokens": self._s.llm_max_tokens,
            "temperature": self._s.llm_temperature,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
        headers = {
            "x-api-key": self._s.llm_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self._s.llm_timeout_seconds) as http:
                response = await http.post(self._URL, json=payload, headers=headers)
                response.raise_for_status()
                body = response.json()
        except httpx.HTTPError as exc:
            # Never leak the key or the raw provider error to the caller.
            raise LlmError(f"{type(exc).__name__}") from exc

        try:
            return body["content"][0]["text"]
        except (KeyError, IndexError) as exc:
            raise LlmError("unexpected response shape") from exc


class OpenAiClient(LlmClient):
    """Any OpenAI-compatible endpoint."""

    _URL = "https://api.openai.com/v1/chat/completions"

    def __init__(self, settings: Settings) -> None:
        self._s = settings

    async def complete(self, system: str, user: str) -> str:
        payload = {
            "model": self._s.llm_model,
            "max_tokens": self._s.llm_max_tokens,
            "temperature": self._s.llm_temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        headers = {
            "authorization": f"Bearer {self._s.llm_api_key}",
            "content-type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self._s.llm_timeout_seconds) as http:
                response = await http.post(self._URL, json=payload, headers=headers)
                response.raise_for_status()
                body = response.json()
        except httpx.HTTPError as exc:
            raise LlmError(f"{type(exc).__name__}") from exc

        try:
            return body["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:
            raise LlmError("unexpected response shape") from exc


def build_client(settings: Settings) -> LlmClient | None:
    """None when no key is configured — the pipeline then degrades gracefully."""
    if not settings.llm_enabled:
        return None
    if settings.llm_provider == "openai":
        return OpenAiClient(settings)
    return AnthropicClient(settings)


_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)


def parse_json_object(raw: str) -> dict:
    """
    Pull a JSON object out of the model's reply.

    Models wrap JSON in prose or fences however firmly you ask them not to, and a
    demo that dies on a stray ```json fence is a bad demo. Try the strict parse
    first; fall back to the outermost {...}. If both fail the caller degrades to
    a plain product list rather than showing the customer an error.
    """
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    match = _JSON_BLOCK.search(raw)
    if not match:
        raise LlmError("no JSON object in model output")

    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise LlmError("malformed JSON in model output") from exc
