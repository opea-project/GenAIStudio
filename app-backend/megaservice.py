# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import os
import json
import importlib

# library import
from fastapi import Request
from fastapi.responses import StreamingResponse

# comps import
from comps import MicroService, ServiceOrchestrator, ServiceRoleType, ServiceType
from comps.cores.mega.utils import handle_message
from comps.cores.proto.api_protocol import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatCompletionResponseChoice,
    ChatMessage,
    UsageInfo,
)
from comps.cores.proto.docarray import LLMParams, RerankerParms, RetrieverParms

category_params_map = {
    'LLM': LLMParams,
    'Reranking': RerankerParms,
    'Retreiver': RetrieverParms,
}

HOST_IP = os.getenv("HOST_IP", "0.0.0.0")
USE_NODE_ID_AS_IP = os.getenv("USE_NODE_ID_AS_IP","").lower() == 'true'

class AppService:
    def __init__(self, host="0.0.0.0", port=8000):
        self.host = host
        self.port = port
        self.megaservice = ServiceOrchestrator()
        self.megaservice.align_inputs = self.align_inputs
        self.endpoint = "/v1/app-backend"
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
    
    async def handle_request(self, request: Request):
        data = await request.json()
        print('\n'*5, '====== handle_request ======\n', data)
        if 'chat_completion_ids' in self.workflow_info:
            prompt = handle_message(data['messages'])
            params = {}
            llm_parameters = None
            for id, node in self.workflow_info['nodes'].items():
                if node['category'] in category_params_map:
                    param_class = category_params_map[node['category']]()
                    param_keys = [key for key in dir(param_class) if not key.startswith('__') and not callable(getattr(param_class, key))]
                    print('param_keys', param_keys)
                    params_dict = {}
                    for key in param_keys:
                        if key in data:
                            params_dict[key] = data[key]
                            # hadle special case for stream and streaming
                            if key in ['stream', 'streaming']:
                                params_dict[key] = data.get('stream', True) and data.get('streaming', True)
                        elif key in node['inference_params']:
                            params_dict[key] = node['inference_params'][key]
                    params[id] = params_dict
                if node['category'] == 'LLM':
                    params[id]['max_new_tokens'] = params[id]['max_tokens']
                    llm_parameters = LLMParams(**params[id])
            result_dict, runtime_graph = await self.megaservice.schedule(
                initial_inputs={'query':prompt, 'text': prompt},
                llm_parameters=llm_parameters,
                params=params,
            )
            print('runtime_graph', runtime_graph.graph)
            for node, response in result_dict.items():
                if isinstance(response, StreamingResponse):
                    return response
            last_node = runtime_graph.all_leaves()[-1]
            print('result_dict:', result_dict)
            print('last_node:',last_node)
            response = result_dict[last_node]['text']
            choices = []
            usage = UsageInfo()
            choices.append(
                ChatCompletionResponseChoice(
                    index=0,
                    message=ChatMessage(role='assistant', content=response),
                    finish_reason='stop',
                )
            )
            return ChatCompletionResponse(model='custom_app', choices=choices, usage=usage)

    def start(self):

        self.service = MicroService(
            self.__class__.__name__,
            service_role=ServiceRoleType.MEGASERVICE,
            host=self.host,
            port=self.port,
            endpoint=self.endpoint,
            input_datatype=ChatCompletionRequest,
            output_datatype=ChatCompletionResponse,
        )

        self.service.add_route(self.endpoint, self.handle_request, methods=["POST"])
        self.service.start()

if __name__ == "__main__":
    print('pre initialize appService')
    app = AppService(host=HOST_IP, port=8888)
    print('after initialize appService')
    app.add_remote_service()
    app.start()