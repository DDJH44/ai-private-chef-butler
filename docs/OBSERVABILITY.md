# Observability

## Current State

- Application logging is initialized in `app/common/logger.py`.
- FastAPI validation errors, HTTP exceptions and unhandled exceptions are handled centrally in `app/main.py`.
- RAG initialization, retrieval failures, image generation failures and shopping/recipe operations emit logs through the shared logger.
- Docker deployment mounts `./logs` for future persistent logging.

## Recommended Production Extensions

- Add request ID middleware and include the ID in every log line.
- Add access logs with method, path, status code and latency.
- Add metrics for LLM latency, RAG retrieval latency, token usage and error rates.
- Add Sentry or another error tracking platform.
- Add Prometheus/Grafana for API health, memory, CPU and queue-level metrics.

## Suggested Metrics

- API requests per minute.
- Error rate by route group.
- Average and p95 response latency.
- First-token latency for streaming chat.
- RAG dense retrieval latency and BM25 retrieval latency.
- ChromaDB collection document counts.
