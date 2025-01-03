# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import os
import json
import importlib

# library import

# comps import
from comps import  MicroService, ServiceOrchestrator, ServiceType
from app_gateway import AppGateway

HOST_IP = os.getenv("HOST_IP", "0,0,0,0")
USE_NODE_ID_AS_IP = os.getenv("USE_NODE_ID_AS_IP","").lower() == 'true'

class AppService:
    def __init__(self, host="0.0.0.0", port=8000):
        self.host = host
        self.port = port
        self.megaservice = ServiceOrchestrator()
        with open('config/workflow-info.json', 'r') as f:
            self.workflow_info = json.load(f)
        
    def import_all_microservices_from_template(self):
        template_dir = os.path.join(os.path.dirname(__file__), 'templates', 'microservices')
        modules = {}
        for filename in os.listdir(template_dir):
            if filename.endswith('.py') and filename != '__init__.py':
                module_name = filename[:-3]  # Remove the .py extension
                module_path = f'templates.microservices.{module_name}'
                modules[module_name] = importlib.import_module(module_path)
        return modules

    def add_remote_service(self):
        print("add_remote_service")
        templates = self.import_all_microservices_from_template()
        if 'chat_input_ids' not in self.workflow_info:
            raise Exception('chat_input_ids not found in workflow_info')
        nodes = self.workflow_info['chat_input_ids']
        services = {}
        while nodes:
            node_id = nodes.pop(0)
            node = self.workflow_info['nodes'][node_id]
            print('node', node)
            if node['inMegaservice']:
                print('adding Node', node_id)
                microservice_name = node['name'].split('@')[1]
                service_node_ip = node_id.split('@')[1].replace('_','-') if USE_NODE_ID_AS_IP else HOST_IP
                microservice = templates[microservice_name].get_service(host_ip=service_node_ip, node_id_as_ip=USE_NODE_ID_AS_IP)
                microservice.name = node_id
                self.megaservice.add(microservice)
                services[node_id] = microservice
                for prev_node in node['connected_from']:
                    if prev_node in services:
                        self.megaservice.flow_to(services[prev_node], microservice)
            for next_node in node['connected_to']:
                nodes.append(next_node)
        self.megaservice.align_inputs = self.align_inputs
        self.gateway = AppGateway(megaservice=self.megaservice, host="0.0.0.0", port=self.port)
    def align_inputs(self, inputs, *args, **kwargs):
        """Override this method in megaservice definition."""
        print('\n'*2,'align_inputs')
        node_id = args[0]
        # print('node_id', node_id)
        params = kwargs.get('params', {})
        # print('params', params)
        if node_id in params:
            try:
                new_input = params[node_id]
                inputs.update(new_input)
                print('inputs', inputs)
            except Exception as e:
                print('unable to parse input', e)
        return inputs


if __name__ == "__main__":
    megaservice_host_ip = None if USE_NODE_ID_AS_IP else HOST_IP
    chatqna = AppService(host=HOST_IP, port=8888)
    print('after initialize appService')
    chatqna.add_remote_service()