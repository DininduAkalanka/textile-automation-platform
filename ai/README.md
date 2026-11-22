# AI Service

The FastAPI service behind the customer shopping assistant, the owner's business-insights assistant and the admin analytics. It never writes data and is never called by browsers directly: only the [backend API](../backend/README.md) calls it.

Part of the [Nandana Textile platform](../README.md).

---

## Endpoints

| Method and path | Caller | Purpose |
| :--- | :--- | :--- |
| `GET /health` | monitoring | Database reachability and whether an LLM key is configured |
| `POST /v1/chat/customer` | API (internal key) | Shopping assistant: suggests products from the live catalogue |
| `POST /v1/chat/business` | API (internal key, admin role) | Business questions answered from the shop's own data |
| `POST /v1/analytics/{forecast, trending, dead-stock, recommendations, reorder, top-products}` | API (internal key, admin role) | Structured figures for the admin analytics page |

Every endpoint except `/` and `/health` requires the `X-Internal-Key` header, compared in constant time. The admin role arrives as the `X-User-Role` header and is trusted only because the internal key proves the caller is the API, which has already checked the user's token.

## How the assistants stay accurate

- **Customer assistant**: PostgreSQL full-text search finds candidate products (all terms first, then any term). The model may only choose among those products; any product ID it returns that was not retrieved is dropped, and price and stock are read back from the database, never taken from the model.
- **Business assistant**: the model picks from a fixed list of tools; the service runs its own parameterised queries against PII-free views. Every number in the answer is checked against the tool results, and an answer with an unsupported number is flagged as not grounded.
- **Forecasting**: Holt-Winters exponential smoothing (statsmodels) on the last 26 weeks of sales.
- **Without an LLM key** the service still works: the customer assistant returns a ranked product list with a plain message.

## Safety model

- Connects with the read-only role `textile_ai_readonly` (created by the API's migrations): it can read the catalogue and the analytics views, and nothing else (no users, orders or payments tables, no writes).
- Cuts messages to `MAX_MESSAGE_CHARS` and keeps only the last `MAX_HISTORY_TURNS` turns of history: long inputs are the usual carriers of prompt-injection attempts.
- In production (Render, `NODE_ENV=production` or `ENVIRONMENT=production`) it refuses to start with the default internal key or the default read-only password, and turns off `/docs` unless `AI_DOCS_ENABLED=true`.

## Configuration

Copy [`.env.example`](.env.example) to `.env`.

| Variable | Purpose |
| :--- | :--- |
| `DATABASE_URL_READONLY` | Connection as `textile_ai_readonly` (rotate its password for production) |
| `INTERNAL_API_KEY` | Shared secret; must equal the API's `INTERNAL_API_KEY` |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` | Model provider (Groq by default) |
| `LLM_TEMPERATURE`, `LLM_MAX_TOKENS`, `RETRIEVAL_K`, `MAX_MESSAGE_CHARS`, `MAX_HISTORY_TURNS` | Assistant tuning |

## Run

```bash
python -m venv .venv
. .venv/bin/activate              # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload
```

With Docker Compose it runs as the `ai` service on port 8000.

## Tests

```bash
pytest
```

The tests cover forecasting, the business assistant, guardrails and earlier QA findings. They are not part of CI yet, so run them before changing this service.

## Code map

| File | Contents |
| :--- | :--- |
| `app/main.py` | Endpoints, startup, internal-key and admin checks |
| `app/chat.py`, `app/retrieval.py` | Customer assistant and full-text retrieval |
| `app/business.py`, `app/tools.py` | Business assistant and its whitelisted tools |
| `app/analytics.py`, `app/forecasting.py` | Analytics endpoints and Holt-Winters forecasting |
| `app/grounding.py` | Checks that answers only use retrieved facts |
| `app/llm.py`, `app/config.py`, `app/models.py` | Model client, settings, request and response models |
