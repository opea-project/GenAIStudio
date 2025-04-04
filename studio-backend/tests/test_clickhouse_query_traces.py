from fastapi.testclient import TestClient
import pytest
from unittest.mock import patch
from app.main import app

@pytest.fixture
def setup_and_teardown():
    # Setup: Mock ClickHouse client
    pass

    # Teardown: No specific teardown needed for this test

def test_get_span_attributes_success(setup_and_teardown):
    test_client = TestClient(app)
    trace_id = "191c1fb1992400f8a28a4ed2cf4ea5ee"
    
    response = test_client.get(f"/span-attributes/{trace_id}")

    assert response.status_code == 200