from fastapi.testclient import TestClient

from app.main import app
from app.services import environmental_data_service as service

client = TestClient(app)


def test_fetch_endpoint_passes_request_through(monkeypatch):
    captured = {}

    async def fake_collect(latitude, longitude, *, radius_km, assessment_id):
        captured.update(latitude=latitude, longitude=longitude, radius_km=radius_km, assessment_id=assessment_id)
        return {
            "request": {"assessment_id": assessment_id, "latitude": latitude, "longitude": longitude, "radius_km": radius_km},
            "retrieved_at": "2026-09-10T17:00:00Z",
            "duration_ms": 12,
            "observations": [],
            "gis_features": [],
            "sections": [],
            "required_inputs": [],
            "providers": [],
            "warnings": [],
        }

    monkeypatch.setattr(service, "collect_environmental_data", fake_collect)
    response = client.post("/api/environmental/fetch", json={"latitude": 28.6, "longitude": 77.2, "radius_km": 10, "assessment_id": "a-1"})

    assert response.status_code == 200
    assert captured == {"latitude": 28.6, "longitude": 77.2, "radius_km": 10, "assessment_id": "a-1"}
    assert response.json()["retrieved_at"] == "2026-09-10T17:00:00Z"


def test_fetch_endpoint_validates_coordinates_and_radius():
    assert client.post("/api/environmental/fetch", json={"latitude": 91, "longitude": 77.2}).status_code == 422
    assert client.post("/api/environmental/fetch", json={"latitude": 28.6, "longitude": 77.2, "radius_km": 30}).status_code == 422


def test_database_writing_endpoints_are_gone():
    assert client.post("/api/assessments/any/environmental-data/fetch").status_code == 404


def test_health():
    assert client.get("/health").json() == {"status": "ok"}
