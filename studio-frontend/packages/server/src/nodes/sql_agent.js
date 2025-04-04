'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
class OPEARedisRetreiver {
    constructor() {
        this.label = 'SQL Agent'
        this.name = 'opea_service@sql_agent'
        this.version = 1.0
        this.type = 'AgentTask'
        this.icon = 'opea-icon-color.svg'
        this.category = 'Agent'
        this.description = 'Agent specifically designed and optimized for answering questions aabout data in SQL databases.'
        this.baseClasses = [this.type, 'ChatCompletionRequest']
        this.tags = ['OPEA']
        this.inMegaservice = false
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
                type: 'ChatCompletionRequest|SqlAgent'
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
                label: 'Database Path/URI',
                name: 'db_path',
                type: 'string',
                placeholder: 'mysql://user:password@localhost:3306/mydatabase'
            },
            {
                label: 'Database Name',
                name: 'db_name',
                type: 'string',
                optional: true
            },
            {
                label: 'Strategy',
                name: 'strategy',
                type: 'options',
                default: 'sql_agent_llama',
                options: [
                    {
                        name: 'sql_agent',
                        label: 'sql_agent'
                    },
                    {
                        name:'sql_agent_llama',
                        label: 'sql_agent_llama'
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
