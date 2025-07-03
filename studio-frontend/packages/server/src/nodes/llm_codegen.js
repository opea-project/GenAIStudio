'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
class OPEA_LLM_CODEGEN {
    constructor() {
        //@ts-ignore
        // this.loadMethods = {
        //     async listModels() {
        //         return await (0, modelLoader_1.getModels)(modelLoader_1.MODEL_TYPE.EMBEDDING, 'openAIEmbedding_LlamaIndex');
        //     }
        // };
        this.label = 'LLM Code Generation'
        this.name = 'opea_service@codegen'
        this.version = 1.0
        this.type = 'GeneratedDoc'
        this.icon = 'assets/llm.png'
        this.category = 'LLM'
        this.description = 'LLM Code Generation Inference'
        this.baseClasses = [this.type, 'StreamingResponse']
        this.tags = ['OPEA']
        this.inMegaservice = true
        this.dependent_services = {
            'tgi': {
                'modelName': '',
                'huggingFaceToken': ''
            }
        }
        this.inputs = [
            {
                label: 'LLM Params Document',
                name: 'text',
                type: 'LLMParamsDoc|DocSumChatCompletionRequest'
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
                label: 'Maximum Tokens',
                name: 'max_tokens',
                type: 'number',
                default: 17,
                optional: true,
                additionalParams: true
            },
            {
                label: 'Top K',
                name: 'top_k',
                type: 'number',
                default: 10,
                optional: true,
                additionalParams: true
            },
            {
                label: 'Top P',
                name: 'top_p',
                type: 'number',
                default: 0.95,
                optional: true,
                additionalParams: true
            },
            {
                label: 'Typical P',
                name: 'typical_p',
                type: 'number',
                default: 0.95,
                optional: true,
                additionalParams: true
            },
            {
                label: 'Temperature',
                name: 'temperature',
                type: 'number',
                default: 0.01,
                optional: true,
                additionalParams: true
            },
            {
                label: 'Presence Penalty',
                name: 'presence_penalty',
                type: 'number',
                default: 1.03,
                optional: true,
                additionalParams: true
            },
            {
                label: 'Frequency Penalty',
                name: 'frequency_penalty',
                type: 'number',
                default: 0.0,
                optional: true,
                additionalParams: true
            },
            {
                label: 'Streaming',
                name: 'streaming',
                type: 'boolean',
                default: true,
                optional: true,
                additionalParams: true
            },
            {
                label: 'Chat Template',
                name: 'chat_template',
                type: 'string',
                rows: true,
                default:
                    '### You are a helpful, respectful and honest assistant to help the user with questions.\n### Context: {context}\n### Question: {question}\n### Answer:',
                optional: true,
                additionalParams: true
            }
        ]
    }
    async init(nodeData, _, options) {
        return null
        // const timeout = nodeData.inputs?.timeout;
        // const modelName = nodeData.inputs?.modelName;
        // const basePath = nodeData.inputs?.basepath;
        // const credentialData = await (0, utils_1.getCredentialData)(nodeData.credential ?? '', options);
        // const openAIApiKey = (0, utils_1.getCredentialParam)('openAIApiKey', credentialData, nodeData);
        // const obj = {
        //     apiKey: openAIApiKey,
        //     model: modelName
        // };
        // if (timeout)
        //     obj.timeout = parseInt(timeout, 10);
        // if (basePath) {
        //     obj.additionalSessionOptions = {
        //         baseURL: basePath
        //     };
        // }
        // const model = new llamaindex_1.OpenAIEmbedding(obj);
        // return model;
    }
}
module.exports = { nodeClass: OPEA_LLM_CODEGEN }
//# sourceMappingURL=OpenAIEmbedding_LlamaIndex.js.map
