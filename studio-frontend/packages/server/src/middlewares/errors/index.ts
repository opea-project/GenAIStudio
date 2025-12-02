import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'

// we need eslint because we have to pass next arg for the error middleware
// eslint-disable-next-line
async function errorHandlerMiddleware(err: InternalFlowiseError, req: Request, res: Response, next: NextFunction) {
    // Safely read streaming flag from body (req.body may be undefined)
    const streamingFlag = req && (req as any).body ? (req as any).body.streaming : undefined

    // Build the response payload
    const displayedError = {
        statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
        success: false,
        message: err.message,
        // Provide error stack trace only in development
        stack: process.env.NODE_ENV === 'development' ? err.stack : {}
    }

    // Log the error server-side for easier debugging
    // Keep this server-side only; we still control what is returned to the client
    // eslint-disable-next-line no-console
    console.error('Unhandled error caught by errorHandlerMiddleware:', err)

    if (!streamingFlag || streamingFlag === 'false') {
        res.setHeader('Content-Type', 'application/json')
        res.status(displayedError.statusCode).json(displayedError)
    }
}

export default errorHandlerMiddleware
