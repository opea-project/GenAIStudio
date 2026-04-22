import { StatusCodes } from 'http-status-codes'
import fs from 'fs/promises'
import path from 'path'
import { ChatflowType, IReactFlowObject } from '../../Interface'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { ChatMessage } from '../../database/entities/ChatMessage'
import { ChatMessageFeedback } from '../../database/entities/ChatMessageFeedback'
import { UpsertHistory } from '../../database/entities/UpsertHistory'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { getAppVersion } from '../../utils'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import logger from '../../utils/logger'
import axios from 'axios'

const SAMPLE_WORKFLOWS_DIR = process.env.SAMPLE_WORKFLOWS_DIR || path.resolve(process.cwd(), '..', '..', 'sample-workflows')

const getStudioServerUrl = () => process.env.STUDIO_SERVER_URL || 'http://studio-backend.studio.svc.cluster.local:5000'

const loadLocalSampleChatflows = async (userid: string, type?: ChatflowType): Promise<Partial<ChatFlow>[]> => {
    const files = (await fs.readdir(SAMPLE_WORKFLOWS_DIR))
        .filter((fileName) => fileName.endsWith('.json'))
        .sort()

    const chatflows: Partial<ChatFlow>[] = []

    for (const fileName of files) {
        const filePath = path.join(SAMPLE_WORKFLOWS_DIR, fileName)
        const parsedFlowData = JSON.parse(await fs.readFile(filePath, 'utf8'))
        chatflows.push({
            userid,
            name: fileName.replace('.json', ''),
            flowData: JSON.stringify(parsedFlowData),
            type: type || 'OPEA',
            deployed: false,
            isPublic: false
        })
    }

    return chatflows
}

const deleteChatflow = async (chatflowId: string): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        // check for sandbox status
        const chatflow = await appServer.AppDataSource.getRepository(ChatFlow).findOneBy({ id: chatflowId })
        if (chatflow?.sandboxStatus === 'Getting Ready' || chatflow?.sandboxStatus === 'Ready') {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, `Chatflow ${chatflow.name} is currently running in sandbox. Please stop the sandbox before deleting the chatflow.`)
        }
        const dbResponse = await appServer.AppDataSource.getRepository(ChatFlow).delete({ id: chatflowId })
        try {
            // Delete all chat messages
            await appServer.AppDataSource.getRepository(ChatMessage).delete({ chatflowid: chatflowId })

            // Delete all chat feedback
            await appServer.AppDataSource.getRepository(ChatMessageFeedback).delete({ chatflowid: chatflowId })

            // Delete all upsert history
            await appServer.AppDataSource.getRepository(UpsertHistory).delete({ chatflowid: chatflowId })
        } catch (e) {
            logger.error(`[server]: Error deleting file storage for chatflow ${chatflowId}: ${e}`)
        }
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.deleteChatflow - ${getErrorMessage(error)}`
        )
    }
}

const getAllChatflows = async (type?: ChatflowType): Promise<ChatFlow[]> => {
    try {
        const appServer = getRunningExpressApp()
        const dbResponse = await appServer.AppDataSource.getRepository(ChatFlow).find()
        if (type === 'MULTIAGENT') {
            return dbResponse.filter((chatflow) => chatflow.type === 'MULTIAGENT')
        } else if (type === 'CHATFLOW') {
            // fetch all chatflows that are not agentflow
            return dbResponse.filter((chatflow) => chatflow.type === 'CHATFLOW' || !chatflow.type)
        } else if (type === 'OPEA') {
            // fetch all chatflows that are OPEAflow
            return dbResponse.filter((chatflow) => chatflow.type === 'OPEA')
        }
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.getAllChatflows - ${getErrorMessage(error)}`
        )
    }
}

