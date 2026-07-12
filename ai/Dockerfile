# Python 3.12, not 3.13/3.14: pydantic-core ships prebuilt wheels for 3.12, and
# newer interpreters fall back to compiling it from Rust source — a slow, fragile
# build that has no business in a deploy pipeline.
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Copy requirements first so the dependency layer is cached across code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as a non-root user. The service holds a read-only DB credential and an LLM
# key; there is no reason for it to be root inside its own container.
RUN useradd --create-home --uid 10001 aiuser && chown -R aiuser:aiuser /app
USER aiuser

EXPOSE 8000

# One worker: this service is I/O-bound (it waits on Postgres and the LLM), and
# on a free tier a second worker doubles the memory for no throughput.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
