FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci --registry=https://registry.npmmirror.com

COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim

WORKDIR /app

RUN sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv -i https://mirrors.tuna.tsinghua.edu.cn/pypi/web/simple/

COPY pyproject.toml ./
RUN uv pip install --system -e .

COPY app/ ./app/
COPY main.py ./

RUN mkdir -p /app/data

COPY --from=frontend-builder /app/frontend/out /app/app/static/

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/api/v1/health || exit 1

CMD ["python", "main.py"]
