import { useState } from 'react'
import { useDispatch } from 'react-redux'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

import { styled, alpha } from '@mui/material/styles'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import EditIcon from '@mui/icons-material/Edit'
import FileCopyIcon from '@mui/icons-material/FileCopy'
import IosShareIcon from '@mui/icons-material/IosShare'
import FileDeleteIcon from '@mui/icons-material/Delete'
import Button from '@mui/material/Button'
import { IconX } from '@tabler/icons-react'

import chatflowsApi from '@/api/chatflows'
import useApi from '@/hooks/useApi'
import useConfirm from '@/hooks/useConfirm'
import { uiBaseURL } from '@/store/constant'
import { closeSnackbar as closeSnackbarAction, enqueueSnackbar as enqueueSnackbarAction } from '@/store/actions'

import SaveChatflowDialog from '@/ui-component/dialog/SaveChatflowDialog'
import TagDialog from '@/ui-component/dialog/TagDialog'
import StarterPromptsDialog from '@/ui-component/dialog/StarterPromptsDialog'
import { generateExportFlowData } from '@/utils/genericHelper'
import useNotifier from '@/utils/useNotifier'
import ChatFeedbackDialog from '../dialog/ChatFeedbackDialog'
import AllowedDomainsDialog from '../dialog/AllowedDomainsDialog'
import SpeechToTextDialog from '../dialog/SpeechToTextDialog'
import ExportAsTemplateDialog from '@/ui-component/dialog/ExportAsTemplateDialog'
import { Settings } from '@mui/icons-material'

const StyledMenu = styled((props) => (
    <Menu
        elevation={0}
        anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right'
        }}
        transformOrigin={{
            vertical: 'top',
            horizontal: 'right'
        }}
        {...props}
    />
))(({ theme }) => ({
    '& .MuiPaper-root': {
        borderRadius: 6,
        marginTop: theme.spacing(1),
        minWidth: 180,
        boxShadow:
            'rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
        '& .MuiMenu-list': {
            padding: '4px 0'
        },
        '& .MuiMenuItem-root': {
            '& .MuiSvgIcon-root': {
                fontSize: 18,
                color: theme.palette.text.secondary,
                marginRight: theme.spacing(1.5)
            },
            '&:active': {
                backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity)
            }
        }
    }
}))