const getAllChatflowsbyUserId = async (userid: string, type?: ChatflowType): Promise<ChatFlow[]> => {
    try {
        const appServer = getRunningExpressApp()
        
        // Use find with a where condition to filter by userid
        const dbResponse = await appServer.AppDataSource.getRepository(ChatFlow).find({
            where: {
                userid: userid,  // Filter by the specific userid
            },
        })
        
        // Filter further by type if needed
        if (type) {
            return dbResponse.filter((chatflow) => chatflow.type === type)
        }
        
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.getAllChatflows - ${getErrorMessage(error)}`
        )
    }
}

const importSampleChatflowsbyUserId = async (userid: string, type?: ChatflowType): Promise<ChatFlow[]> => {
    try {
        console.log('Importing sample chatflows for user:', userid)
        const chatflows = await loadLocalSampleChatflows(userid, type)
        logger.info(`[server]: Loaded ${chatflows.length} sample chatflows from local directory ${SAMPLE_WORKFLOWS_DIR}`)

        const insertResponse = await importChatflows(chatflows)
        return insertResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.importSampleChatflowsbyUserId - ${getErrorMessage(error)}`
        )
    }
}

const getChatflowByApiKey = async (apiKeyId: string, keyonly?: unknown): Promise<any> => {
    try {
        // Here we only get chatflows that are bounded by the apikeyid and chatflows that are not bounded by any apikey
        const appServer = getRunningExpressApp()
        let query = appServer.AppDataSource.getRepository(ChatFlow)
            .createQueryBuilder('cf')
            .where('cf.apikeyid = :apikeyid', { apikeyid: apiKeyId })
        if (keyonly === undefined) {
            query = query.orWhere('cf.apikeyid IS NULL').orWhere('cf.apikeyid = ""')
        }

        const dbResponse = await query.orderBy('cf.name', 'ASC').getMany()
        if (dbResponse.length < 1) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Chatflow not found in the database!`)
        }
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.getChatflowByApiKey - ${getErrorMessage(error)}`
        )
    }
}

const getChatflowById = async (chatflowId: string): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        const dbResponse = await appServer.AppDataSource.getRepository(ChatFlow).findOneBy({
            id: chatflowId
        })
        if (!dbResponse) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowId} not found in the database!`)
        }
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.getChatflowById - ${getErrorMessage(error)}`
        )
    }
}

const saveChatflow = async (newChatFlow: ChatFlow): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        const chatflow = appServer.AppDataSource.getRepository(ChatFlow).create(newChatFlow)
        const dbResponse = await appServer.AppDataSource.getRepository(ChatFlow).save(chatflow)
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.saveChatflow - ${getErrorMessage(error)}`
        )
    }
}

const importChatflows = async (newChatflows: Partial<ChatFlow>[]): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()

        // step 1 - check whether file chatflows array is zero
        if (newChatflows.length == 0) return

        // step 2 - check whether ids are duplicate in database
        let ids = '('
        let count: number = 0
        const lastCount = newChatflows.length - 1
        newChatflows.forEach((newChatflow) => {
            ids += `'${newChatflow.id}'`
            if (lastCount != count) ids += ','
            if (lastCount == count) ids += ')'
            count += 1
        })

        const selectResponse = await appServer.AppDataSource.getRepository(ChatFlow)
            .createQueryBuilder('cf')
            .select('cf.id')
            .where(`cf.id IN ${ids}`)
            .getMany()
        const foundIds = selectResponse.map((response) => {
            return response.id
        })

        // step 3 - remove ids that are only duplicate
        const prepChatflows: Partial<ChatFlow>[] = newChatflows.map((newChatflow) => {
            let id: string = ''
            if (newChatflow.id) id = newChatflow.id
            let flowData: string = ''
            if (newChatflow.flowData) flowData = newChatflow.flowData
            if (foundIds.includes(id)) {
                newChatflow.id = undefined
                newChatflow.name += ' (1)'
            }
            newChatflow.flowData = JSON.stringify(JSON.parse(flowData))
            return newChatflow
        })

        // step 4 - transactional insert array of entities
        const insertResponse = await appServer.AppDataSource.getRepository(ChatFlow).insert(prepChatflows)

        return insertResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.saveChatflows - ${getErrorMessage(error)}`
        )
    }
}

