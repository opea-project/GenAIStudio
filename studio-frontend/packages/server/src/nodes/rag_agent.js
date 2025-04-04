'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
class OPEARedisRetreiver {
    constructor() {
        this.label = 'Rag Agent'
        this.name = 'opea_service@rag_agent'
        this.version = 1.0
        this.type = 'AgentTask'
        this.icon = 'opea-icon-color.svg'
        this.category = 'Agent'
        this.description = 'RAG Agent built on Langchain/Langgraph framework'
        this.baseClasses = [this.type, 'ChatCompletionRequest']
        this.tags = ['OPEA']
        this.inMegaservice = false
        this.megaserviceClient = true
        this.dependent_services = {
            'tgi': {
                'modelName': '',
                'huggingFaceToken': ''
            },
            // 'vllm': {
            //     'modelName': '',
            //     'huggingFaceToken': '',
            //     'gaudi': ''
            // }
        }
        this.outputs = [
            {
                label: 'Retrieval Request',
                name: 'retrivalRequest',
                type: 'ChatCompletionRequest',
                isAnchor: true
            },
            {
                label: 'ChatCompletionRequest',
                name: 'ChatCompletionRequest',
                type: 'ChatCompletionRequest',
                isAnchor: true
            }
        ]
        this.inputs = [
            {
                label: 'Search Query',
                name: 'query',
                type: 'ChatCompletionRequest|RagAgent'
            },
            {
                label: 'Retrieval Response',
                name: 'retrievalResponse',
                type: 'SearchedDoc|RetrievalResponse|ChatCompletionRequest'
            },
            {
                label: 'LLM Engine',
                name: 'llmEngine',
                type: 'options',
                default: 'tgi',
                options: [
                    {
                        name: 'tgi',
                        label: 'TGI'
                    },
                    // {
                    //     name: 'vllm',
                    //     label: 'vLLM',
                    // },
                    {
                        name:'openai',
                        label: 'OpenAI'
                    }
                ],
            },
            {
                label: 'Model Name',
                name: 'modelName',
                type: 'string',
                default: 'Intel/neural-chat-7b-v3-3'
            },
            {
                label: 'HuggingFace Token',
                name: 'huggingFaceToken',
                type: 'password',
                optional: true,
            },
            {
                label: 'OpenAI API Key',
                name: 'openaiApiKey',
                type: 'password',
                optional: true,
            },
            {
                label: 'Strategy',
                name: 'strategy',
                type: 'options',
                default: 'rag_agent_llama',
                options: [
                    {
                        name: 'rag_agent',
                        label: 'rag_agent'
                    },
                    {
                        name:'rag_agent_llama',
                        label: 'rag_agent_llama'
                    }
                ],
                additionalParams: true
            },
            {
                label: 'Temperature',
                name: 'temperature',
                type: 'number',
                default: 0.1,
                additionalParams: true,
            },
            {
                label: 'Max New Token',
                name: 'maxNewToken',
                type: 'number',
                default: 8192,
                additionalParams: true,
            },
            {
                label: 'Recursion Limit',
                name: 'recursionLimit',
                type: 'number',
                default: 10,
                additionalParams: true
            }
        ]
    }
}

module.exports = { nodeClass: OPEARedisRetreiver }
