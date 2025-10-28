import { Server, Socket } from 'socket.io'
import finetuningService from '../services/finetuning'
import logger from '../utils/logger'

/**
 * Setup WebSocket handlers for fine-tuning output downloads
 * This allows non-blocking, asynchronous zip creation and download
 */
export const setupFineTuningDownloadHandlers = (io: Server) => {
    logger.info('[WS] Setting up fine-tuning download handlers')
    
    io.on('connection', (socket: Socket) => {
        logger.info(`[WS] Client connected - Socket ID: ${socket.id}`)
        
        /**
         * Handle fine-tuning output download request
         * Client sends: { jobId: string }
         * Server emits progress updates and final download URL
         */
        socket.on('download-finetuning-output', async (data: { jobId: string }) => {
            try {
                const { jobId } = data

                if (!jobId) {
                    socket.emit('download-finetuning-error', {
                        jobId: null,
                        error: 'Job ID is required'
                    })
                    return
                }

                logger.info(`[WS] Starting download preparation for job: ${jobId}`)
                
                // Emit starting status
                socket.emit('download-finetuning-progress', {
                    jobId,
                    status: 'starting',
                    message: 'Preparing download...'
                })

                // Call the service to prepare the zip file
                // This may take time, so we do it asynchronously
                const zipFilePath = await finetuningService.downloadFineTuningOutput(jobId)

                if (!zipFilePath) {
                    socket.emit('download-finetuning-error', {
                        jobId,
                        error: 'Failed to create output archive'
                    })
                    return
                }

                logger.info(`[WS] Download ready for job: ${jobId}`)

                // Emit completion with download URL
                socket.emit('download-finetuning-complete', {
                    jobId,
                    downloadUrl: `/api/v1/finetuning/download-ft/${jobId}`,
                    fileName: `${jobId}-output.zip`
                })

            } catch (error: any) {
                const errorMessage = error?.message || String(error) || 'Unknown error'
                logger.error(`[WS] Error preparing download: ${errorMessage}`)
                
                socket.emit('download-finetuning-error', {
                    jobId: data?.jobId || null,
                    error: errorMessage
                })
            }
        })

        socket.on('disconnect', (reason) => {
            logger.info(`[WS] Client disconnected - Socket ID: ${socket.id}, Reason: ${reason}`)
        })

        logger.debug(`[WS] Fine-tuning download handlers attached to socket ${socket.id}`)
    })
}
