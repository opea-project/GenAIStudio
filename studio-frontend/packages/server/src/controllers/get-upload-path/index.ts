import { Request, Response, NextFunction } from 'express'
import path from 'path'

const getUserHome = (): string => process.env.HOME || process.cwd()

const getStoragePath = (): string => {
    return process.env.BLOB_STORAGE_PATH
        ? path.join(process.env.BLOB_STORAGE_PATH)
        : path.join(getUserHome(), '.flowise', 'storage')
}

const getPathForUploads = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const apiResponse = {
            storagePath: getStoragePath()
        }
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    getPathForUploads
}
