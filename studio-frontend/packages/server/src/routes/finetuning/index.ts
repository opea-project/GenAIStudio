import express from 'express'
import multer from 'multer'
import finetuningController from '../../controllers/finetuning'

const router = express.Router()

// Use memory storage for multer to store files in buffer
const upload = multer({ storage: multer.memoryStorage() })

// Upload training file
router.post('/files', upload.single('file'), finetuningController.uploadTrainingFile)

// Create fine-tuning job
router.post('/jobs', finetuningController.createFineTuningJob)

// List all fine-tuning jobs
router.get('/jobs', finetuningController.listFineTuningJobs)

// Retrieve a specific fine-tuning job
router.post('/jobs/retrieve', finetuningController.retrieveFineTuningJob)

// Fetch logs for a fine-tuning job
router.post('/jobs/logs', finetuningController.getFineTuningJobLogs)

// Cancel a fine-tuning job
router.post('/jobs/cancel', finetuningController.cancelFineTuningJob)
router.post('/jobs/delete', finetuningController.deleteFineTuningJob)

// Download fine-tuning job output
router.get('/download-ft/:jobId', finetuningController.downloadFineTuningOutput)

export default router
