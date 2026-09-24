from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["topics"] >= 12


def test_filter_updates_by_topic():
    response = client.get("/api/updates?topic=P2")
    assert response.status_code == 200
    items = response.json()
    assert items
    assert all(item["topic"] == "P2" for item in items)
