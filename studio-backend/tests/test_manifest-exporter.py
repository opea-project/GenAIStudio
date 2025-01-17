# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import os
import yaml
import pytest
import json

from app.services.exporter_service import convert_proj_info_to_manifest

@pytest.fixture
def setup_and_teardown():
    test_dir = os.path.dirname(os.path.abspath(__file__))
    # Paths for the `mega.yaml` and output file
    proj_info_file = os.path.join(test_dir, "flowise-pipeline-translator", "project-info.json")
    output_file = os.path.join(test_dir, "exporter-groundtruth", "app-manifest.yaml")
    gt_file = os.path.join(test_dir, "exporter-groundtruth", "gt_app-manifest.yaml")
    gt_nginx_file = os.path.join(test_dir, "exporter-groundtruth", "gt_app-manifest-with-nginx.yaml")    

    yield proj_info_file, output_file, gt_file, gt_nginx_file

    if os.path.isfile(output_file):
        os.unlink(output_file)    

def test_convert_chatqna_proj_info_to_manifest_obj(setup_and_teardown):
    proj_info_file, _, gt_file, _ = setup_and_teardown

    with open(proj_info_file, "r") as file:
        proj_info = json.load(file)

    # Call the function directly
    output_manifest = convert_proj_info_to_manifest(proj_info)
    
    # Function to create a set of unique identifiers for the documents
    def create_identifiers_set(documents):
        identifiers = set()
        for doc in documents:
            if 'metadata' in doc and 'name' in doc['metadata']:
                identifiers.add((doc['kind'], doc['metadata']['name']))
        return identifiers
    
    manifest_dict = yaml.safe_load_all(output_manifest)
    output_identifiers = create_identifiers_set(manifest_dict)

    # Load the documents from the gt manifest
    with open(gt_file, 'r') as f:
        gt_manifest_docs = list(yaml.safe_load_all(f))
    gt_identifiers = create_identifiers_set(gt_manifest_docs)

    # Check if all identifiers in the output manifest are present in the gt manifest
    assert output_identifiers.issubset(gt_identifiers), (
        "The output manifest is missing some resources present in the ground truth manifest."
    )

def test_convert_chatqna_proj_info_to_manifest_file(setup_and_teardown):
    proj_info_file, output_file, _, gt_nginx_file = setup_and_teardown

    with open(proj_info_file, "r") as file:
        proj_info = json.load(file)

    # Call the function directly
    convert_proj_info_to_manifest(proj_info, output_file)
    
    # Function to create a set of unique identifiers for the documents
    def create_identifiers_set(documents):
        identifiers = set()
        for doc in documents:
            if 'metadata' in doc and 'name' in doc['metadata']:
                identifiers.add((doc['kind'], doc['metadata']['name']))
        return identifiers

    # Load the documents from the generated manifest
    with open(output_file, "r") as f:
        output_manifest_docs = list(yaml.safe_load_all(f))
    output_identifiers = create_identifiers_set(output_manifest_docs)

    # Load the documents from the gt manifest
    with open(gt_nginx_file, 'r') as f:
        gt_manifest_docs = list(yaml.safe_load_all(f))
    gt_identifiers = create_identifiers_set(gt_manifest_docs)

    # Check if all identifiers in the output manifest are present in the gt manifest
    assert output_identifiers.issubset(gt_identifiers), (
        "The output manifest is missing some resources present in the ground truth manifest."
    )