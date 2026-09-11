from fastapi.testclient import TestClient

from app.main import app
from app.services import environmental_data_service as service

client = TestClient(app)

# The shape the Node backend sends.
PAYLOAD = {
    "assessment_id": "a-1",
    "radius_km": 10,
    "location": {"latitude": 28.6, "longitude": 77.2, "city": "New Delhi", "state": "Delhi", "country": "India"},
    "project": {"id": "p-1", "industry": "Cement", "land_area": 12.5, "land_area_unit": "ha"},
    "assessment_inputs": [{"category": "Noise", "parameter_name": "leq_day", "value_numeric": 55, "unit": "dB(A)"}],
}


def test_fetch_endpoint_passes_backend_payload_through(monkeypatch):
    captured = {}

    async def fake_collect(latitude, longitude, **kwargs):
        captured.update(latitude=latitude, longitude=longitude, **kwargs)
        return {
            "request": {
                "assessment_id": kwargs["assessment_id"], "latitude": latitude, "longitude": longitude,
                "radius_km": kwargs["radius_km"], "location": kwargs["location"], "project": kwargs["project"],
                "assessment_input_count": len(kwargs["assessment_inputs"]),
            },
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
    response = client.post("/api/environmental/fetch", json=PAYLOAD)

    assert response.status_code == 200
    assert (captured["latitude"], captured["longitude"], captured["radius_km"], captured["assessment_id"]) == (28.6, 77.2, 10, "a-1")
    assert captured["location"]["state"] == "Delhi"
    assert captured["project"]["land_area"] == 12.5
    assert captured["assessment_inputs"] == [
        {"category": "Noise", "parameter_name": "leq_day", "value_numeric": 55.0, "value_text": None, "unit": "dB(A)", "source": None}
    ]
    body = response.json()
    assert body["retrieved_at"] == "2026-09-10T17:00:00Z"
    assert body["request"]["location"]["city"] == "New Delhi"
    assert body["request"]["assessment_input_count"] == 1


def test_fetch_endpoint_validates_payload():
    location = {"latitude": 28.6, "longitude": 77.2}

    def status(payload):
        return client.post("/api/environmental/fetch", json=payload).status_code

    assert status({"latitude": 28.6, "longitude": 77.2}) == 422  # coordinates belong in "location"
    assert status({"location": {"latitude": 91, "longitude": 77.2}}) == 422
    assert status({"location": location, "radius_km": 30}) == 422
    assert status({"location": location, "assessment_inputs": [{"category": "Noise", "parameter_name": ""}]}) == 422
    assert status({"location": location, "project": {"operating_hours_per_day": 25}}) == 422


def test_database_writing_endpoints_are_gone():
    assert client.post("/api/assessments/any/environmental-data/fetch").status_code == 404


def test_health():
    assert client.get("/health").json() == {"status": "ok"}
