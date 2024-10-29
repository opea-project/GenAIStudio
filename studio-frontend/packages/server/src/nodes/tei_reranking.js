'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
class OPEAReranking {
    constructor() {
        this.label = 'TEI Reranking'
        this.name = 'opea_service@reranking_tei'
        this.version = 1.0
        this.type = 'LLMParamsDoc'
        this.icon = 'opea-icon-color.svg'
        this.category = 'Reranking'
        this.description = 'TEI Reranking'
        this.baseClasses = [this.type, 'RerankingResponse', 'ChatCompletionRequest']
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
                label: 'Documents',
                name: 'retreived_docs',
                type: 'SearchedDocs|RerankingRequest|ChatCompletionRequest'
            },
            {
                label: 'Model Name',
                name: 'modelName',
                type: 'string',
                default: 'BAAI/bge-reranker-base'
            },
            {
                label: 'HuggingFace Token',
                name: 'huggingFaceToken',
                type: 'password',
                optional: true,
            },
            {
                label: 'Top N',
                name: 'top_n',
                type: 'number',
                default: 1,
                optional: true,
                additionalParams: true,
                inferenceParams: true
            }
        ]
    }
}
module.exports = { nodeClass: OPEAReranking }
