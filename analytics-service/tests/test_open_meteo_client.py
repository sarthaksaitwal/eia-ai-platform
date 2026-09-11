import pytest
import respx
from httpx import Response

from app.services.clients.open_meteo_client import (
    fetch_air_quality,
    fetch_weather,
    AIR_QUALITY_ENDPOINT,
    WEATHER_ENDPOINT,
)


@pytest.mark.asyncio
@respx.mock
async def test_fetch_air_quality_calls_correct_endpoint_and_params():
    route = respx.get(AIR_QUALITY_ENDPOINT).mock(
        return_value=Response(200, json={"current": {"pm10": 40.0}, "current_units": {"pm10": "µg/m³"}})
    )
    result = await fetch_air_quality(20.0, 73.78)

    assert route.called
    request = route.calls[0].request
    assert "latitude=20.0" in str(request.url)
    assert "longitude=73.78" in str(request.url)
    assert result["current"]["pm10"] == 40.0


@pytest.mark.asyncio
@respx.mock
async def test_fetch_weather_calls_correct_endpoint_and_params():
    route = respx.get(WEATHER_ENDPOINT).mock(
        return_value=Response(200, json={"current": {"temperature_2m": 29.4}, "current_units": {"temperature_2m": "°C"}})
    )
    result = await fetch_weather(20.0, 73.78)

    assert route.called
    assert result["current"]["temperature_2m"] == 29.4


@pytest.mark.asyncio
@respx.mock
async def test_fetch_air_quality_raises_on_http_error():
    respx.get(AIR_QUALITY_ENDPOINT).mock(return_value=Response(500))
    with pytest.raises(Exception):
        await fetch_air_quality(20.0, 73.78)
