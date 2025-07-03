'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
// const modelLoader_1 = require("../../../src/modelLoader");
// const utils_1 = require("../../../src/utils");
// const llamaindex_1 = require('llamaindex')
class OPEAEmbeddings {
    constructor() {
        this.label = 'Audio and Speech Recognition Whisper'
        this.name = 'opea_service@asr'
        this.version = 1.0
        this.type = 'AudioTranscriptionResponse'
        this.icon = 'assets/embeddings.png'
        this.category = 'Audio and Speech Recognition'
        this.description = 'Transcribe audio and video files using OpenAI Whisper model. Supports various audio formats including mp3, wav, and mp4.'
        this.baseClasses = [this.type, 'DocSumChatCompletionRequest']
        this.tags = ['OPEA']
        this.inMegaservice = true
        this.dependent_services = {
            'whisper': {
                'huggingFaceToken': ''
            }
        }
        this.inputs = [
            {
                label: 'Audio or Video File',
                name: 'file',
                type: 'UploadFile',
            },
            {
                label: 'HuggingFace Token',
                name: 'huggingFaceToken',
                type: 'password',
                optional: true,
            },
        ]
    }
}
module.exports = { nodeClass: OPEAEmbeddings }
//# sourceMappingURL=OpenAIEmbedding_LlamaIndex.js.map
