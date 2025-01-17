import os
import zipfile
import json
import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient
from app.main import app 

from app.models.pipeline_model import PipelineFlow

@pytest.fixture
def setup_and_teardown():
     # Prepare the JSON payload with the YAML content
    test_dir = os.path.dirname(os.path.abspath(__file__))
    flowise_pipeline_file = os.path.join(test_dir, "flowise-pipeline-translator", "flowise_pipeline.json")

    with open(flowise_pipeline_file, "r") as file:
        payload = json.load(file)

    yield payload, test_dir 

    # Clean up the test zip file
    test_zip_file = os.path.join(test_dir, "docker-compose.zip")
    os.remove(test_zip_file)

def test_create_and_download_zip(setup_and_teardown):
    payload, test_dir  = setup_and_teardown

    try:
        PipelineFlow(**payload)
    except ValidationError as e:
        print("Validation Error: ", e.json(indent=4))
        assert False, "Payload validation failed"

    # Simulate a POST request to the /download-zip endpoint with the JSON payload
    client = TestClient(app)
    response = client.post("/studio-backend/download-zip", json=payload)

    # Check that the response is successful
    assert response.status_code == 200

    # Extract the filename from the Content-Disposition header
    content_disposition = response.headers.get("content-disposition")
    if content_disposition:
        filename = content_disposition.split("filename=")[-1].strip('"')


    # The response should be a zip file, so you can save it to a temporary location
    test_zip_file = os.path.join(test_dir,filename)
    with open(test_zip_file, 'wb') as f:
        f.write(response.content)

    # Now you can test that the zip file contains the expected files
    with zipfile.ZipFile(test_zip_file, 'r') as zipf:
        assert 'docker-compose/.env' in zipf.namelist()
        assert 'docker-compose/readme.MD' in zipf.namelist()
        assert 'docker-compose/compose.yaml' in zipf.namelist()
        assert 'docker-compose/project-info.json' in zipf.namelist()    