# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import os
import json
import logging

# library import
from fastapi import Request
from fastapi.responses import StreamingResponse

# comps import
from comps import Gateway, MicroService, ServiceOrchestrator, ServiceType
from comps.cores.proto.api_protocol import (
    AudioChatCompletionRequest,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatCompletionResponseChoice,
    ChatMessage,
    EmbeddingRequest,
    UsageInfo
)
from comps.cores.proto.docarray import LLMParams, LLMParamsDoc, RerankedDoc, RerankerParms, RetrieverParms, TextDoc

category_params_map = {
    'LLM': LLMParams,
    'Reranking': RerankerParms,
    'Retreiver': RetrieverParms,
}

class AppGateway(Gateway):
    def __init__(self, megaservice, host='0.0.0.0', port=8888):
        try: 
            with open('config/workflow-info.json', 'r') as f:
                self.workflow_info = json.load(f)
        except:
            logging.error('Failed to load workflow-info.json')
        super().__init__(
            megaservice, host, port, '/v1/app-backend', ChatCompletionRequest, ChatCompletionResponse
        )

    async def handle_request(self, request: Request):
        data = await request.json()
        print('\n'*5, '====== handle_request ======\n', data)
        if 'chat_completion_ids' in self.workflow_info:
            prompt = self._handle_message(data['messages'])
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