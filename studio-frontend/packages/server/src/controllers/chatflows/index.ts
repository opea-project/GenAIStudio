import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import apiKeyService from '../../services/apikey'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { createRateLimiter } from '../../utils/rateLimit'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { ChatflowType } from '../../Interface'
import chatflowsService from '../../services/chatflows'

const checkIfChatflowIsValidForStreaming = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsRouter.checkIfChatflowIsValidForStreaming - id not provided!`
            )
        }
        const apiResponse = await chatflowsService.checkIfChatflowIsValidForStreaming(req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const checkIfChatflowIsValidForUploads = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsRouter.checkIfChatflowIsValidForUploads - id not provided!`
            )
        }
        const apiResponse = await chatflowsService.checkIfChatflowIsValidForUploads(req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const deleteChatflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsRouter.deleteChatflow - id not provided!`)
        }
        const apiResponse = await chatflowsService.deleteChatflow(req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllChatflows = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const apiResponse = await chatflowsService.getAllChatflows(req.query?.type as ChatflowType)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getAllChatflowsbyUserId = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const apiResponse = await chatflowsService.getAllChatflowsbyUserId(req.query.userid as string, req.query.type as ChatflowType)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

// Get specific chatflow via api key
const getChatflowByApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.apikey) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsRouter.getChatflowByApiKey - apikey not provided!`
            )
        }
        const apikey = await apiKeyService.getApiKey(req.params.apikey)
        if (!apikey) {
            return res.status(401).send('Unauthorized')
        }
        const apiResponse = await chatflowsService.getChatflowByApiKey(apikey.id, req.query.keyonly)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getChatflowById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsRouter.getChatflowById - id not provided!`)
        }
        const apiResponse = await chatflowsService.getChatflowById(req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const saveChatflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsRouter.saveChatflow - body not provided!`)
        }
        const body = req.body
        const newChatFlow = new ChatFlow()
        Object.assign(newChatFlow, body)
        console.log ('newChatFlow', newChatFlow)
        const apiResponse = await chatflowsService.saveChatflow(newChatFlow)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const importChatflows = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const chatflows: Partial<ChatFlow>[] = req.body.Chatflows
        const apiResponse = await chatflowsService.importChatflows(chatflows)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const updateChatflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsRouter.updateChatflow - id not provided!`)
        }
        const chatflow = await chatflowsService.getChatflowById(req.params.id)
        if (!chatflow) {
            return res.status(404).send(`Chatflow ${req.params.id} not found`)
        }

        const body = req.body
        const updateChatFlow = new ChatFlow()
        Object.assign(updateChatFlow, body)

        updateChatFlow.id = chatflow.id
        createRateLimiter(updateChatFlow)

        const apiResponse = await chatflowsService.updateChatflow(chatflow, updateChatFlow)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getSinglePublicChatflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsRouter.getSinglePublicChatflow - id not provided!`
            )
        }
        const apiResponse = await chatflowsService.getSinglePublicChatflow(req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const getSinglePublicChatbotConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowsRouter.getSinglePublicChatbotConfig - id not provided!`
            )
        }
        const apiResponse = await chatflowsService.getSinglePublicChatbotConfig(req.params.id)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

const deployChatflowSandbox = async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log('Deploying chatflow sandbox')
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsRouter.deployChatflowSandbox - id not provided!`)
        }
        const deployResponse = await chatflowsService.deployChatflowSandboxService(req.params.id)
        console.log("deployResponse", deployResponse)
        if (deployResponse) {
            const chatflow = await chatflowsService.getChatflowById(req.params.id)
            if (chatflow) {
                const newData = {
                    sandboxStatus: deployResponse.status,
                    sandboxAppUrl: deployResponse.sandbox_app_url,
                    sandboxGrafanaUrl: deployResponse.sandbox_grafana_url
                }
                const updateChatflowObj = new ChatFlow()
                Object.assign(updateChatflowObj, newData)
                updateChatflowObj.id = chatflow.id
                createRateLimiter(updateChatflowObj)
                await chatflowsService.updateChatflow(chatflow, updateChatflowObj)
                return res.json(newData)
            }
        }
        return res.json({
            sandboxStatus: 'Error',
        })
    } catch (error) {
        next(error)
    }
}

const stopChatflowSandbox = async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log('Stopping chatlfow sandbox')
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsRouter.stopChatflowSandbox - id not provided!`)
        }
        const stopResponse = await chatflowsService.stopChatflowSandboxService(req.params.id)
        console.log("stopResponse", stopResponse)
        if (stopResponse) {
            const chatflow = await chatflowsService.getChatflowById(req.params.id)
            if (chatflow) {
                const newData = {
                    sandboxStatus: stopResponse.status,
                    sandboxAppUrl: '',
                    sandboxGrafanaUrl: ''
                }
                const updateChatflowObj = new ChatFlow()
                Object.assign(updateChatflowObj, newData)
                updateChatflowObj.id = chatflow.id
                createRateLimiter(updateChatflowObj)
                await chatflowsService.updateChatflow(chatflow, updateChatflowObj)
                return res.json(newData)
            }
        }
        return res.json({
            sandboxStatus: 'Error',
        })
    } catch (error) {
        next(error)
    }
}

const buildDeploymentPackage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log('Building Deployment Package')
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `Error: chatflowsRouter.buildDeploymentPackage - id not provided!`)
        }
        const buildResponse = await chatflowsService.buildDeploymentPackageService(req.params.id, req.body)
        // console.log("buildResponse", buildResponse)
        if (buildResponse) {
            res.setHeader('Content-Type', 'application/zip')
            res.setHeader('Content-Disposition', `attachment; filename="deployment-package.zip"`)
            res.send(buildResponse)
            res.end()
        }
    } catch (error) {
        next(error)
    }
}

export default {
    checkIfChatflowIsValidForStreaming,
    checkIfChatflowIsValidForUploads,
    deleteChatflow,
    getAllChatflows,
    getAllChatflowsbyUserId,
    getChatflowByApiKey,
    getChatflowById,
    saveChatflow,
    importChatflows,
    updateChatflow,
    getSinglePublicChatflow,
    getSinglePublicChatbotConfig,
    deployChatflowSandbox,
    stopChatflowSandbox,
    buildDeploymentPackage
}