const updateChatflow = async (chatflow: ChatFlow, updateChatFlow: ChatFlow): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        const newDbChatflow = appServer.AppDataSource.getRepository(ChatFlow).merge(chatflow, updateChatFlow)
        const dbResponse = await appServer.AppDataSource.getRepository(ChatFlow).save(newDbChatflow)
        if (appServer.chatflowPool) {
            appServer.chatflowPool.updateInSync(chatflow.id, false)
        }
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.updateChatflow - ${getErrorMessage(error)}`
        )
    }
}

// Get specific chatflow via id (PUBLIC endpoint, used when sharing chatbot link)
const getSinglePublicChatflow = async (chatflowId: string): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        const dbResponse = await appServer.AppDataSource.getRepository(ChatFlow).findOneBy({
            id: chatflowId
        })
        if (dbResponse && dbResponse.isPublic) {
            return dbResponse
        } else if (dbResponse && !dbResponse.isPublic) {
            throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, `Unauthorized`)
        }
        throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowId} not found`)
    } catch (error) {
        if (error instanceof InternalFlowiseError && error.statusCode === StatusCodes.UNAUTHORIZED) {
            throw error
        } else {
            throw new InternalFlowiseError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: chatflowsService.getSinglePublicChatflow - ${getErrorMessage(error)}`
            )
        }
    }
}

// Get specific chatflow chatbotConfig via id (PUBLIC endpoint, used to retrieve config for embedded chat)
// Safe as public endpoint as chatbotConfig doesn't contain sensitive credential
const getSinglePublicChatbotConfig = async (chatflowId: string): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        const dbResponse = await appServer.AppDataSource.getRepository(ChatFlow).findOneBy({
            id: chatflowId
        })
        if (!dbResponse) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowId} not found`)
        }
        if (dbResponse.chatbotConfig) {
            try {
                return JSON.parse(dbResponse.chatbotConfig)
            } catch (e) {
                throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error parsing Chatbot Config for Chatflow ${chatflowId}`)
            }
        }
        return 'OK'
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.getSinglePublicChatbotConfig - ${getErrorMessage(error)}`
        )
    }
}


const generatePipelineJson = async(chatflowId: string) => {
    const chatflow = await getChatflowById(chatflowId)
    const nodes = JSON.parse(chatflow.flowData).nodes.map((node: any) => {
        const data = node.data
        // remove unnecessary fields
        delete data.label
        delete data.description
        delete data.selected
        delete data.tags
        delete data.baseClasses
        delete data.type
        delete data.icon
        delete data.filePath
        return data
    })
    chatflow.flowData = { "nodes": nodes }
    return chatflow
}

const deployChatflowSandboxService = async (chatflowId: string) => {
    console.log('deployChatflowSandboxService', chatflowId)
    try {
        const chatflow = await generatePipelineJson(chatflowId)
        const studioServerUrl = getStudioServerUrl()
        const deploySandboxEndpoint = 'studio-backend/deploy-sandbox'
        console.log('chatflow', JSON.stringify(chatflow))
        console.log('studioServerUrl', studioServerUrl)
        console.log('deploySandboxEndpoint', deploySandboxEndpoint)
        const response = await axios.post(`${studioServerUrl}/${deploySandboxEndpoint}`, JSON.stringify(chatflow), { 
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 60 * 1000 
        })
        return response.data
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(`Error: ${error.stack}`);
        } else {
            console.error(`An error occurred: ${error}`);
        }
    }
}

const stopChatflowSandboxService = async (chatflowId: string) => {
    console.log('stopChatflowSandboxService', chatflowId)
    try {
        const studioServerUrl = getStudioServerUrl()
        const deleteSandboxEndpoint = 'studio-backend/delete-sandbox'
        console.log('studioServerUrl', studioServerUrl)
        console.log('deleteSandboxEndpoint', deleteSandboxEndpoint)
        const response = await axios.post(`${studioServerUrl}/${deleteSandboxEndpoint}`, {"id": chatflowId}, { 
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 60 * 1000 
        })
        return response.data
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(`Error: ${error.stack}`);
        } else {
            console.error(`An error occurred: ${error}`);
        }
    }
}

const buildDeploymentPackageService = async (chatflowId: string, deploymentConfig: Record<string, any>) => {
    console.log('buildDeploymentPackageService', chatflowId, deploymentConfig)
    try {
        const chatflow = await generatePipelineJson(chatflowId)
        const studioServerUrl = getStudioServerUrl()
        const buildDeploymentPackageEndpoint = 'studio-backend/download-zip'
        console.log('chatflow', JSON.stringify(chatflow))
        console.log('studioServerUrl', studioServerUrl)
        console.log('buildDeploymentPackageEndpoint', buildDeploymentPackageEndpoint)
        const response = await axios.post(`${studioServerUrl}/${buildDeploymentPackageEndpoint}`, JSON.stringify(chatflow), { 
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 60 * 1000,
            responseType: 'arraybuffer'
        })
        return response.data
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(`Error: ${error.stack}`);
        } else {
            console.error(`An error occurred: ${error}`);
        }
    }
}

