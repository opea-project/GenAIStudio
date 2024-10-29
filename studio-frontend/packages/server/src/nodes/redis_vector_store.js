'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
class OPEARedisVectorStore {
    constructor() {
        this.label = 'Redis Vector Store'
        this.name = 'redis_vector_store'
        this.version = 1.0
        this.type = 'EmbedDoc'
        this.icon = 'opea-icon-color.svg'
        this.category = 'VectorStores'
        this.description = 'Redis Vector Store'
        this.baseClasses = [this.type]
        this.tags = ['OPEA']
        this.inMegaservice = true
        this.inputs = [
            {
                label: 'Prepared Documents',
                name: 'prepared_doc',
                type: 'EmbedDoc'
            }
        ]
    }
}
module.exports = { nodeClass: OPEARedisVectorStore }
