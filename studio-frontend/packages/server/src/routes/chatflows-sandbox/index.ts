import express from 'express'
import chatflowsController from '../../controllers/chatflows'
const router = express.Router()

// Deploy a chatflow to sandbox
router.post(['/deploy/','/deploy/:id'], chatflowsController.deployChatflowSandbox)

// Stop sandbox for a chatflow
router.post(['/stop/','/stop/:id'], chatflowsController.stopChatflowSandbox)

router.post(['/build-deployment-package/','/build-deployment-package/:id'], chatflowsController.buildDeploymentPackage)

router.post('/one-click-deployment/:id', chatflowsController.oneClickDeployment);

export default router