const oneClickDeploymentService = async (chatflowId: string, deploymentConfig: Record<string, any>) => {
    console.log('oneClickDeploymentService', chatflowId, deploymentConfig)
    try {
        const chatflow = await generatePipelineJson(chatflowId)
        const studioServerUrl = getStudioServerUrl()
        const endpoint = 'studio-backend/click-deployment'
        // console.log('chatflow', JSON.stringify(chatflow))
        // console.log('studioServerUrl', studioServerUrl)
        // console.log('deploymentConfig', deploymentConfig)
        
        // Update chatflow with deployment status and config from backend response
        const appServer = getRunningExpressApp()
        const chatflowEntity = await appServer.AppDataSource.getRepository(ChatFlow).findOneBy({ id: chatflowId })
        const response = await axios.post(`${studioServerUrl}/${endpoint}`, {
            remoteHost: deploymentConfig.hostname,
            remoteUser: deploymentConfig.username,
            pipelineFlow: chatflow
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 60 * 1000
        })
        if (chatflowEntity) {
            chatflowEntity.deploymentStatus = response.data.status
            chatflowEntity.deploymentConfig = JSON.stringify(deploymentConfig)
            chatflowEntity.deploymentLogs = JSON.stringify([response.data.message])
            await appServer.AppDataSource.getRepository(ChatFlow).save(chatflowEntity)
        }
        
        return response.data
    } catch (error: unknown) {
        // Update chatflow with error status
        const appServer = getRunningExpressApp()
        const chatflowEntity = await appServer.AppDataSource.getRepository(ChatFlow).findOneBy({ id: chatflowId })
        if (chatflowEntity) {
            chatflowEntity.deploymentStatus = 'Error'
            chatflowEntity.deploymentLogs = JSON.stringify([`Error: ${error instanceof Error ? error.message : String(error)}`])
            await appServer.AppDataSource.getRepository(ChatFlow).save(chatflowEntity)
        }
        
        if (error instanceof Error) {
            console.error(`Error: ${error.stack}`)
        } else {
            console.error(`An error occurred: ${error}`)
        }
        throw error
    }
}

const updateDeploymentStatus = async (chatflowId: string, status: string, message?: string, logs?: string[], config?: Record<string, any>) => {
    try {
        const appServer = getRunningExpressApp()
        const chatflow = await appServer.AppDataSource.getRepository(ChatFlow).findOneBy({ id: chatflowId })
        if (chatflow) {
            chatflow.deploymentStatus = status
            
            // Update logs array - either use provided logs or append message to existing logs
            let updatedLogs: string[] = []
            if (logs && logs.length > 0) {
                updatedLogs = logs
            } else {
                // Parse existing logs and append new message
                try {
                    const existingLogs = chatflow.deploymentLogs ? JSON.parse(chatflow.deploymentLogs) : []
                    updatedLogs = Array.isArray(existingLogs) ? existingLogs : []
                    if (message) {
                        updatedLogs.push(message)
                    }
                } catch (e) {
                    updatedLogs = message ? [message] : []
                }
            }
            chatflow.deploymentLogs = JSON.stringify(updatedLogs)
            
            if (config) {
                chatflow.deploymentConfig = JSON.stringify(config)
            }
            await appServer.AppDataSource.getRepository(ChatFlow).save(chatflow)
        }
        return chatflow
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowsService.updateDeploymentStatus - ${getErrorMessage(error)}`
        )
    }
}

export default {
    deleteChatflow,
    getAllChatflows,
    getAllChatflowsbyUserId,
    importSampleChatflowsbyUserId,
    getChatflowByApiKey,
    getChatflowById,
    saveChatflow,
    importChatflows,
    updateChatflow,
    getSinglePublicChatflow,
    deployChatflowSandboxService,
    stopChatflowSandboxService,
    buildDeploymentPackageService,
    oneClickDeploymentService,
    updateDeploymentStatus
}