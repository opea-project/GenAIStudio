import { Request, Response, NextFunction } from 'express'
import fs from 'fs'
import path from 'path'
import contentDisposition from 'content-disposition'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'

const getStoragePath = (): string => {
    return process.env.BLOB_STORAGE_PATH
        ? path.join(process.env.BLOB_STORAGE_PATH)
        : path.join(getUserHome(), '.flowise', 'storage')
}

const getUserHome = (): string => {
    return process.env.HOME || process.cwd()
}

interface AuthenticatedRequest extends Request {
    user?: {
        activeOrganizationId?: string
    }
}

const streamUploadedFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.query.chatflowId || !req.query.chatId || !req.query.fileName) {
            return res.status(500).send(`Invalid file path`)
        }
        const chatflowId = req.query.chatflowId as string
        const chatId = req.query.chatId as string
        const fileName = req.query.fileName as string
        const filePath = path.join(getStoragePath(), chatflowId, chatId, fileName)
        if (!fs.existsSync(filePath)) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `File not found`)
        }
        res.setHeader('Content-Disposition', contentDisposition(fileName))
        const fileStream = fs.createReadStream(filePath)
        fileStream.pipe(res)
    } catch (error) {
        next(error)
    }
}

export default {
    streamUploadedFile
}
