import BuildDeploymentPackageDialog from '@/ui-component/dialog/BuildDeploymentPackageDialog'
import client from './client'

const getAllChatflows = () => client.get('/chatflows?type=CHATFLOW')

const getAllAgentflows = () => client.get('/chatflows?type=MULTIAGENT')

const getAllOpeaflows = () => client.get('/chatflows?type=OPEA')

const getUserOpeaflows = (userid) => client.get(`/chatflows?userid=${userid}&type=OPEA`)

const getSpecificChatflow = (id) => client.get(`/chatflows/${id}`)

const getSpecificChatflowFromPublicEndpoint = (id) => client.get(`/public-chatflows/${id}`)

const createNewChatflow = (body) => client.post(`/chatflows`, body)

const importChatflows = (body) => client.post(`/chatflows/importchatflows`, body)

const updateChatflow = (id, body) => client.put(`/chatflows/${id}`, body)

const deleteChatflow = (id) => client.delete(`/chatflows/${id}`)

const getIsChatflowStreaming = (id) => client.get(`/chatflows-streaming/${id}`)

const getAllowChatflowUploads = (id) => client.get(`/chatflows-uploads/${id}`)

const deploySandbox = (id) => client.post(`/chatflows-sandbox/deploy/${id}`)

const stopSandbox = (id) => client.post(`/chatflows-sandbox/stop/${id}`)

const buildDeploymentPackage = (id, body) => client.post(`chatflows-sandbox/build-deployment-package/${id}`, body, {responseType: "arraybuffer"})

export default {
    getAllChatflows,
    getAllAgentflows,
    getAllOpeaflows,
    getUserOpeaflows,
    getSpecificChatflow,
    getSpecificChatflowFromPublicEndpoint,
    createNewChatflow,
    importChatflows,
    updateChatflow,
    deleteChatflow,
    getIsChatflowStreaming,
    getAllowChatflowUploads,
    deploySandbox,
    stopSandbox,
    buildDeploymentPackage
}
