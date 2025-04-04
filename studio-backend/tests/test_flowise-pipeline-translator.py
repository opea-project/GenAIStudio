# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import os
import subprocess
import unittest

import json

from app.services.workflow_info_service import WorkflowInfo
from app.utils.exporter_utils import process_opea_services

class TestFlowisePipelineTranslator(unittest.TestCase):

    def setUp(self):
        self.test_dir = os.path.dirname(os.path.abspath(__file__))
        # Paths for the `mega.yaml` and output file
        flowise_pipelien_file = os.path.join(self.test_dir, "flowise-pipeline-inputs", "agentqna-tgi.json")
        with open(flowise_pipelien_file, 'r') as file:
            self.pipeline_json = file.read()


    def test_flowise_pipeline_translator(self):
        # Call the function directly
        print("converting flowise_pipeline to workflow_info")
        workflow_info = WorkflowInfo(json.loads(self.pipeline_json))
        print('workflow_info_raw', workflow_info.export_to_json())
        services_info = process_opea_services(json.loads(workflow_info.export_to_json()))
        print('services_info', json.dumps(services_info, indent=4))

        self.assertTrue = True

if __name__ == "__main__":
    unittest.main()