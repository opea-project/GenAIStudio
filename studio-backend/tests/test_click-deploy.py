# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import os
import yaml
from pydantic import ValidationError
import pytest
import json

from app.models.pipeline_model import PipelineFlow
from app.services.clickdeploy_service import upload_pipeline_zip

@pytest.fixture
def setup_and_teardown():
    # Prepare the JSON payload with the YAML content
    test_dir = os.path.dirname(os.path.abspath(__file__))
    flowise_pipeline_file = os.path.join(test_dir, "flowise-pipeline-inputs", "agentqna-tgi.json")

    with open(flowise_pipeline_file, "r") as file:
        payload = json.load(file)

    remote_host = "xxx"
    remote_user = "xxx"

    yield remote_host, remote_user, payload

    # No specific setup teardown needed for this test
def test_click_deploy(setup_and_teardown):

    remote_host, remote_user, payload = setup_and_teardown

    try:
        PipelineFlow(**payload)
    except ValidationError as e:
        print("Validation Error: ", e.json(indent=4))
        assert False, "Payload validation failed"

    try:
        response = upload_pipeline_zip(remote_host, remote_user, payload)
        print("Response from upload_pipeline_zip:\n" + json.dumps(response, indent=2, ensure_ascii=False))
    except Exception as e:
        assert False, f"upload_pipeline_zip failed with exception: {e}"

    assert True, "upload_pipeline_zip executed successfully"