'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
class OPEARedisRetreiver {
    constructor() {
        this.label = 'Redis Retreiver'
        this.name = 'opea_service@retriever_redis'
        this.version = 1.0
        this.type = 'SearchedDoc'
        this.icon = 'assets/opea-icon-color.svg'
        this.category = 'Retriever'
        this.description = 'Redis Retreiver with Langchain'
        this.baseClasses = [this.type, 'RetrievalResponse', 'ChatCompletionRequest']
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
                label: 'Search Query',
                name: 'text',
                type: 'EmbedDoc|RetrievalRequest|ChatCompletionRequest'
            },
            {
                label: 'Redis Vector Store',
                name: 'vector_db',
                type: 'EmbedDoc'
            },
            {
                label: 'Model Name',
                name: 'modelName',
                type: 'string',
                default: 'BAAI/bge-base-en-v1.5'
            },
            {
                label: 'HuggingFace Token',
                name: 'huggingFaceToken',
                type: 'password',
                optional: true,
            },
            {
                label: 'Search Type',
                name: 'search_type',
                type: 'options',
                default: 'similarity',
                options: [
                    {
                        name: 'similarity',
                        label: 'similarity'
                    },
                    {
                        name: 'similarity_distance_threshold',
                        label: 'similarity_distance_threshold'
                    },
                    {
                        name: 'similarity_score_threshold',
                        label: 'similarity_score_threshold'
                    },
                    {
                        name: 'mmr',
                        label: 'mmr'
                    }
                ],
                optional: true,
                additionalParams: true,
                inferenceParams: true
            }
        ]
    }
}

module.exports = { nodeClass: OPEARedisRetreiver }
