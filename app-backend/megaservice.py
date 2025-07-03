# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import os
import json
import importlib
import re

# library import
from fastapi import Request
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

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
from langchain_core.prompts import PromptTemplate


category_params_map = {
    'LLM': LLMParams,
    'Agent': LLMParams,
    'Reranking': RerankerParms,
    'Retreiver': RetrieverParms,
}

HOST_IP = os.getenv("HOST_IP", "0.0.0.0")
USE_NODE_ID_AS_IP = os.getenv("USE_NODE_ID_AS_IP","").lower() == 'true'


class ChatTemplate:
    @staticmethod
    def generate_rag_prompt(question, documents):
        context_str = "\n".join(documents)
        if context_str and len(re.findall("[\u4E00-\u9FFF]", context_str)) / len(context_str) >= 0.3:
            # chinese context
            template = """
### 你将扮演一个乐于助人、尊重他人并诚实的助手，你的目标是帮助用户解答问题。有效地利用来自本地知识库的搜索结果。确保你的回答中只包含相关信息。如果你不确定问题的答案，请避免分享不准确的信息。
### 搜索结果：{context}
### 问题：{question}
### 回答：
"""
        else:
            template = """
### You are a helpful, respectful and honest assistant to help the user with questions. \
Please refer to the search results obtained from the local knowledge base. \
But be careful to not incorporate the information that you think is not relevant to the question. \
If you don't know the answer to a question, please don't share false information. \n
### Search results: {context} \n
### Question: {question} \n
### Answer:
"""
        return template.format(context=context_str, question=question)

