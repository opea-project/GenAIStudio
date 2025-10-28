import client from './client'
import { io } from 'socket.io-client'
import { baseURL as apiBaseURL } from '@/store/constant'

// Get the base URL for WebSocket connection
const getSocketUrl = () => {
    // Use the base URL from constants (without /api/v1)
    return apiBaseURL || window.location.origin
}

const finetuningApi = {
    // Upload training file
    uploadFile: (file, purpose = 'fine-tune', onUploadProgress) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('purpose', purpose)
        
        return client.post('/finetuning/files', formData, {
            // DO NOT set Content-Type here; letting axios set it ensures the multipart boundary is included
            onUploadProgress
        })
    },

    // Create new fine-tuning job
    createJob: (jobData) => {
        const payload = {
            training_file: jobData.training_file,
            model: jobData.model
        }

        // Add optional General configuration
        if (jobData.General) {
            payload.General = jobData.General
        }

        // Add optional Dataset configuration
        if (jobData.Dataset) {
            payload.Dataset = jobData.Dataset
        }

        // Add optional Training configuration
        if (jobData.Training) {
            payload.Training = jobData.Training
        }
        
        return client.post('/finetuning/jobs', payload)
    },

    // List all fine-tuning jobs
    getAllJobs: () => client.get('/finetuning/jobs'),

    // Retrieve specific fine-tuning job
    getJob: (fineTuningJobId) => {
        return client.post('/finetuning/jobs/retrieve', {
            fine_tuning_job_id: fineTuningJobId
        })
    },

    // Cancel a fine-tuning job
    cancelJob: (fineTuningJobId) => {
        return client.post('/finetuning/jobs/cancel', {
            fine_tuning_job_id: fineTuningJobId
        })
    },

    // Get logs for a fine-tuning job
    getJobLogs: (fineTuningJobId, opts = {}) => {
        return client.post('/finetuning/jobs/logs', {
            fine_tuning_job_id: fineTuningJobId,
            ray_job_id: opts.ray_job_id
        })
    },

    // Download fine-tuning job output as a zip file
    // This returns a blob that can be saved as a file
    // Accepts optional `onDownloadProgress` callback (progress event) and `signal` (AbortSignal)
    downloadFinetuningOutput: (jobId, onDownloadProgress = undefined, signal = undefined) => {
        const cfg = {
            responseType: 'blob',
            // allow long-running / large downloads
            timeout: 0,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        }
        if (typeof onDownloadProgress === 'function') cfg.onDownloadProgress = onDownloadProgress
        if (signal) cfg.signal = signal
        return client.get(`/finetuning/download-ft/${encodeURIComponent(jobId)}`, cfg)
    },

        /**
     * Download fine-tuning output using WebSocket for async zip preparation
     * @param {string} jobId - The fine-tuning job ID
     * @param {Object} callbacks - Callback functions { onProgress, onComplete, onError }
     * @returns {Function} Cleanup function to disconnect socket
     */
    downloadFinetuningOutputWS: (jobId, callbacks = {}) => {
        const { onProgress, onComplete, onError } = callbacks
        
        // Get socket URL
        const socketUrl = getSocketUrl()
        console.log('[WS] Connecting to:', socketUrl)
        
        // Create socket connection
        const socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: false,
            timeout: 10000
        })

        // Handle connection
        socket.on('connect', () => {
            console.log('[WS] Connected to server for download, socket ID:', socket.id)
            // Request download preparation
            socket.emit('download-finetuning-output', { jobId })
        })

        // Handle progress updates
        socket.on('download-finetuning-progress', (data) => {
            console.log('[WS] Download progress:', data)
            if (onProgress) onProgress(data)
        })

        // Handle completion
        socket.on('download-finetuning-complete', (data) => {
            console.log('[WS] Download ready:', data)
            if (onComplete) onComplete(data)
            // Disconnect after completion
            socket.disconnect()
        })

        // Handle errors
        socket.on('download-finetuning-error', (data) => {
            console.error('[WS] Download error:', data)
            if (onError) onError(data)
            socket.disconnect()
        })

        // Handle connection errors
        socket.on('connect_error', (error) => {
            console.error('[WS] Connection error:', error.message, error)
            if (onError) onError({ error: `WebSocket connection failed: ${error.message}` })
            socket.disconnect()
        })

        // Handle disconnect
        socket.on('disconnect', (reason) => {
            console.log('[WS] Disconnected:', reason)
        })

        // Return cleanup function
        return () => {
            if (socket.connected) {
                console.log('[WS] Manually disconnecting socket')
                socket.disconnect()
            }
        }
    },

    // Legacy compatibility methods
    deleteJob: (jobId) => {
        // Call the backend delete endpoint which will cancel remote job (best-effort) and remove local DB records
        return client.post('/finetuning/jobs/delete', { fine_tuning_job_id: jobId })
    },

    // Get available base models (to be implemented on backend)
    getBaseModels: () => {
        // Return common models for now
        return Promise.resolve({
            data: [
                'meta-llama/Llama-2-7b-chat-hf',
                'meta-llama/Llama-2-7b-hf',
                'meta-llama/Llama-2-13b-hf',
                'BAAI/bge-reranker-large',
                'BAAI/bge-base-en-v1.5',
                'Qwen/Qwen2.5-3B',
                'Qwen/Qwen2.5-7B'
            ]
        })
    }
}

export default finetuningApi