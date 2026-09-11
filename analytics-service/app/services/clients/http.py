"""Shared outbound HTTP helpers so every provider client sends the same
User-Agent and uses consistent timeouts."""
from typing import Any, Optional

import httpx

from app.config import settings


class ProviderNotConfigured(Exception):
    """Raised when a provider needs credentials that are not set. The
    environmental data service reports the provider as "skipped"."""


def async_client(*, timeout: Optional[float] = None, headers: Optional[dict[str, str]] = None) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=httpx.Timeout(timeout or settings.http_timeout_seconds, connect=10.0),
        headers={"User-Agent": settings.user_agent, **(headers or {})},
    )


async def get_json(
    url: str,
    *,
    params: Any = None,
    headers: Optional[dict[str, str]] = None,
    timeout: Optional[float] = None,
) -> Any:
    async with async_client(timeout=timeout, headers=headers) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        return response.json()