export default function FlowListMenu({ chatflow, isAgentCanvas, setError, updateFlowsApi, sandboxStatus, updateSandboxStatus }) {
    const { t } = useTranslation()
    const { confirm } = useConfirm()
    const dispatch = useDispatch()
    const updateChatflowApi = useApi(chatflowsApi.updateChatflow)

    useNotifier()
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [flowDialogOpen, setFlowDialogOpen] = useState(false)
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
    const [categoryDialogProps, setCategoryDialogProps] = useState({})
    const [anchorEl, setAnchorEl] = useState(null)
    const open = Boolean(anchorEl)
    const [conversationStartersDialogOpen, setConversationStartersDialogOpen] = useState(false)
    const [conversationStartersDialogProps, setConversationStartersDialogProps] = useState({})
    const [chatFeedbackDialogOpen, setChatFeedbackDialogOpen] = useState(false)
    const [chatFeedbackDialogProps, setChatFeedbackDialogProps] = useState({})
    const [allowedDomainsDialogOpen, setAllowedDomainsDialogOpen] = useState(false)
    const [allowedDomainsDialogProps, setAllowedDomainsDialogProps] = useState({})
    const [speechToTextDialogOpen, setSpeechToTextDialogOpen] = useState(false)
    const [speechToTextDialogProps, setSpeechToTextDialogProps] = useState({})
    const [exportTemplateDialogOpen, setExportTemplateDialogOpen] = useState(false)
    const [exportTemplateDialogProps, setExportTemplateDialogProps] = useState({})

    const title = isAgentCanvas ? t('flowlist.agent', 'Agent') : t('flowlist.chatflow', 'Chatflow')

    const handleClick = (event) => setAnchorEl(event.currentTarget)
    const handleClose = () => setAnchorEl(null)

    const handleFlowRename = () => {
        setAnchorEl(null)
        setFlowDialogOpen(true)
    }

    const handleExportTemplate = () => {
        setAnchorEl(null)
        setExportTemplateDialogProps({
            chatflow: chatflow
        })
        setExportTemplateDialogOpen(true)
    }

    const handleFlowStarterPrompts = () => {
        setAnchorEl(null)
        setConversationStartersDialogProps({
            title: t('flowlist.starterPrompts', { name: chatflow.name }),
            chatflow: chatflow
        })
        setConversationStartersDialogOpen(true)
    }

    const handleFlowChatFeedback = () => {
        setAnchorEl(null)
        setChatFeedbackDialogProps({
            title: t('flowlist.chatFeedback', { name: chatflow.name }),
            chatflow: chatflow
        })
        setChatFeedbackDialogOpen(true)
    }

    const handleAllowedDomains = () => {
        setAnchorEl(null)
        setAllowedDomainsDialogProps({
            title: t('flowlist.allowedDomains', { name: chatflow.name }),
            chatflow: chatflow
        })
        setAllowedDomainsDialogOpen(true)
    }

    const handleSpeechToText = () => {
        setAnchorEl(null)
        setSpeechToTextDialogProps({
            title: t('flowlist.speechToText', { name: chatflow.name }),
            chatflow: chatflow
        })
        setSpeechToTextDialogOpen(true)
    }

    const saveFlowRename = async (chatflowName) => {
        const updateBody = {
            name: chatflowName,
            chatflow
        }
        try {
            await updateChatflowApi.request(chatflow.id, updateBody)
            await updateFlowsApi.request()
        } catch (error) {
            if (setError) setError(error)
            enqueueSnackbar({
                message: typeof error.response.data === 'object' ? error.response.data.message : error.response.data,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
        }
    }

    const handleDelete = async () => {
        setAnchorEl(null)
        const confirmPayload = {
            title: t('flowlist.delete'),
            description: t('flowlist.deleteConfirm', { name: chatflow.name }),
            confirmButtonName: t('flowlist.delete'),
            cancelButtonName: t('flowlist.cancel')
        }
        const isConfirmed = await confirm(confirmPayload)

        if (isConfirmed) {
            try {
                await chatflowsApi.deleteChatflow(chatflow.id)
                await updateFlowsApi.request()
            } catch (error) {
                if (setError) setError(error)
                enqueueSnackbar({
                    message: typeof error.response.data === 'object' ? error.response.data.message : error.response.data,
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'error',
                        persist: true,
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
            }
        }
    }

    const handleDuplicate = () => {
        setAnchorEl(null)
        try {
            // Store both the flow data and type information
            const duplicatedData = {
                flowData: chatflow.flowData,
                type: chatflow.type || (isAgentCanvas ? 'MULTIAGENT' : 'CHATFLOW')
            }
            localStorage.setItem('duplicatedFlowData', JSON.stringify(duplicatedData))
            
            // Determine canvas type based on original chatflow type
            const targetCanvas = chatflow.type === 'OPEA' ? 'opeacanvas' : 
                                chatflow.type === 'MULTIAGENT' ? 'agentcanvas' : 'canvas'
            window.open(`${uiBaseURL}/${targetCanvas}`, '_blank')
        } catch (e) {
            console.error(e)
        }
    }

    const handleExport = () => {
        setAnchorEl(null)
        try {
            const flowData = JSON.parse(chatflow.flowData)
            let dataStr = JSON.stringify(generateExportFlowData(flowData), null, 2)
            let dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
            let exportFileDefaultName = `${chatflow.name} ${title}.json`
            let linkElement = document.createElement('a')
            linkElement.setAttribute('href', dataUri)
            linkElement.setAttribute('download', exportFileDefaultName)
            linkElement.click()
        } catch (e) {
            console.error(e)
        }
    }

    const handleFlowCategory = () => {
        setAnchorEl(null)
        if (chatflow.category) {
            setCategoryDialogProps({
                category: chatflow.category.split(';')
            })
        }
        setCategoryDialogOpen(true)
    }

    const saveFlowCategory = async (categories) => {
        setCategoryDialogOpen(false)
        const categoryTags = categories.join(';')
        const updateBody = {
            category: categoryTags,
            chatflow
        }
        try {
            await updateChatflowApi.request(chatflow.id, updateBody)
            await updateFlowsApi.request()
        } catch (error) {
            if (setError) setError(error)
            enqueueSnackbar({
                message: typeof error.response.data === 'object' ? error.response.data.message : error.response.data,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
        }
    }

    return (
        <div>
            <Button
                id='demo-customized-button'
                aria-controls={open ? 'demo-customized-menu' : undefined}
                aria-haspopup='true'
                aria-expanded={open ? 'true' : undefined}
                disableElevation
                onClick={handleClick}
                startIcon={<Settings />}
            />
            <StyledMenu
                id='demo-customized-menu'
                MenuListProps={{
                    'aria-labelledby': 'demo-customized-button'
                }}
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
            >
                <MenuItem onClick={handleFlowRename} disableRipple>
                    <EditIcon />
                    {t('flowlist.rename')}
                </MenuItem>
                <MenuItem onClick={handleDuplicate} disableRipple>
                    <FileCopyIcon />
                    {t('flowlist.duplicate')}
                </MenuItem>
                <MenuItem onClick={handleExport} disableRipple>
                    <IosShareIcon />
                    {t('flowlist.export')}
                </MenuItem>
                <MenuItem onClick={handleDelete} disableRipple>
                    <FileDeleteIcon />
                    {t('flowlist.delete')}
                </MenuItem>
                {/* 下面如果需要可继续添加菜单项，如StarterPrompts、AllowedDomains、SpeechToText等 */}
            </StyledMenu>
            <SaveChatflowDialog
                show={flowDialogOpen}
                dialogProps={{
                    title: `${t('flowlist.rename')} ${title}`,
                    confirmButtonName: t('flowlist.rename'),
                    cancelButtonName: t('flowlist.cancel')
                }}
                onCancel={() => setFlowDialogOpen(false)}
                onConfirm={saveFlowRename}
            />
            <TagDialog
                isOpen={categoryDialogOpen}
                dialogProps={{
                    ...categoryDialogProps,
                    title: t('flowlist.setCategory'),
                    confirmButtonName: t('flowlist.save'),
                    cancelButtonName: t('flowlist.cancel')
                }}
                onClose={() => setCategoryDialogOpen(false)}
                onSubmit={saveFlowCategory}
            />
            <StarterPromptsDialog
                show={conversationStartersDialogOpen}
                dialogProps={{
                    ...conversationStartersDialogProps,
                    confirmButtonName: t('flowlist.ok'),
                    cancelButtonName: t('flowlist.cancel')
                }}
                onCancel={() => setConversationStartersDialogOpen(false)}
            />
            <ChatFeedbackDialog
                show={chatFeedbackDialogOpen}
                dialogProps={{
                    ...chatFeedbackDialogProps,
                    confirmButtonName: t('flowlist.ok'),
                    cancelButtonName: t('flowlist.cancel')
                }}
                onCancel={() => setChatFeedbackDialogOpen(false)}
            />
            <AllowedDomainsDialog
                show={allowedDomainsDialogOpen}
                dialogProps={{
                    ...allowedDomainsDialogProps,
                    confirmButtonName: t('flowlist.ok'),
                    cancelButtonName: t('flowlist.cancel')
                }}
                onCancel={() => setAllowedDomainsDialogOpen(false)}
            />
            <SpeechToTextDialog
                show={speechToTextDialogOpen}
                dialogProps={{
                    ...speechToTextDialogProps,
                    confirmButtonName: t('flowlist.ok'),
                    cancelButtonName: t('flowlist.cancel')
                }}
                onCancel={() => setSpeechToTextDialogOpen(false)}
            />
            <ExportAsTemplateDialog
                show={exportTemplateDialogOpen}
                dialogProps={{
                    ...exportTemplateDialogProps,
                    confirmButtonName: t('flowlist.export'),
                    cancelButtonName: t('flowlist.cancel')
                }}
                onCancel={() => setExportTemplateDialogOpen(false)}
            />
        </div>
    )
}

FlowListMenu.propTypes = {
    chatflow: PropTypes.object,
    isAgentCanvas: PropTypes.bool,
    setError: PropTypes.func,
    updateFlowsApi: PropTypes.object
}
