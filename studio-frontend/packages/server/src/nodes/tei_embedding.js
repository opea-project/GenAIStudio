'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
// const modelLoader_1 = require("../../../src/modelLoader");
// const utils_1 = require("../../../src/utils");
// const llamaindex_1 = require('llamaindex')
class OPEAEmbeddings {
    constructor() {
        this.label = 'TEI Embedding Langchain'
        this.name = 'opea_service@embedding_tei_langchain'
        this.version = 1.0
        this.type = 'EmbedDoc'
        this.icon = 'assets/embeddings.png'
        this.category = 'Embeddings'
        this.description = 'Text Embedding Inference using Langchain'
        this.baseClasses = [this.type, 'EmbeddingResponse', 'ChatCompletionRequest']
        this.tags = ['OPEA']
        this.inMegaservice = true
        this.dependent_services = {
            'tei': {
                'modelName': '',
                'huggingFaceToken': ''
            }
        }
        this.inputs = [
            {
                label: 'Text To Embed',
                name: 'textToEmbed',
                type: 'TextDoc|EmbeddingRequest|ChatCompletionRequest'
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
module.exports = { nodeClass: OPEAEmbeddings }
//# sourceMappingURL=OpenAIEmbedding_LlamaIndex.js.map
