import express from 'express'
import statsController from '../../controllers/stats'

const router: express.Router = express.Router()

// READ
router.get(['/', '/:id'], statsController.getChatflowStats)

export default router
