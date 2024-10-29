'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
// const modelLoader_1 = require("../../../src/modelLoader");
// const utils_1 = require("../../../src/utils");
// const llamaindex_1 = require("llamaindex");
class OPEADataPrep {
    constructor() {
        //@ts-ignore
        // this.loadMethods = {
        //     async listModels() {
        //         return await (0, modelLoader_1.getModels)(modelLoader_1.MODEL_TYPE.EMBEDDING, 'openAIEmbedding_LlamaIndex');
        //     }
        // };
        this.label = 'Data Preparation with Redis'
        this.name = 'opea_service@prepare_doc_redis_prep'
        this.version = 1.0
        this.type = 'EmbedDoc'
        this.icon = 'opea-icon-color.svg'
        this.category = 'Data Preparation'
        this.description = 'Data Preparation with redis using Langchain'
        this.baseClasses = [this.type]
        // this.baseClasses = [this.type, 'BaseEmbedding_LlamaIndex', ...(0, utils_1.getBaseClasses)(llamaindex_1.OpenAIEmbedding)];
        this.tags = ['OPEA']
        this.inMegaservice = false
        this.dependent_services = {
            'tei': {
                'modelName': '',
                'huggingFaceToken': ''
            }
        }
        this.inputs = [
            {
                label: 'Documents',
                name: 'doc_input',
                type: 'UploadFile'
            },
            {
                label: 'Model Name',
                name: 'modelName',
                type: 'string',
                default: 'BAAI/bge-large-en-v1.5'
            },
            {
                label: 'HuggingFace Token',
                name: 'huggingFaceToken',
                type: 'password',
                optional: true,
            }
        ]
    }
}
module.exports = { nodeClass: OPEADataPrep }
//# sourceMappingURL=OpenAIEmbedding_LlamaIndex.js.map
