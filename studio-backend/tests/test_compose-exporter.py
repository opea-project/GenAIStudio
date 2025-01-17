# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import os
import pytest
import yaml
import json
from app.services.exporter_service import convert_proj_info_to_compose

@pytest.fixture
def setup_and_teardown():
    test_dir = os.path.dirname(os.path.abspath(__file__))
    # Paths for the `mega.yaml` and output file
    proj_info_file = os.path.join(test_dir, "flowise-pipeline-translator", "project-info.json")
    output_file = os.path.join(test_dir, "exporter-groundtruth", "app-compose.yaml")
    gt_file = os.path.join(test_dir, "exporter-groundtruth", "gt_app-compose.yaml")

    yield proj_info_file, output_file, gt_file

    if os.path.isfile(output_file):
        os.unlink(output_file)    

def test_convert_chatqna_proj_info_to_compose_obj(setup_and_teardown):
    proj_info_file, _, gt_file = setup_and_teardown

    with open(proj_info_file, "r") as file:
        proj_info = json.load(file)

    # Call the function directly
    output_compose = convert_proj_info_to_compose(proj_info)
    
    # Function to create a set of unique identifiers for the documents
    def create_identifiers_set(compose_yaml):
        identifiers = set()
        for service_name, _ in compose_yaml.get('services', {}).items():
            # print(f"{service_name}\n")
            identifiers.add(service_name)
        return identifiers

    compose_dict = yaml.safe_load(output_compose)
    output_identifiers = create_identifiers_set(compose_dict)

    # Load the documents from the gt compose
    with open(gt_file, 'r') as f:
        gt_compose_docs = yaml.safe_load(f)
    gt_identifiers = create_identifiers_set(gt_compose_docs)

    # Check if all identifiers in the output compose are present in the gt compose
    assert output_identifiers.issubset(gt_identifiers), (
        "The output compose is missing some resources present in the ground truth compose."
    )

def test_convert_chatqna_proj_info_to_compose_file(setup_and_teardown):
    proj_info_file, output_file, gt_file = setup_and_teardown

    with open(proj_info_file, "r") as file:
        proj_info = json.load(file)

    # Call the function directly
    convert_proj_info_to_compose(proj_info, output_file)
    
    # Function to create a set of unique identifiers for the documents
    def create_identifiers_set(compose_yaml):
        identifiers = set()
        for service_name, _ in compose_yaml.get('services', {}).items():
            # print(f"{service_name}\n")
            identifiers.add(service_name)
        return identifiers

    # Load the documents from the generated compose
    with open(output_file, "r") as f:
        output_compose_docs = yaml.safe_load(f)
    output_identifiers = create_identifiers_set(output_compose_docs)

    # Load the documents from the gt compose
    with open(gt_file, 'r') as f:
        gt_compose_docs = yaml.safe_load(f)
    gt_identifiers = create_identifiers_set(gt_compose_docs)

    # Check if all identifiers in the output compose are present in the gt compose
    assert output_identifiers.issubset(gt_identifiers), (
        "The output compose is missing some resources present in the ground truth compose."
    )