import { Server, Socket } from 'socket.io'
import finetuningService from '../services/finetuning'
import logger from '../utils/logger'

// Declare timer globals so this file compiles regardless of lib settings
declare function setTimeout(cb: (...args: any[]) => void, ms?: number): any
declare function clearTimeout(id: any): void

/**
 * Setup WebSocket handlers for fine-tuning output downloads
 * This allows non-blocking, asynchronous zip creation and download
 */
export const setupFineTuningDownloadHandlers = (io: Server) => {

    logger.info('[WS Download] Setting up fine-tuning download namespace: /finetuning-download')

    // Create a dedicated namespace so download sockets don't mix with other WS handlers
    const nsp = io.of('/finetuning-download')

    /**
     * In-memory tracking of ongoing download tasks so multiple sockets can
     * subscribe to the same job and reconnect (page refresh) without losing state.
     *
     * Map<jobId, {
     *   status: 'starting'|'zipping'|'complete'|'error',
     *   subscribers: Set<Socket>,
     *   downloadUrl?: string,
     *   fileName?: string,
     *   error?: string,
     *   timeoutHandle?: any
     * }>
     */
    const downloadTasks = new Map<string, any>()

    // Grace period to keep completed task info for late reconnects (ms)
    const COMPLETED_TASK_RETENTION_MS = 60 * 1000 // 60s

    nsp.on('connection', (socket: Socket) => {
        logger.info(`[WS Download] Client connected - Socket ID: ${socket.id}`)

        const attachSubscriber = (jobId: string) => {
            let task = downloadTasks.get(jobId)
            if (!task) {
                task = {
                    status: 'starting',
                    subscribers: new Set<Socket>(),
                    downloadUrl: null,
                    fileName: null,
                    error: null,
                    timeoutHandle: null
                }
                downloadTasks.set(jobId, task)
            }

            task.subscribers.add(socket)
            return task
        }

        // Handle fine-tuning output download request
        // Client sends: { jobId: string }
        socket.on('download-finetuning-output', async (data: { jobId: string }) => {
            try {
                const { jobId } = data
                logger.info(`[WS Download] Download requested - Socket ID: ${socket.id}, Job ID: ${jobId}`)

                if (!jobId) {
                    socket.emit('download-finetuning-error', {
                        jobId: null,
                        error: 'Job ID is required'
                    })
                    return
                }

                // Attach this socket as a subscriber for this job
                const task = attachSubscriber(jobId)

                // If task already completed, reply immediately with complete event
                if (task.status === 'complete') {
                    socket.emit('download-finetuning-complete', {
                        jobId,
                        downloadUrl: task.downloadUrl,
                        fileName: task.fileName
                    })
                    return
                }

                // Emit current progress state to the newly connected socket
                socket.emit('download-finetuning-progress', {
                    jobId,
                    status: task.status,
                    message: task.status === 'starting' ? 'Preparing download...' : 'Creating zip archive (this may take a few minutes)'
                })

                // If task is already zipping or starting and has a running promise, do nothing else
                if (task.promise) {
                    // existing background work will notify subscribers when done
                    return
                }

                // Kick off the async preparation and store the promise so others can join
                task.status = 'zipping'
                
                // Emit progress update to socket immediately
                socket.emit('download-finetuning-progress', {
                    jobId,
                    status: 'zipping',
                    message: 'Creating zip archive (this may take a few minutes)...'
                })
                
                task.promise = (async () => {
                    try {
                        // Call the service to prepare the zip file
                        const zipFilePath = await finetuningService.prepareFineTuningOutputZip(jobId)

                        if (!zipFilePath) {
                            task.status = 'error'
                            task.error = 'Failed to create output archive'
                            // Notify all subscribers
                            task.subscribers.forEach((s: Socket) => {
                                s.emit('download-finetuning-error', { jobId, error: task.error })
                            })
                            return
                        }

                        task.status = 'complete'
                        task.downloadUrl = `/api/v1/finetuning/download-ft/${jobId}`
                        task.fileName = `${jobId}-output.zip`

                        logger.info(`[WS Download] Download ready for job: ${jobId}`)

                        // Emit completion to all current subscribers
                        task.subscribers.forEach((s: Socket) => {
                            s.emit('download-finetuning-complete', {
                                jobId,
                                downloadUrl: task.downloadUrl,
                                fileName: task.fileName
                            })
                        })

                        // Schedule cleanup of the completed task after retention period
                        task.timeoutHandle = setTimeout(() => {
                            downloadTasks.delete(jobId)
                        }, COMPLETED_TASK_RETENTION_MS)

                    } catch (error: any) {
                        task.status = 'error'
                        task.error = error?.message || String(error)
                        logger.error(`[WS Download] Error preparing download for job ${jobId}: ${task.error}`)
                        task.subscribers.forEach((s: Socket) => {
                            s.emit('download-finetuning-error', { jobId, error: task.error })
                        })
                        // cleanup soon
                        task.timeoutHandle = setTimeout(() => {
                            downloadTasks.delete(jobId)
                        }, 5000)
                    }
                })()
            } catch (error: any) {
                const errorMessage = error?.message || String(error) || 'Unknown error'
                logger.error(`[WS Download] Handler error: ${errorMessage}`)
                socket.emit('download-finetuning-error', {
                    jobId: data?.jobId || null,
                    error: errorMessage
                })
            }
        })

        socket.on('disconnect', (reason: any) => {
            logger.info(`[WS Download] Client disconnected - Socket ID: ${socket.id}, Reason: ${reason}`)
            // Remove this socket from all task subscriber lists
            downloadTasks.forEach((task, jobId) => {
                if (task.subscribers && task.subscribers.has(socket)) {
                    task.subscribers.delete(socket)
                }
            })
        })

        logger.debug(`[WS Download] Fine-tuning download handlers attached to socket ${socket.id}`)
    })
}
