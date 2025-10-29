import client from './client'
import { io } from 'socket.io-client'
import { baseURL as apiBaseURL } from '@/store/constant'

// Get the base URL for WebSocket connection
const getSocketUrl = () => {
    // Use the base URL from constants (without /api/v1)
    return apiBaseURL || window.location.origin
}

// Track active download sockets per jobId to avoid duplicate connections
const downloadSocketMap = new Map()

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
     * Each download gets its own dedicated WebSocket connection
     * No timeout - waits indefinitely until zip is ready
     * @param {string} jobId - The fine-tuning job ID
     * @param {Object} callbacks - Callback functions { onProgress, onComplete, onError }
     * @returns {Function} Cleanup function to disconnect this socket
     */
    downloadFinetuningOutputWS: (jobId, callbacks = {}) => {
        const { onProgress, onComplete, onError } = callbacks
        
        // Reuse existing socket for this jobId if present (even if not yet connected).
        // This prevents duplicate sockets when React StrictMode mounts components twice.
        const existingSocket = downloadSocketMap.get(jobId)
        if (existingSocket) {
            console.log(`[WS Download ${jobId}] Reusing existing socket (id: ${existingSocket.id || 'pending'})`)
            // Attach provided callbacks to the existing socket
            if (onProgress) existingSocket.on('download-finetuning-progress', onProgress)
            if (onComplete) existingSocket.on('download-finetuning-complete', onComplete)
            if (onError) existingSocket.on('download-finetuning-error', onError)

            // Return cleanup that detaches these listeners
            return () => {
                try {
                    if (onProgress) existingSocket.off('download-finetuning-progress', onProgress)
                    if (onComplete) existingSocket.off('download-finetuning-complete', onComplete)
                    if (onError) existingSocket.off('download-finetuning-error', onError)
                } catch (e) {}
            }
        }

        // Connect specifically to the '/finetuning-download' namespace so server-side
        // download handlers are isolated from status sockets.
        const socketUrl = getSocketUrl()

        // Create dedicated socket for this download namespace
        // Append the namespace to the URL so socket.io-client connects to it directly
        const socket = io(`${socketUrl}/finetuning-download`, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 10000,
            reconnectionAttempts: 5,
            timeout: false
        })

        // Store socket for this job so future calls reuse it
        try { downloadSocketMap.set(jobId, socket) } catch (e) {}

        // Handle connection
        socket.on('connect', () => {
            // Notify that the download socket is connected for this jobId
            console.log(`[WS Download ${jobId}] Connected (socket id: ${socket.id})`)
            // Request download preparation
            socket.emit('download-finetuning-output', { jobId })
        })

        // Handle completion
        socket.on('download-finetuning-complete', (data) => {
            console.log(`[WS Download ${jobId}] Complete`)
            if (onComplete) onComplete(data)
            // Disconnect after completion
            try { socket.disconnect() } catch (e) {}
            // remove from map
            try { downloadSocketMap.delete(jobId) } catch (e) {}
        })

        // Handle errors
        socket.on('download-finetuning-error', (data) => {
            console.error(`[WS Download ${jobId}] Error:`, data)
            if (onError) onError(data)
            try { socket.disconnect() } catch (e) {}
            try { downloadSocketMap.delete(jobId) } catch (e) {}
        })

        // Handle connection errors
        socket.on('connect_error', (error) => {
            console.error(`[WS Download ${jobId}] Connection error:`, error.message)
            // Don't call onError for connection errors - let it retry
        })

        // Handle disconnect
        socket.on('disconnect', (reason) => {
            console.log(`[WS Download ${jobId}] Disconnected:`, reason)
            try { downloadSocketMap.delete(jobId) } catch (e) {}
        })

        // Return cleanup function
        return () => {
            try {
                if (onProgress) socket.off('download-finetuning-progress', onProgress)
                if (onComplete) socket.off('download-finetuning-complete', onComplete)
                if (onError) socket.off('download-finetuning-error', onError)
            } catch (e) {}
            try {
                if (socket && socket.connected) {
                    console.log(`[WS Download ${jobId}] Manually disconnecting`)
                    socket.disconnect()
                }
            } catch (e) {}
            try { downloadSocketMap.delete(jobId) } catch (e) {}
        }
    },

    /**
     * Subscribe to real-time job status updates via WebSocket
     * Creates a dedicated WebSocket connection per job ID
     * @param {string} jobId - Single job ID to monitor
     * @param {Object} callbacks - Callback functions { onUpdate, onError, onConnected }
     * @returns {Function} Cleanup function to disconnect
     */
    subscribeToJobStatus: (jobId, callbacks = {}) => {
        const { onUpdate, onError, onConnected } = callbacks
        
        if (!jobId) {
            if (onError) onError({ error: 'No job ID provided' })
            return () => {}
        }

        const socketUrl = getSocketUrl()
        const socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: Infinity,
            timeout: false
        })

        const FINAL_STATUSES = ['succeeded', 'completed', 'failed', 'cancelled', 'canceled']

        socket.on('connect', () => {
            console.log(`[WS] Connected for job ${jobId}`)
            socket.emit('subscribe-job-status', { jobIds: [jobId] })
        })

        socket.on('subscription-confirmed', (data) => {
            if (onConnected) onConnected(data)
        })

        socket.on('subscription-error', (data) => {
            if (onError) onError(data)
        })

        socket.on('job-status-update', (jobData) => {
            // Only process updates for this specific job
            if (jobData.id === jobId) {
                if (onUpdate) onUpdate(jobData)
                
                // Check if job reached final status
                const status = (jobData.status || '').toString().toLowerCase()
                if (FINAL_STATUSES.includes(status)) {
                    // Auto-disconnect after final status
                    setTimeout(() => {
                        if (socket && socket.connected) {
                            socket.disconnect()
                        }
                    }, 1000)
                }
            }
        })

        socket.on('job-status-error', (err) => {
            if (err.jobId === jobId && onError) {
                onError(err)
            }
        })

        socket.on('disconnect', () => {
            console.log(`[WS] Disconnected for job ${jobId}`)
        })

        socket.on('connect_error', (error) => {
            console.error(`[WS] Connection error for job ${jobId}:`, error.message)
        })

        // Return cleanup function
        return () => {
            if (socket && socket.connected) {
                socket.emit('unsubscribe-job-status', { jobIds: [jobId] })
                socket.disconnect()
            }
        }
    },

    // Delete job API
    deleteJob: (jobId) => {
        // Call the backend delete endpoint which will cancel remote job and remove local DB records
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