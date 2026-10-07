# Development image for the FastAPI analytics service.
#
# This service is stateless: it fetches from external providers and computes,
# and the Node backend persists everything it returns. So there is no database
# driver here and nothing to migrate.
# This project is developed against Python 3.10.9 on the host. 3.12 is the
# default here because every pin in requirements.txt supports it (fastapi
# 0.115, pydantic 2.9, httpx 0.27) and 3.10 reaches end of life in 2026. The
# code itself needs 3.10 as a floor, for the `str | None` annotations.
#
# To pin the container to the host's exact interpreter instead:
#   docker compose build --build-arg PYTHON_VERSION=3.10 analytics
#
# Either way, confirm it before relying on it:
#   docker compose run --rm analytics pytest
ARG PYTHON_VERSION=3.12
FROM python:${PYTHON_VERSION}-slim

# Without the first, the container writes .pyc files into the bind-mounted
# source tree and the host's own pytest starts reading Linux bytecode caches.
# Without the second, uvicorn's output sits in a buffer instead of reaching
# `docker compose logs`.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# python:slim has no unprivileged user of its own.
RUN useradd --create-home --shell /usr/sbin/nologin app \
    && mkdir -p /app && chown app:app /app

WORKDIR /app

# Dependencies first, so an edit to app/ does not reinstall httpx and friends.
COPY --chown=app:app requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY --chown=app:app . .

USER app

EXPOSE 8000

# Overridden in compose.yaml, which adds --reload.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
