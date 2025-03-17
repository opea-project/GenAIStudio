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
        this.inMegaservice = true
        this.dependent_services = {
            'llm': {
                'engine': '',
                'modelName': '',
                'huggingFaceToken': ''
            }
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
                type: 'ChatCompletionRequest|AgentQuery'
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
                default: 'TGI',
                options: [
                    {
                        name: 'TGI',
                        label: 'TGI'
                    },
                    // {
                    //     name: 'vLLM',
                    //     label: 'vLLM',
                    // },
                    {
                        name:'OpenAI',
                        label: 'OpenAI'
                    }
                ],
            },
            {
                label: 'Model Name',
                name: 'modelName',
                type: 'string',
                default: 'meta-llama/Meta-Llama-3.1-70B-Instruct'
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
            // {
            //     label: 'Strategy',
            //     name: 'strategy',
            //     type: 'options',
            //     default: 'react_agent_llama',
            //     options: [
            //         {
            //             name: 'rag_agent',
            //             label: 'rag_agent'
            //         },
            //         {
            //             name:'rag_agent_llama',
            //             label: 'rag_agent_llama'
            //         }
            //     ],
            //     additionalParams: true
            // },
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
