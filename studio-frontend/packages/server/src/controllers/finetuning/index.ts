import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import finetuningService from '../../services/finetuning'

// Declare timer globals for Node.js
declare function setTimeout(cb: (...args: any[]) => void, ms?: number): any

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
        const hasFile = !!req.body?.training_file
            if (!req.body || !hasFile || !req.body.model) {
                throw new InternalFlowiseError(
                    StatusCodes.BAD_REQUEST,
                    'Error: finetuningController.createFineTuningJob - model and training_file are required!'
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
 * Fetch Ray/job logs for a fine-tuning job
 * POST /api/v1/finetuning/jobs/logs
 * body: { fine_tuning_job_id: string, ray_job_id?: string, tail?: number }
 */
const getFineTuningJobLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.body === 'undefined' || !req.body.fine_tuning_job_id) {
            throw new InternalFlowiseError(
                StatusCodes.BAD_REQUEST,
                'Error: finetuningController.getFineTuningJobLogs - fine_tuning_job_id not provided!'
            )
        }

        const fine_tuning_job_id = req.body.fine_tuning_job_id
        const ray_job_id = req.body.ray_job_id

        try {
            const apiResponse = await finetuningService.getFineTuningJobLogs(fine_tuning_job_id, { ray_job_id })
            // Service returns either { logs: string } or { logs: '', error: string }
            return res.json(apiResponse)
        } catch (err: any) {
            // If the service throws, return a structured error payload instead of propagating a 500
            const message = err?.message || String(err) || 'Unknown error fetching logs'
            return res.json({ logs: '', error: `Error: ${message}` })
        }
    } catch (error) {
        next(error)
    }
}


/**
 * Download fine-tuning job output as a zip file
 * GET /api/v1/finetuning/download-ft/:jobId
 * Creates zip, streams it to client, then deletes the zip file after download completes
 */
const downloadFineTuningOutput = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { jobId } = req.params

        if (!jobId) {
            throw new InternalFlowiseError(
                StatusCodes.BAD_REQUEST,
                'Error: finetuningController.downloadFineTuningOutput - jobId is required!'
            )
        }

        // Get the zip file path from service
        const filePath = await finetuningService.downloadFineTuningOutput(jobId)
        
        if (!filePath) {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND,
                `Error: finetuningController.downloadFineTuningOutput - zip file not found for job: ${jobId}. Please request download via WebSocket first.`
            )
        }

        const fs = require('fs')

        // Get file stats for Content-Length header (enables browser progress bar)
        const fileStats = fs.statSync(filePath)
        const fileSize = fileStats.size

        // Set response headers for file download
        const fileName = `${jobId}-output.zip`
        res.setHeader('Content-Type', 'application/zip')
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
        res.setHeader('Content-Length', fileSize)
        
        // Stream the file
        const fileStream = fs.createReadStream(filePath)
        
        // Log when stream opens
        fileStream.on('open', () => {
            console.debug(`finetuningController.downloadFineTuningOutput - starting to stream: ${filePath} (${fileSize} bytes)`)
        })

        // Log when the file stream closes (end of stream on server side)
        fileStream.on('close', () => {
            console.debug(`finetuningController.downloadFineTuningOutput - end stream: ${filePath}`)
        })
        
        // Multiple users can download the same ZIP simultaneously
        fileStream.on('error', (err: any) => {
            console.error('finetuningController.downloadFineTuningOutput - error streaming file:', err)
            if (!res.headersSent) {
                res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                    error: 'Error streaming fine-tuning output file'
                })
            }
        })

        // Log when HTTP response finishes sending bytes to client
        res.on('finish', () => {
            console.debug(`finetuningController.downloadFineTuningOutput - response finished streaming: ${filePath}`)
        })
        
        fileStream.pipe(res)
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
    getFineTuningJobLogs,
    downloadFineTuningOutput
}
