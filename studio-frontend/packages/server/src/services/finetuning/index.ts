import axios, { AxiosInstance } from 'axios'
import http from 'http'
import https from 'https'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { FineTuningJob } from '../../database/entities/FineTuningJob'
import { FineTuningCheckpoint } from '../../database/entities/FineTuningCheckpoint'

// Get finetuning service URL from environment variable or use default
// Note: use host network IP instead of localhost so containerized server can reach the finetuning service
const FINETUNING_SERVICE_URL = process.env.FINETUNING_SERVICE_URL || 'undefined'

// Create an axios client with keep-alive to reduce connection churn
const agentOptions = { keepAlive: true, maxSockets: 20 }
const httpAgent = new http.Agent(agentOptions)
const httpsAgent = new https.Agent(agentOptions)

const axiosClient: AxiosInstance = axios.create({
    baseURL: FINETUNING_SERVICE_URL,
    timeout: 60000, // increase timeout to 60s
    httpAgent,
    httpsAgent,
    headers: {
        'Content-Type': 'application/json'
    }
})

// In-memory mapping: filename (raw and decoded) -> { id, rawFilename }
const uploadedFileIdMap: Map<string, { id: string; rawFilename: string }> = new Map()

/**
 * Upload a training file to the finetuning service
 */
const uploadTrainingFile = async (file: Express.Multer.File, purpose: string = 'fine-tune') => {
    try {
        // Create FormData using the browser/Node.js FormData API
        const FormData = require('form-data')
        const formData = new FormData()
        
        formData.append('file', file.buffer, {
            filename: file.originalname,
            contentType: file.mimetype
        })
        formData.append('purpose', purpose)

        const response = await axios.post(`${FINETUNING_SERVICE_URL}/v1/files`, formData, {
            headers: {
                ...formData.getHeaders()
            }
        })

        // Debug: log the response from the finetuning service for uploaded file
        try {
            // eslint-disable-next-line no-console
            console.debug('finetuningService.uploadTrainingFile - response.data:', response.data)
        } catch (logErr) {
            // ignore logging errors
        }

        // If the finetuning service returned an id and a filename, store mappings for both
        try {
            const returnedId = response?.data?.id || response?.data?.file_id || response?.data?.name || undefined
            const returnedFilenameRaw = response?.data?.filename || response?.data?.name || undefined
            if (returnedId && returnedFilenameRaw) {
                // store both raw and decoded filename keys
                let decodedFilename = returnedFilenameRaw
                try {
                    decodedFilename = decodeURIComponent(returnedFilenameRaw)
                } catch (e) {
                    // ignore decode errors
                }

                const entry = { id: returnedId, rawFilename: returnedFilenameRaw }
                uploadedFileIdMap.set(returnedFilenameRaw, entry)
                if (decodedFilename !== returnedFilenameRaw) {
                    uploadedFileIdMap.set(decodedFilename, entry)
                }

                // eslint-disable-next-line no-console
                console.debug('finetuningService.uploadTrainingFile - stored mapping', decodedFilename, '<->', returnedFilenameRaw, '->', returnedId)
            }
        } catch (e) {
            // ignore mapping errors
        }

        return response.data
    } catch (error: any) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: finetuningService.uploadTrainingFile - ${getErrorMessage(error)}`
        )
    }
}

// Helper: persist or update a fine-tuning job record in the local DB
const persistJobToDb = async (jobData: any) => {
    try {
        if (!jobData) return
        const appServer = getRunningExpressApp()
        if (!appServer || !appServer.AppDataSource) return

        const repo = appServer.AppDataSource.getRepository(FineTuningJob)

        // Determine canonical id from the response
        const id = jobData.id || jobData.job_id || jobData.fine_tuning_job_id || jobData.fine_tuning_id
        if (!id) return

        // Build entity object mapping common fields; fall back to stringifying objects
        // Extract task robustly: prefer explicit jobData.task, then jobData.General.task (object or JSON string)
        let taskVal: any = jobData.task || undefined
        try {
            if (!taskVal && jobData.General) {
                if (typeof jobData.General === 'string') {
                    const parsed = JSON.parse(jobData.General)
                    taskVal = parsed?.task || taskVal
                } else if (typeof jobData.General === 'object') {
                    taskVal = jobData.General?.task || taskVal
                }
            }
        } catch (e) {
            // ignore parse errors
        }

        const entity: any = {
            id: String(id),
            name: jobData.name || jobData.id || undefined,
            model: jobData.model || undefined,
            status: jobData.status || jobData.state || undefined,
            training_file: jobData.training_file || jobData.trainingFile || undefined,
            training_file_id: jobData.training_file_id || undefined,
            task: taskVal || undefined,
            progress: typeof jobData.progress === 'number' ? jobData.progress : undefined,
            trained_tokens: typeof jobData.trained_tokens === 'number' ? jobData.trained_tokens : undefined
        }


        if (jobData.hyperparameters) {
            try {
                entity.hyperparameters = typeof jobData.hyperparameters === 'object' ? JSON.stringify(jobData.hyperparameters) : String(jobData.hyperparameters)
            } catch (e) {}
        }

        if (jobData.result_files) {
            try {
                entity.result_files = typeof jobData.result_files === 'object' ? JSON.stringify(jobData.result_files) : String(jobData.result_files)
            } catch (e) {}
        }

        if (jobData.error) {
            try {
                entity.error = typeof jobData.error === 'object' ? JSON.stringify(jobData.error) : String(jobData.error)
            } catch (e) {}
        }

        if (jobData.estimated_finish) {
            entity.estimated_finish = new Date(jobData.estimated_finish)
        }
        if (jobData.finishedDate || jobData.finished_at || jobData.completed_at) {
            entity.finishedDate = new Date(jobData.finishedDate || jobData.finished_at || jobData.completed_at)
        }

        // Upsert: merge if exists
        let existing = await repo.findOneBy({ id: String(id) })
        if (!existing) {
            const created = repo.create(entity)
            await repo.save(created)
        } else {
            repo.merge(existing, entity)
            await repo.save(existing)
        }
    } catch (e) {
        // Don't fail the main flow if DB persistence fails; only log
        try {
            // eslint-disable-next-line no-console
            console.error('finetuningService.persistJobToDb - failed to persist job', e)
        } catch (logErr) {
            // ignore
        }
    }
}

// Helper: update specific fields for a job in the DB (best-effort)
const updateJobInDb = async (jobId: string, updates: Partial<any>) => {
    try {
        if (!jobId) return
        const appServer = getRunningExpressApp()
        if (!appServer || !appServer.AppDataSource) return
        const repo = appServer.AppDataSource.getRepository(FineTuningJob)
        const existing = await repo.findOneBy({ id: String(jobId) })
        if (!existing) return
        repo.merge(existing, updates)
        await repo.save(existing)
    } catch (e) {
        try {
            // eslint-disable-next-line no-console
            console.error('finetuningService.updateJobInDb - failed to update job', jobId, e)
        } catch (logErr) {
            // ignore
        }
    }
}

/**
 * Create a fine-tuning job
 */
const createFineTuningJob = async (jobConfig: {
    training_file: string
    model: string
    General?: {
        task?: string
        lora_config?: any
    }
    Dataset?: {
        max_length?: number
        query_max_len?: number
        passage_max_len?: number
        padding?: string
    }
    Training?: {
        epochs?: number
        batch_size?: number
        gradient_accumulation_steps?: number
    }
}) => {
    try {
        // Work with the jobConfig as-provided by the UI. Do not decode training_file automatically;
        // the external service may expect the raw (possibly URL-encoded) filename.
        const forwardedJobConfig = { ...jobConfig }

        // Debug: log the jobConfig being forwarded to the external finetuning service
        try {
            // eslint-disable-next-line no-console
            console.debug('finetuningService.createFineTuningJob - initial jobConfig:', forwardedJobConfig)
        } catch (logErr) {
            // ignore
        }
        // Sanitize the payload: remove undefined values and empty nested objects
        const sanitizedPayload = JSON.parse(JSON.stringify(forwardedJobConfig))
        
        // // Fix lora_config: must be explicitly null for rerank/embedding tasks, or omitted for instruction tuning
        // if (sanitizedPayload?.General) {
        //     if (Object.prototype.hasOwnProperty.call(sanitizedPayload.General, 'lora_config')) {
        //         const task = sanitizedPayload.General.task
        //         if (task === 'rerank' || task === 'embedding') {
        //             // For rerank/embedding tasks, lora_config must be explicitly null
        //             sanitizedPayload.General.lora_config = null
        //             // eslint-disable-next-line no-console
        //             console.debug('finetuningService.createFineTuningJob - setting General.lora_config to null for task:', task)
        //         } else {
        //             // For instruction tuning or other tasks, remove lora_config
        //             // eslint-disable-next-line no-console
        //             console.debug('finetuningService.createFineTuningJob - removing General.lora_config for instruction tuning')
        //             delete sanitizedPayload.General.lora_config
        //         }
        //     } else if (sanitizedPayload.General.task === 'rerank' || sanitizedPayload.General.task === 'embedding') {
        //         // If lora_config is missing for rerank/embedding, add it as null
        //         sanitizedPayload.General.lora_config = null
        //         // eslint-disable-next-line no-console
        //         console.debug('finetuningService.createFineTuningJob - adding lora_config=null for task:', sanitizedPayload.General.task)
        //     }
        // }
        
        // Remove empty nested objects that may confuse the server
        if (sanitizedPayload.General && Object.keys(sanitizedPayload.General).length === 0) {
            delete sanitizedPayload.General
        }
        if (sanitizedPayload.Dataset && Object.keys(sanitizedPayload.Dataset).length === 0) {
            delete sanitizedPayload.Dataset
        }
        if (sanitizedPayload.Training && Object.keys(sanitizedPayload.Training).length === 0) {
            delete sanitizedPayload.Training
        }
        
        // // For embedding/rerank tasks, only send training_file, model, and General (as per documentation examples)
        // // Additional Dataset/Training params may cause 500 errors
        // const task = sanitizedPayload.General?.task
        // if (task === 'embedding' || task === 'rerank') {
        //     // Create minimal payload for embedding/rerank
        //     const minimalPayload: any = {
        //         training_file: sanitizedPayload.training_file,
        //         model: sanitizedPayload.model,
        //         General: sanitizedPayload.General
        //     }
        //     // Only include Dataset/Training if they have non-default values
        //     // eslint-disable-next-line no-console
        //     console.debug('finetuningService.createFineTuningJob - using minimal payload for', task, 'task')
        //     Object.assign(sanitizedPayload, minimalPayload)
        //     // Remove Dataset and Training for embedding/rerank to match documentation
        //     delete (sanitizedPayload as any).Dataset
        //     delete (sanitizedPayload as any).Training
        // }

        // Use the stored raw filename from upload if available
        // The upload response returns the exact filename as stored on the finetuning service
        if (sanitizedPayload.training_file && typeof sanitizedPayload.training_file === 'string') {
            const originalFilename = sanitizedPayload.training_file
            
            // Try to decode first in case it's URL-encoded
            let lookupKey = originalFilename
            try {
                const decoded = decodeURIComponent(originalFilename)
                lookupKey = decoded
            } catch (e) {
                // ignore decode errors
            }
            
            // Check if we have a stored mapping from the upload
            let stored = uploadedFileIdMap.get(lookupKey)
            if (!stored && lookupKey !== originalFilename) {
                // Also try the original (encoded) key
                stored = uploadedFileIdMap.get(originalFilename)
            }
            
            if (stored && stored.rawFilename) {
                sanitizedPayload.training_file = stored.rawFilename
                // eslint-disable-next-line no-console
                console.debug('finetuningService.createFineTuningJob - using stored raw filename from upload:', stored.rawFilename)
            } else {
                // No stored mapping, try to use the original filename as-is
                // The upload service may have stored it with the encoded name
                sanitizedPayload.training_file = originalFilename
                // eslint-disable-next-line no-console
                console.debug('finetuningService.createFineTuningJob - no stored mapping found, using filename as-is:', originalFilename)
            }
        }
        
        // Remove training_file_id - the API doesn't accept it, only training_file is required
        if ((sanitizedPayload as any).training_file_id) {
            // eslint-disable-next-line no-console
            console.debug('finetuningService.createFineTuningJob - removing training_file_id from payload')
            delete (sanitizedPayload as any).training_file_id
        }

        // Try a sequence of attempts to accommodate naming/encoding/id differences.
        const attemptPost = async (payload: any, label = 'attempt') => {
            try {
                // eslint-disable-next-line no-console
                console.debug(`finetuningService.createFineTuningJob - ${label} payload:`, payload)
                const resp = await axiosClient.post('/v1/fine_tuning/jobs', payload)
                // eslint-disable-next-line no-console
                console.debug(`finetuningService.createFineTuningJob - ${label} response:`, typeof resp?.data === 'string' ? resp.data : JSON.stringify(resp?.data))
                return resp
            } catch (err: any) {
                // Log detailed info for debugging
                try {
                    // eslint-disable-next-line no-console
                    console.error(`finetuningService.createFineTuningJob - ${label} failed`, {
                        message: err?.message,
                        status: err?.response?.status,
                        responseData: typeof err?.response?.data === 'string' ? err.response.data : JSON.stringify(err?.response?.data),
                        payload
                    })
                } catch (logErr) {
                    // ignore logging errors
                }
                throw err
            }
        }

        // Log the final sanitized payload
        try {
            // eslint-disable-next-line no-console
            console.debug('finetuningService.createFineTuningJob - final sanitized payload:', JSON.stringify(sanitizedPayload, null, 2))
        } catch (e) {
            // ignore
        }

        // Send the sanitized payload
        const resp = await attemptPost(sanitizedPayload, 'final')
        const respData = resp.data
        // If the external service didn't echo back the task, preserve task from our sanitized payload
        try {
            const payloadTask = sanitizedPayload?.General?.task || sanitizedPayload?.task
            if (payloadTask && !respData.task) {
                // attach task so persistJobToDb stores it
                try { respData.task = payloadTask } catch (e) { /* ignore */ }
            }
        } catch (e) {
            // ignore
        }

        // Persist to local DB (best-effort)
        try {
            await persistJobToDb(respData)
        } catch (e) {
            // ignore
        }
        return respData
    } catch (error: any) {
        // Log error details from external service if available for debugging
        try {
            // eslint-disable-next-line no-console
            console.error('finetuningService.createFineTuningJob - axios error:', {
                message: error.message,
                responseData: error.response ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data)) : undefined,
                status: error.response ? error.response.status : undefined,
                headers: error.response ? error.response.headers : undefined
            })
        } catch (logErr) {
            // ignore logging errors
        }
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: finetuningService.createFineTuningJob - ${getErrorMessage(error)}`
        )
    }
}

