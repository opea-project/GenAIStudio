import { Server, Socket } from 'socket.io'
import finetuningService from '../services/finetuning'
import logger from '../utils/logger'

// Declare timer globals so this file compiles regardless of lib settings
declare function setInterval(cb: (...args: any[]) => void, ms?: number): any
declare function clearInterval(id: any): void
declare function setTimeout(cb: (...args: any[]) => void, ms?: number): any

// Store active job subscriptions: jobId -> Set of socket IDs
const jobSubscriptions = new Map<string, Set<string>>()

// Background monitoring state
let monitoringInterval: any | null = null
const POLLING_INTERVAL = 5000 // 5 seconds - backend polls Ray API

/**
 * Setup WebSocket handlers for fine-tuning job status monitoring
 * Clients can subscribe to specific job updates and receive real-time status changes
 */
export const setupFineTuningStatusHandlers = (io: Server) => {
    io.on('connection', (socket: Socket) => {
        logger.info(`[WS Status] Client connected - Socket ID: ${socket.id}`)
        
        /**
         * Subscribe to job status updates
         * Client sends: { jobIds: string[] }
         * Server will emit 'job-status-update' events for these jobs
         */
        socket.on('subscribe-job-status', (data: { jobIds: string[] }) => {
            try {
                const { jobIds } = data
                
                if (!Array.isArray(jobIds) || jobIds.length === 0) {
                    return
                }

                // Add this socket to each job's subscription set
                jobIds.forEach(jobId => {
                    if (!jobSubscriptions.has(jobId)) {
                        jobSubscriptions.set(jobId, new Set())
                    }
                    jobSubscriptions.get(jobId)!.add(socket.id)
                })

                // Start background monitoring if not already running
                startBackgroundMonitoring(io)

                // Send immediate acknowledgment
                socket.emit('subscription-confirmed', { 
                    jobIds,
                    message: 'Subscribed to job updates'
                })

            } catch (error: any) {
                socket.emit('subscription-error', {
                    error: error?.message || 'Failed to subscribe'
                })
            }
        })

        /**
         * Unsubscribe from job status updates
         * Client sends: { jobIds: string[] }
         */
        socket.on('unsubscribe-job-status', (data: { jobIds: string[] }) => {
            try {
                const { jobIds } = data
                
                if (!Array.isArray(jobIds)) return

                jobIds.forEach(jobId => {
                    const subscribers = jobSubscriptions.get(jobId)
                    if (subscribers) {
                        subscribers.delete(socket.id)
                        if (subscribers.size === 0) {
                            jobSubscriptions.delete(jobId)
                        }
                    }
                })

                // Stop monitoring if no more subscriptions
                if (jobSubscriptions.size === 0) {
                    stopBackgroundMonitoring()
                }

            } catch (error: any) {
                // Silent error handling
            }
        })

        /**
         * Handle client disconnect - clean up subscriptions
         */
        socket.on('disconnect', (reason: any) => {
            logger.info(`[WS Status] Client disconnected - Socket ID: ${socket.id}`)
            
            // Remove this socket from all job subscriptions
            let removedCount = 0
            jobSubscriptions.forEach((subscribers, jobId) => {
                if (subscribers.has(socket.id)) {
                    subscribers.delete(socket.id)
                    removedCount++
                    if (subscribers.size === 0) {
                        jobSubscriptions.delete(jobId)
                    }
                }
            })

            // Stop monitoring if no more subscriptions
            if (jobSubscriptions.size === 0) {
                stopBackgroundMonitoring()
            }
        })
    })
}

/**
 * Start background monitoring of subscribed jobs
 * Polls the fine-tuning service and emits updates via WebSocket
 */
function startBackgroundMonitoring(io: Server) {
    // Already running
    if (monitoringInterval) return

    // Poll immediately, then at regular intervals
    checkJobStatuses(io)

    // Use global.setInterval to satisfy TypeScript without depending on DOM lib
    // store as any to avoid NodeJS type issues in this repository's tsconfig
    monitoringInterval = (setInterval(() => {
        checkJobStatuses(io)
    }, POLLING_INTERVAL) as unknown) as any
}

/**
 * Stop background monitoring
 */
function stopBackgroundMonitoring() {
    if (!monitoringInterval) return

    clearInterval(monitoringInterval as any)
    monitoringInterval = null
}

/**
 * Check status of all subscribed jobs and emit updates
 */
async function checkJobStatuses(io: Server) {
    const jobIds = Array.from(jobSubscriptions.keys())
    
    if (jobIds.length === 0) {
        stopBackgroundMonitoring()
        return
    }

    // Keep routine checks quiet - debug level only
    logger.debug(`[WS Status] Checking ${jobIds.length} subscribed jobs`)

    // Retrieve all subscribed jobs in parallel (non-blocking)
    const promises = jobIds.map(async (jobId) => {
        try {
            const jobData = await finetuningService.retrieveFineTuningJob(jobId)
            return { jobId, jobData, error: null }
        } catch (error: any) {
            logger.error(`[WS Status] Error retrieving job ${jobId}: ${error?.message || error}`)
            return { jobId, jobData: null, error: error?.message || 'Failed to retrieve job' }
        }
    })

    const results = await Promise.allSettled(promises)

    // Emit updates to subscribed clients
    results.forEach((result) => {
        if (result.status === 'rejected') {
            logger.error(`[WS Status] Promise rejected: ${result.reason}`)
            return
        }

        const { jobId, jobData, error } = result.value

        // Get subscribers for this job
        const subscribers = jobSubscriptions.get(jobId)
        if (!subscribers || subscribers.size === 0) return

        if (error || !jobData) {
            // Emit error to subscribers
            subscribers.forEach(socketId => {
                io.to(socketId).emit('job-status-error', {
                    jobId,
                    error: error || 'No data returned'
                })
            })
            return
        }

        // Normalize job data
        const normalizedJob = {
            id: jobData.id || jobData.job_id || jobData.fine_tuning_job_id || jobId,
            name: jobData.name || jobData.id || jobId,
            status: jobData.status || jobData.state || 'unknown',
            model: jobData.model || 'N/A',
            dataset: jobData.dataset || jobData.training_file || jobData.trainingFile || 'N/A',
            createdDate: jobData.createdDate || jobData.created_at || jobData.createdAt || new Date().toISOString(),
            // Include all original data
            ...jobData
        }

        // Emit update to all subscribers
        subscribers.forEach(socketId => {
            io.to(socketId).emit('job-status-update', normalizedJob)
        })

        // If job is no longer running, automatically unsubscribe after a delay
        const finalStatuses = ['succeeded', 'completed', 'failed', 'cancelled', 'canceled']
        if (finalStatuses.includes((normalizedJob.status || '').toLowerCase())) {
            // Delay cleanup slightly to allow any final events to be delivered
            setTimeout(() => {
                const subs = jobSubscriptions.get(jobId)
                if (subs) {
                    jobSubscriptions.delete(jobId)
                }
            }, 10000) // Keep sending updates for 10 more seconds, then clean up
        }
    })
}
