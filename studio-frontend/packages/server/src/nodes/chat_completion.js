'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
class OPEAChatCompletion {
    constructor() {
        this.label = 'Chat Completion'
        this.name = 'chat_completion'
        this.version = 1.0
        this.type = 'ChatCompletion'
        this.icon = 'opea-icon-color.svg'
        this.category = 'Controls'
        this.description = 'Send Chat Response to UI'
        this.baseClasses = []
        this.tags = ['OPEA']
        this.inMegaservice = false
        this.inputs = [
            {
                label: 'LLM Response',
                name: 'llm_response',
                type: 'ChatCompletion'
            }
        ],
        this.hideOutput = true
    }
}
module.exports = { nodeClass: OPEAChatCompletion }
