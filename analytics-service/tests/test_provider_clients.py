import pytest
from httpx import Response

from app.config import settings
from app.services.clients import cpcb_client, openaq_client, osm_client
from app.services.clients.http import ProviderNotConfigured


async def test_openaq_sends_api_key_and_coordinates(respx_mock):
    route = respx_mock.get(openaq_client.LOCATIONS_ENDPOINT).mock(return_value=Response(200, json={"results": []}))
    await openaq_client.search_locations(28.6139, 77.209, api_key="test-key", radius_m=25_000)

    request = route.calls.last.request
    assert request.headers["X-API-Key"] == "test-key"
    assert request.url.params["coordinates"] == "28.6139,77.209"
    assert request.url.params["radius"] == "25000"


async def test_openaq_without_key_is_not_configured_and_makes_no_request(respx_mock):
    with pytest.raises(ProviderNotConfigured):
        await openaq_client.search_locations(28.6, 77.2, api_key=None, radius_m=1_000)
    assert not respx_mock.calls


async def test_openaq_rejects_radius_above_api_limit():
    with pytest.raises(ValueError):
        await openaq_client.search_locations(28.6, 77.2, api_key="k", radius_m=30_000)


async def test_cpcb_without_key_is_not_configured():
    with pytest.raises(ProviderNotConfigured):
        await cpcb_client.fetch_station_records(api_key="")


async def test_cpcb_paginates_until_total(respx_mock, monkeypatch):
    monkeypatch.setattr(cpcb_client, "PAGE_SIZE", 2)

    def page(request):
        offset = int(request.url.params["offset"])
        records = [{"station": f"S{i}"} for i in range(offset, min(offset + 2, 3))]
        return Response(200, json={"total": 3, "records": records})

    route = respx_mock.get(cpcb_client.ENDPOINT).mock(side_effect=page)
    records = await cpcb_client.fetch_station_records(api_key="k")

    assert [record["station"] for record in records] == ["S0", "S1", "S2"]
    assert route.call_count == 2


@pytest.fixture
def two_overpass_endpoints(monkeypatch):
    monkeypatch.setattr(settings, "overpass_endpoints", "https://a.example/api/interpreter,https://b.example/api/interpreter")


async def test_overpass_falls_back_on_gateway_timeout(respx_mock, two_overpass_endpoints):
    respx_mock.post("https://a.example/api/interpreter").mock(return_value=Response(504))
    respx_mock.post("https://b.example/api/interpreter").mock(return_value=Response(200, json={"elements": [{"id": 1}]}))
    assert (await osm_client.run_query("[out:json];"))["elements"] == [{"id": 1}]


async def test_overpass_rejects_partial_results(respx_mock, two_overpass_endpoints):
    respx_mock.post("https://a.example/api/interpreter").mock(
        return_value=Response(200, json={"elements": [], "remark": "runtime error: Query timed out"})
    )
    respx_mock.post("https://b.example/api/interpreter").mock(return_value=Response(200, json={"elements": [{"id": 2}]}))
    assert (await osm_client.run_query("[out:json];"))["elements"] == [{"id": 2}]


async def test_overpass_raises_when_every_endpoint_fails(respx_mock, two_overpass_endpoints):
    respx_mock.post("https://a.example/api/interpreter").mock(return_value=Response(504))
    respx_mock.post("https://b.example/api/interpreter").mock(return_value=Response(429))
    with pytest.raises(osm_client.OverpassError, match="504.*429"):
        await osm_client.run_query("[out:json];")
