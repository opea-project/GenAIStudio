from fastapi.testclient import TestClient
from pydantic import ValidationError
from kubernetes import client as k8s_client, config
from kubernetes.client.rest import ApiException
from app.main import app
import os
import json
import pytest
import time

from app.models.pipeline_model import PipelineFlow
from app.services.dashboard_service import delete_dashboard
 
@pytest.fixture
def setup_and_teardown():
     # Prepare the JSON payload with the YAML content
    test_dir = os.path.dirname(os.path.abspath(__file__))
    flowise_pipeline_file = os.path.join(test_dir, "flowise-pipeline-inputs", "agentqna-tgi.json")

    with open(flowise_pipeline_file, "r") as file:
        payload = json.load(file)
    namespace_name = f"sandbox-{payload['id']}"

    # config.load_kube_config()
    core_v1_api = k8s_client.CoreV1Api()
    apps_v1_api = k8s_client.AppsV1Api()

    yield payload, namespace_name, core_v1_api, apps_v1_api

    # Delete the dashboard
    delete_dashboard(namespace_name)
    
    # Delete the namespace
    try:
        core_v1_api.delete_namespace(name=namespace_name, body=k8s_client.V1DeleteOptions())
        print(f"Namespace '{namespace_name}' deletion initiated successfully.")
        
        # Wait for the namespace to be deleted
        while True:
            try:
                core_v1_api.read_namespace(name=namespace_name)
            except k8s_client.exceptions.ApiException as e:
                if e.status == 404:
                    print(f"Namespace '{namespace_name}' deleted successfully.")
                    break
                else:
                    print(f"Exception when checking namespace deletion: {e}")
                    raise
    except k8s_client.exceptions.ApiException as e:
        print(f"Exception when deleting namespace: {e}")

def test_deploy_sandbox_api(setup_and_teardown):
    payload, namespace_name, core_v1_api, apps_v1_api = setup_and_teardown

    try:
        PipelineFlow(**payload)
    except ValidationError as e:
        print("Validation Error: ", e.json(indent=4))
        assert False, "Payload validation failed"
   
   # Simulate a POST request to the /deploy-sandbox endpoint with the JSON payload
    test_client = TestClient(app)
    response = test_client.post("/studio-backend/deploy-sandbox", content=json.dumps(payload))
    time.sleep(6000)

    # Check that the response is successful
    assert response.status_code == 200

    # Assert that the namespace has been created
    # config.load_kube_config()
    # v1 = k8s_client.CoreV1Api()
    try:
        ns = core_v1_api.read_namespace(name=namespace_name)
        assert ns is not None
        assert ns.metadata.name == namespace_name
    except ApiException as e:
        pytest.fail(f"Namespace {namespace_name} was not created: {e}")

    # Assert that the deployment has been created in the namespace
    deployment_name = "app-backend"
    try:
        deployment = apps_v1_api.read_namespaced_deployment(name=deployment_name, namespace=namespace_name)
        assert deployment is not None
        assert deployment.metadata.name == deployment_name
    except ApiException as e:
        pytest.fail(f"Deployment {deployment_name} was not found in namespace {namespace_name}: {e}")