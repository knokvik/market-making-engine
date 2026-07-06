# Market Making Engine — production dashboard (API + WebSocket + static UI)
FROM node:20-bookworm-slim AS frontend
WORKDIR /build/web
COPY dashboard/web/package.json dashboard/web/package-lock.json ./
RUN npm ci
COPY dashboard/web/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY src/ src/
COPY data/ data/
COPY dashboard/api/ dashboard/api/
COPY --from=frontend /build/web/dist dashboard/web/dist

RUN pip install --no-cache-dir -e ".[dashboard]" -r dashboard/api/requirements.txt

ENV PYTHONPATH=/app/src:/app
ENV PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD uvicorn dashboard.api.main:app --host 0.0.0.0 --port ${PORT}