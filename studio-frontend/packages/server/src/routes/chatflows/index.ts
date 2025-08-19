import express from 'express'
import chatflowsController from '../../controllers/chatflows'
const router = express.Router()

// CREATE
router.post('/', chatflowsController.saveChatflow)
router.post('/importsamples', chatflowsController.importSampleChatflowsbyUserId)
router.post('/importchatflows', chatflowsController.importChatflows)

// READ
router.get('/pubkey', chatflowsController.getPublicKey)
router.get('/', chatflowsController.getAllChatflowsbyUserId)
router.get('/deployment-status/:id', chatflowsController.getDeploymentStatus)
router.get(['/', '/:id'], chatflowsController.getChatflowById)
router.get(['/apikey/', '/apikey/:apikey'], chatflowsController.getChatflowByApiKey)

// UPDATE
router.put(['/', '/:id'], chatflowsController.updateChatflow)
router.put('/deployment-status/:id', chatflowsController.updateDeploymentStatus)

// DELETE
router.delete(['/', '/:id'], chatflowsController.deleteChatflow)

export default router
