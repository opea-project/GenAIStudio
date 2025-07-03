import json

import pytest
from app.main import app
from fastapi.testclient import TestClient
from kubernetes import client as k8s_client
from kubernetes import config
from kubernetes.client.rest import ApiException
from pydantic import ValidationError


@pytest.fixture
def setup_and_teardown():
    pass

    # No specific setup teardown needed for this test

def test_get_pod_logs(setup_and_teardown):
    test_client = TestClient(app)
    namespace = "xxx"
    pod_name = "xxx"
    
    response = test_client.get(f"/studio-backend/podlogs/{namespace}")
    # response = test_client.get(f"/studio-backend/podlogs/{namespace}/{pod_name}")

    # Print the response status code and body
    print("Status Code:", response.status_code)
    try:
        print("Response JSON:", json.dumps(response.json(), indent=4))
    except Exception:
        print("Response Text:", response.text)

    print(response)
    assert response.status_code == 200