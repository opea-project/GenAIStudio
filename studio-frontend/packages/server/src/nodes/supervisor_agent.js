'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
class OPEARedisRetreiver {
    constructor() {
        this.label = 'Supervisor Agent'
        this.name = 'opea_service@supervisor_agent'
        this.version = 1.0
        this.type = 'Agent'
        this.icon = 'opea-icon-color.svg'
        this.category = 'Agent'
        this.description = 'ReAct Supervisor Agent built on Langchain/Langgraph framework'
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
                label: 'AgentQuery',
                name: 'AgentQuery',
                type: 'AgentQuery',
                isAnchor: true
            }, 
            {
                label: 'ChatCompletionRequest',
                name: 'ChatCompletionRequest',
                type: 'ChatCompletion',
                isAnchor: true
            }
        ]       
        this.inputs = [
            {
                label: 'Search Query',
                name: 'query',
                type: 'ChatCompletionRequest'
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
            //     default: 'react_llama',
            //     options: [
            //         {
            //             name: 'react_langchain',
            //             label: 'react_langchain'
            //         },
            //         // {
            //         //     name: 'react_langgrapgh',
            //         //     label: 'react_langgraph',
            //         // },
            //         {
            //             name:'react_llama',
            //             label: 'react_llama'
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