class AppService:
    def __init__(self, host="0.0.0.0", port=8000):
        self.host = host
        self.port = port
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
        # Load environment variables from the .env file
        dotenv_path = os.path.join(os.path.dirname(__file__), 'config', '.env')
        print("dotenv_path", dotenv_path)
        if os.path.exists(dotenv_path):
            load_dotenv(dotenv_path)
        print("add_remote_service")
        for key, value in os.environ.items():
            print(f"{key}: {value}")
        templates = self.import_all_microservices_from_template()
        if 'chat_input_ids' not in self.workflow_info:
            raise Exception('chat_input_ids not found in workflow_info')
        nodes = self.workflow_info['chat_input_ids'].copy()
        self.processed_node_infos = {}
        self.services = {}
        self.megaservices = {}
        while nodes:
            # BFS traversal of the graph
            node_id = nodes.pop(0)
            node = self.workflow_info['nodes'][node_id]
            print('node', node)
            print('chat_input_ids', self.workflow_info['chat_input_ids'])
            if node.get('megaserviceClient') or node_id in self.workflow_info['chat_input_ids']:
                print('new Megaservice', node_id)
                if node_id in self.processed_node_infos:
                    # Prevent infinite loop
                    continue
                print('start new Megaservice', node_id)
                key = 'default' if node_id in self.workflow_info['chat_input_ids'] else node_id.split('@')[1]
                self.megaservices[key] = ServiceOrchestrator()
                self.megaservices[key].align_inputs = self.align_inputs
                self.megaservices[key].align_outputs = self.align_outputs
                self.megaservices[key].align_generator = self.align_generator
                node['megaservices'] = [self.megaservices[key]]

            if node['inMegaservice']:
                print('adding Node', node_id)
                microservice_name = node['name'].split('@')[1]
                service_node_ip = node_id.split('@')[1].replace('_','-') if USE_NODE_ID_AS_IP else HOST_IP
                microservice = templates[microservice_name].get_service(host_ip=service_node_ip, node_id_as_ip=USE_NODE_ID_AS_IP, port=os.getenv(f"{node_id.split('@')[1]}_port", None))
                microservice.name = node_id
                self.services[node_id] = microservice
                

                megaservices = []
                for prev_node in node['connected_from']:
                    if prev_node in self.processed_node_infos:
                        for megaservice in self.processed_node_infos[prev_node]['megaservices']:
                            megaservices.append(megaservice)
                            megaservice.add(microservice)
                            if prev_node in self.services:
                                megaservice.flow_to(self.services[prev_node], microservice)
                node['megaservices'] = megaservices
    
            for next_node in node['connected_to']:
                nodes.append(next_node)
            self.processed_node_infos[node_id] = node
            # print("processed_node_infos", self.processed_node_infos)
        print('\n\n\n', '-'*20, 'self.services', self.services)
        print('\n\n\n', '-'*20, 'self.megaservices', self.megaservices)
        print('\n\n\n', '-'*20, 'self.processed_node_infos', self.processed_node_infos)
 
    
    def align_inputs(self, inputs, *args, **kwargs):
        """Override this method in megaservice definition."""
        print('\n'*2,'align_inputs')
        node_id = args[0]
        llm_parameters_dict = args[2]
        print('node_id', node_id)
        params = kwargs.get('params', {})
        print('original_inputs', inputs)
        print('-'*20)
        # print('params', params)
        if node_id in params:
            try:
                new_input = params[node_id]
                inputs.update(new_input)
            except Exception as e:
                print('unable to parse input', e)
        if self.services[node_id].service_type == ServiceType.EMBEDDING:
            inputs["input"] = inputs["text"]
            inputs["inputs"] = inputs["text"]
            del inputs["text"]
        elif self.services[node_id].service_type == ServiceType.RETRIEVER:
            # prepare the retriever params
            retriever_parameters = kwargs.get("retriever_parameters", None)
            if retriever_parameters:
                inputs.update(retriever_parameters.dict())
        elif self.services[node_id].service_type == ServiceType.LLM:
            # convert TGI/vLLM to unified OpenAI /v1/chat/completions format
            next_inputs = {}
            next_inputs["model"] = inputs.get("model") or "NA"
            if inputs.get("inputs"):
                next_inputs["messages"] = [{"role": "user", "content": inputs["inputs"]}]
            elif inputs.get("query") and inputs.get("documents"):
                # for rag case
                next_inputs["query"] = inputs["query"]
                next_inputs["documents"] = inputs.get("documents",[])
            else:
                # simple llm case
                next_inputs["messages"] = [{"role": "user", "content": next(value for key in ["query", "text", "input", "inputs"] if (value := inputs.get(key)))}]
            next_inputs["max_tokens"] = llm_parameters_dict["max_tokens"]
            next_inputs["top_p"] = llm_parameters_dict["top_p"]
            next_inputs["stream"] = inputs["stream"]
            next_inputs["frequency_penalty"] = inputs["frequency_penalty"]
            # next_inputs["presence_penalty"] = inputs["presence_penalty"]
            # next_inputs["repetition_penalty"] = inputs["repetition_penalty"]
            next_inputs["temperature"] = inputs["temperature"]
            inputs = next_inputs
        print('final_inputs', inputs)
        print('-'*20)
        return inputs
    
    def align_outputs(self, data, cur_node, inputs, runtime_graph, llm_parameters_dict, **kwargs):
        print('\n'*2,'align_outputs')
        print('cur_node', cur_node)
        print('data', data)
        print('-'*20)
        print('inputs', inputs)
        print('-'*20)
        next_data = {}
        if self.services[cur_node].service_type == ServiceType.EMBEDDING:
            # assert isinstance(data, dict)
            next_data = {"text": inputs["inputs"], "embedding": data['data'][0]['embedding']}
        elif self.services[cur_node].service_type == ServiceType.RETRIEVER:

            docs = [doc["text"] for doc in data["retrieved_docs"]]

            with_rerank = runtime_graph.downstream(cur_node)[0].startswith("opea_service@rerank")
            if with_rerank and docs:
                print("Rerank with docs")
                # forward to rerank
                # prepare inputs for rerank
                next_data["initial_query"] = data["initial_query"]
                next_data["texts"] = [doc["text"] for doc in data["retrieved_docs"]]
                next_data["retrieved_docs"] = data["retrieved_docs"]
            else:
                print("No rerank")
                # forward to llm
                if not docs and with_rerank:
                    # delete the rerank from retriever -> rerank -> llm
                    for ds in reversed(runtime_graph.downstream(cur_node)):
                        for nds in runtime_graph.downstream(ds):
                            runtime_graph.add_edge(cur_node, nds)
                        runtime_graph.delete_node_if_exists(ds)

                # handle template
                # if user provides template, then format the prompt with it
                # otherwise, use the default template
                prompt = data["initial_query"]
                chat_template = llm_parameters_dict["chat_template"]
                if chat_template:
                    prompt_template = PromptTemplate.from_template(chat_template)
                    input_variables = prompt_template.input_variables
                    if sorted(input_variables) == ["context", "question"]:
                        prompt = prompt_template.format(question=data["initial_query"], context="\n".join(docs))
                    elif input_variables == ["question"]:
                        prompt = prompt_template.format(question=data["initial_query"])
                    else:
                        print(f"{prompt_template} not used, we only support 2 input variables ['question', 'context']")
                        prompt = ChatTemplate.generate_rag_prompt(data["initial_query"], docs)
                else:
                    prompt = ChatTemplate.generate_rag_prompt(data["initial_query"], docs)

                next_data["inputs"] = prompt
            
        elif self.services[cur_node].service_type == ServiceType.RERANK:
            # rerank the inputs with the scores
            # reranker_parameters = kwargs.get("reranker_parameters", None)
            # top_n = reranker_parameters.top_n if reranker_parameters else 1
            # docs = inputs["texts"]
            # reranked_docs = []
            # for best_response in data['documents'][:top_n]:
            #     reranked_docs.append(docs[best_response["index"]])

            # # handle template
            # # if user provides template, then format the prompt with it
            # # otherwise, use the default template
            # prompt = inputs["query"]
            # chat_template = llm_parameters_dict["chat_template"]
            # if chat_template:
            #     prompt_template = PromptTemplate.from_template(chat_template)
            #     input_variables = prompt_template.input_variables
            #     if sorted(input_variables) == ["context", "question"]:
            #         prompt = prompt_template.format(question=prompt, context="\n".join(reranked_docs))
            #     elif input_variables == ["question"]:
            #         prompt = prompt_template.format(question=prompt)
            #     else:
            #         print(f"{prompt_template} not used, we only support 2 input variables ['question', 'context']")
            #         prompt = ChatTemplate.generate_rag_prompt(prompt, reranked_docs)
            # else:
            #     prompt = ChatTemplate.generate_rag_prompt(prompt, reranked_docs)

            # next_data["inputs"] = prompt
            next_data = data

        elif self.services[cur_node].service_type == ServiceType.LLM and not llm_parameters_dict["stream"]:
            next_data["text"] = data["choices"][0]["message"]["content"]
        else:
            next_data = data
            
        print('next_data', next_data)
        print('-'*20)
        return next_data
    
    def align_generator(self, gen, **kwargs):
        print('\n'*2,'align_generator')
        
        buffer = ""
        for line in gen:
            print('line before decode', line)
            line = line.decode("utf-8")
            print('line', line)
            start = line.find("{")
            end = line.rfind("}") + 1

            json_str = line[start:end]
            try:
                json_data = json.loads(json_str)
                if json_data["choices"][0]["finish_reason"] != "eos_token":
                    choice = json_data["choices"][0]
                    if "delta" in choice and "content" in choice["delta"]:
                        buffer += choice["delta"]["content"]
                    elif "text" in choice:
                        buffer += choice["text"]
                    buffer = buffer.replace("\\n", "\n")
                    print("buffer", buffer)
                    
                    words = buffer.split()
                    if len(words) > 1:
                        output_word = words[0] + ' '
                        yield f"data: {output_word}\n\n"
                        buffer = " ".join(words[1:])
                    else:
                        buffer = words[0] if words else ""
            except Exception as e:
                yield f"data: {json_str}\n\n"
        if buffer:
            yield f"data: {buffer}\n\n"
        yield "data: [DONE]\n\n"

    
    
    async def handle_request(self, request: Request, megaservice):
        data = await request.json()
        print('\n'*5, '====== handle_request ======\n', data)
        if 'chat_completion_ids' in self.workflow_info:
            prompt = handle_message(data.get("messages") or data.get("query") or data.get("text") or data.get("input") or data.get("inputs"))
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
                        elif key in node['params']:
                            params_dict[key] = node['params'][key]
                    params[id] = params_dict
                if node['category'] in ('LLM', 'Agent'):
                    params[id]['max_new_tokens'] = params[id].get('max_tokens', 500)
                    llm_parameters = LLMParams(**params[id])
            result_dict, runtime_graph = await megaservice.schedule(
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
            last_node_info = self.workflow_info['nodes'][last_node]
            if last_node_info['category'] in ('LLM', 'Agent'):
                # handle the llm response
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
            else:
                # handle the non-llm response
                return result_dict[last_node]

    def create_handle_request(self, megaservice):
        async def handle_request_wrapper(request: Request):
            return await self.handle_request(request, megaservice)
        return handle_request_wrapper
    
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
        
        for key, megaservice in self.megaservices.items():
            handle_request_wrapper = self.create_handle_request(megaservice)
            self.service.add_route(self.endpoint if key == 'default' else f'{self.endpoint}/{key}', handle_request_wrapper, methods=["POST"])
        self.service.start()

if __name__ == "__main__":
    print('pre initialize appService')
    app = AppService(host="0.0.0.0", port=8899)
    print('after initialize appService')
    app.add_remote_service()
    print('after add_remote_service')
    
    app.start()