'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
class OPEADocInput {
    constructor() {
        this.label = 'File Input'
        this.name = 'file_input'
        this.version = 1.0
        this.type = 'UploadFile'
        this.icon = 'assets/controls.png'
        this.category = 'Controls'
        this.description = 'User Input from File Upload'
        this.baseClasses = [this.type]
        this.tags = ['OPEA']
        this.inMegaservice = false
    }
}
module.exports = { nodeClass: OPEADocInput }
