import express from 'express'
import apikeyRouter from './apikey'
import chatMessageRouter from './chat-messages'
import chatflowsRouter from './chatflows'
import chatflowsSandboxRouter from './chatflows-sandbox'
import componentsCredentialsRouter from './components-credentials'
import componentsCredentialsIconRouter from './components-credentials-icon'
import credentialsRouter from './credentials'
import exportImportRouter from './export-import'
import finetuningRouter from './finetuning'
import evaluationRouter from './evaluation'
import flowConfigRouter from './flow-config'
import getUploadFileRouter from './get-upload-file'
import getUploadPathRouter from './get-upload-path'
import nodeConfigRouter from './node-configs'
import nodeCustomFunctionRouter from './node-custom-functions'
import nodeIconRouter from './node-icons'
import nodeLoadMethodRouter from './node-load-methods'
import nodesRouter from './nodes'
import pingRouter from './ping'
import toolsRouter from './tools'
import variablesRouter from './variables'
import verifyRouter from './verify'
import versionRouter from './versions'

const router: express.Router = express.Router()

router.use('/ping', pingRouter)
router.use('/apikey', apikeyRouter)
router.use('/chatflows', chatflowsRouter)
router.use('/chatflows-sandbox', chatflowsSandboxRouter)
router.use('/chatmessage', chatMessageRouter)
router.use('/components-credentials', componentsCredentialsRouter)
router.use('/components-credentials-icon', componentsCredentialsIconRouter)
router.use('/credentials', credentialsRouter)
router.use('/export-import', exportImportRouter)
router.use('/finetuning', finetuningRouter)
router.use('/evaluation', evaluationRouter)
router.use('/flow-config', flowConfigRouter)
router.use('/get-upload-file', getUploadFileRouter)
router.use('/get-upload-path', getUploadPathRouter)
router.use('/node-config', nodeConfigRouter)
router.use('/node-custom-function', nodeCustomFunctionRouter)
router.use('/node-icon', nodeIconRouter)
router.use('/node-load-method', nodeLoadMethodRouter)
router.use('/nodes', nodesRouter)
router.use('/tools', toolsRouter)
router.use('/variables', variablesRouter)
router.use('/verify', verifyRouter)
router.use('/version', versionRouter)

export default router

