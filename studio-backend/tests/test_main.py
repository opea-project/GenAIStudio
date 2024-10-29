# tests/test_main.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/studio-backend/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}