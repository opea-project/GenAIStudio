import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import finetuningService from '../../services/finetuning'

/**
 * Upload a training file
 * POST /api/v1/finetuning/files
 */
const uploadTrainingFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            // Debug: log request body and files to help trace upload issues
            console.debug('finetuningController.uploadTrainingFile - no file received. req.body=', req.body, 'req.files=', (req as any).files)
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Error: finetuningController.uploadTrainingFile - file not provided!')
        }

        const purpose = req.body.purpose || 'fine-tune'
        const apiResponse = await finetuningService.uploadTrainingFile(req.file, purpose)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

/**
 * Create a fine-tuning job
 * POST /api/v1/finetuning/jobs
 */
const createFineTuningJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const hasFile = !!req.body?.training_file || !!(req.body as any).training_file_id
        if (!req.body || !hasFile || !req.body.model) {
            throw new InternalFlowiseError(
                StatusCodes.BAD_REQUEST,
                'Error: finetuningController.createFineTuningJob - model and training_file (or training_file_id) are required!'
            )
        }

        const apiResponse = await finetuningService.createFineTuningJob(req.body)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

/**
 * List all fine-tuning jobs
 * GET /api/v1/finetuning/jobs
 */
const listFineTuningJobs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const apiResponse = await finetuningService.listFineTuningJobs()
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

/**
 * Retrieve a specific fine-tuning job
 * POST /api/v1/finetuning/jobs/retrieve
 */
const retrieveFineTuningJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.body === 'undefined' || !req.body.fine_tuning_job_id) {
            throw new InternalFlowiseError(
                StatusCodes.BAD_REQUEST,
                'Error: finetuningController.retrieveFineTuningJob - fine_tuning_job_id not provided!'
            )
        }

        const apiResponse = await finetuningService.retrieveFineTuningJob(req.body.fine_tuning_job_id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

/**
 * Cancel a fine-tuning job
 * POST /api/v1/finetuning/jobs/cancel
 */
const cancelFineTuningJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.body === 'undefined' || !req.body.fine_tuning_job_id) {
            throw new InternalFlowiseError(
                StatusCodes.BAD_REQUEST,
                'Error: finetuningController.cancelFineTuningJob - fine_tuning_job_id not provided!'
            )
        }

        const apiResponse = await finetuningService.cancelFineTuningJob(req.body.fine_tuning_job_id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

/**
 * Delete a fine-tuning job (cancel remote if possible and remove local records)
 * POST /api/v1/finetuning/jobs/delete
 */
const deleteFineTuningJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.body === 'undefined' || !req.body.fine_tuning_job_id) {
            throw new InternalFlowiseError(
                StatusCodes.BAD_REQUEST,
                'Error: finetuningController.deleteFineTuningJob - fine_tuning_job_id not provided!'
            )
        }

        const apiResponse = await finetuningService.deleteFineTuningJob(req.body.fine_tuning_job_id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

/**
 * List checkpoints of a fine-tuning job
 * POST /api/v1/finetuning/jobs/checkpoints
 */
const listFineTuningCheckpoints = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.body === 'undefined' || !req.body.fine_tuning_job_id) {
            throw new InternalFlowiseError(
                StatusCodes.BAD_REQUEST,
                'Error: finetuningController.listFineTuningCheckpoints - fine_tuning_job_id not provided!'
            )
        }

        const apiResponse = await finetuningService.listFineTuningCheckpoints(req.body.fine_tuning_job_id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

/**
 * Debug: proxy an arbitrary job payload to the finetuning service and return raw response
 * POST /api/v1/finetuning/debug/proxy-job
 */
const proxyJobDebug = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.body === 'undefined') {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Error: finetuningController.proxyJobDebug - body is required')
        }

        const apiResponse = await finetuningService.proxyJobDebug(req.body)
        // Return the raw response object from the finetuning service
        return res.status(apiResponse.status).send(apiResponse.body)
    } catch (error) {
        next(error)
    }
}

export default {
    uploadTrainingFile,
    createFineTuningJob,
    listFineTuningJobs,
    retrieveFineTuningJob,
    cancelFineTuningJob,
    deleteFineTuningJob,
    listFineTuningCheckpoints,
    proxyJobDebug
}