/**
 * List all fine-tuning jobs
 */
const listFineTuningJobs = async () => {
    try {
        // First try to read persisted jobs from local DB
        try {
            const appServer = getRunningExpressApp()
            const repo = appServer.AppDataSource.getRepository(FineTuningJob)
            const persisted = await repo.find()
            if (persisted && persisted.length > 0) {
                return persisted
            }
        } catch (e) {
            // If DB read fails, we'll fall back to external service
            // eslint-disable-next-line no-console
            console.debug('finetuningService.listFineTuningJobs - DB read failed, falling back to external service', e)
        }

        // Fallback: query external finetuning service and persist results
        const response = await axiosClient.get('/v1/fine_tuning/jobs')
        const data = response.data
        try {
            if (Array.isArray(data)) {
                for (const j of data) {
                    // best-effort persist
                    // eslint-disable-next-line no-await-in-loop
                    await persistJobToDb(j)
                }
            }
        } catch (e) {
            // ignore persistence errors
        }

        return data
    } catch (error: any) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: finetuningService.listFineTuningJobs - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Retrieve a specific fine-tuning job
 */
const retrieveFineTuningJob = async (fineTuningJobId: string) => {
    const maxAttempts = 3
    const baseDelayMs = 500

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            // Log attempt for easier correlation in logs
            // eslint-disable-next-line no-console
            console.debug(`finetuningService.retrieveFineTuningJob - attempt ${attempt} for job ${fineTuningJobId}`)

            const response = await axiosClient.post('/v1/fine_tuning/jobs/retrieve', {
                fine_tuning_job_id: fineTuningJobId
            })
            const respData = response.data
            // Persist/update DB with latest status (best-effort)
            try {
                await persistJobToDb(respData)
            } catch (e) {
                // ignore
            }
            return respData
        } catch (error: any) {
            const msg = getErrorMessage(error)
            // eslint-disable-next-line no-console
            console.warn(`finetuningService.retrieveFineTuningJob - attempt ${attempt} failed: ${msg}`)

            const isTransient = msg && (
                msg.toLowerCase().includes('socket hang up') ||
                msg.toLowerCase().includes('econnreset') ||
                msg.toLowerCase().includes('etimedout') ||
                msg.toLowerCase().includes('timeout') ||
                msg.toLowerCase().includes('connect')
            )

            if (attempt < maxAttempts && isTransient) {
                const delay = baseDelayMs * Math.pow(2, attempt - 1)
                // eslint-disable-next-line no-console
                console.debug(`finetuningService.retrieveFineTuningJob - retrying in ${delay}ms`)
                // eslint-disable-next-line no-await-in-loop
                await sleep(delay)
                continue
            }

            // Final failure: log details and throw
            try {
                // eslint-disable-next-line no-console
                console.error('finetuningService.retrieveFineTuningJob - error details:', {
                    message: error?.message,
                    status: error?.response?.status,
                    responseData: error?.response?.data
                })
            } catch (logErr) {
                // ignore logging errors
            }

            throw new InternalFlowiseError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: finetuningService.retrieveFineTuningJob - ${msg}`
            )
        }
    }

    throw new InternalFlowiseError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        `Error: finetuningService.retrieveFineTuningJob - failed after ${maxAttempts} attempts`
    )
}

/**
 * Cancel a fine-tuning job
 */
const cancelFineTuningJob = async (fineTuningJobId: string) => {
    try {
        const response = await axiosClient.post('/v1/fine_tuning/jobs/cancel', {
            fine_tuning_job_id: fineTuningJobId
        })
        // Best-effort: update local DB to reflect cancelled status
        try {
            await updateJobInDb(fineTuningJobId, { status: 'cancelled', finishedDate: new Date() })
        } catch (e) {
            // ignore
        }
        return response.data
    } catch (error: any) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: finetuningService.cancelFineTuningJob - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Delete a fine-tuning job locally and attempt to cancel it remotely.
 * This will cancel the external job (best-effort) and remove DB records for the job and checkpoints.
 */
const deleteFineTuningJob = async (fineTuningJobId: string) => {
    try {
        // Attempt to cancel external job (best-effort)
        try {
            await axiosClient.post('/v1/fine_tuning/jobs/cancel', {
                fine_tuning_job_id: fineTuningJobId
            })
        } catch (e) {
            // ignore external cancel errors
            try {
                // eslint-disable-next-line no-console
                console.debug('finetuningService.deleteFineTuningJob - external cancel failed, continuing to delete locally', e)
            } catch (logErr) {}
        }

        // Remove local DB records (best-effort)
        try {
            const appServer = getRunningExpressApp()
            const repo = appServer.AppDataSource.getRepository(FineTuningJob)
            const checkpointRepo = appServer.AppDataSource.getRepository(FineTuningCheckpoint)

            // delete checkpoints first
            await checkpointRepo.delete({ fine_tuning_job_id: String(fineTuningJobId) })
            // delete job
            await repo.delete({ id: String(fineTuningJobId) })
        } catch (e) {
            try {
                // eslint-disable-next-line no-console
                console.error('finetuningService.deleteFineTuningJob - failed to delete local DB records', e)
            } catch (logErr) {}
        }

        return { success: true }
    } catch (error: any) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: finetuningService.deleteFineTuningJob - ${getErrorMessage(error)}`
        )
    }
}

/**
 * List checkpoints of a fine-tuning job
 */
const listFineTuningCheckpoints = async (fineTuningJobId: string) => {
    try {
        const response = await axiosClient.post('/v1/finetune/list_checkpoints', {
            fine_tuning_job_id: fineTuningJobId
        })
        return response.data
    } catch (error: any) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: finetuningService.listFineTuningCheckpoints - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Debug helper: forward any payload to the external finetuning job endpoint and return raw status/body
 */
const proxyJobDebug = async (payload: any) => {
    try {
        const resp = await axiosClient.post('/v1/fine_tuning/jobs', payload)
        return { status: resp.status, body: resp.data }
    } catch (error: any) {
        // Return the status and response data (stringify if needed)
        const status = error?.response?.status || 500
        const body = error?.response?.data || (error?.message || 'Unknown error')
        return { status, body }
    }
}

export default {
    uploadTrainingFile,
    createFineTuningJob,
    listFineTuningJobs,
    retrieveFineTuningJob,
    cancelFineTuningJob,
    listFineTuningCheckpoints,
    deleteFineTuningJob,
    proxyJobDebug
}
