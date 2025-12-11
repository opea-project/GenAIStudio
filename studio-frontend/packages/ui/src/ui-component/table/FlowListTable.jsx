import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import moment from 'moment'
import { styled } from '@mui/material/styles'
import {
    Button,
    CircularProgress,
    Paper,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    Tooltip,
    Typography,
    Menu,
    MenuItem,
    useTheme
} from '@mui/material'
import { tableCellClasses } from '@mui/material/TableCell'
import FlowListMenu from '../button/FlowListMenu'
import { Link } from 'react-router-dom'
import {
    OpenInNew,
    StopCircleOutlined,
    PlayCircleOutline,
    Analytics,
    ViewTimelineOutlined,
    InstallDesktopOutlined,
    TroubleshootOutlined,
    TerminalOutlined
} from '@mui/icons-material'
import BuildDeploymentPackageDialog from '../dialog/BuildDeploymentPackageDialog'
import OneClickDeploymentDialog from '../dialog/OneClickDeploymentDialog'
import chatflowsApi from '@/api/chatflows'
import config from '@/config'
import { useTranslation } from 'react-i18next'

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: theme.palette.grey[900] + 25,
    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.grey[900]
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14,
        height: 64
    }
}))

const StyledTableRow = styled(TableRow)(() => ({
    '&:last-child td, &:last-child th': { border: 0 }
}))

const getLocalStorageKeyName = (name, isAgentCanvas) => {
    return (isAgentCanvas ? 'agentcanvas' : 'chatflowcanvas') + '_' + name
}

export const FlowListTable = ({
    data,
    images,
    isLoading,
    filterFunction,
    updateFlowsApi,
    setError,
    isAgentCanvas,
    isOpeaCanvas,
    stopSandboxApi,
    updateFlowToServerApi,
    userRole
}) => {
    const { t } = useTranslation()
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    setError = (error) => {
        console.error(error)
    }

    const localStorageKeyOrder = getLocalStorageKeyName('order', isAgentCanvas)
    const localStorageKeyOrderBy = getLocalStorageKeyName('orderBy', isAgentCanvas)
    const [order, setOrder] = useState(localStorage.getItem(localStorageKeyOrder) || 'desc')
    const [orderBy, setOrderBy] = useState(localStorage.getItem(localStorageKeyOrderBy) || 'updatedDate')
    const [sortedData, setSortedData] = useState([])

    const [buildDeploymentPackageDialogOpen, setBuildDeploymentPackageDialogOpen] = useState(false)
    const [buildDeploymentPackageDialogProps, setBuildDeploymentPackageDialogProps] = useState({})

    const [oneClickDeploymentDialogOpen, setOneClickDeploymentDialogOpen] = useState(false)
    const [oneClickDeploymentDialogProps, setOneClickDeploymentDialogProps] = useState({})

    const [deployStatusById, setDeployStatusById] = useState({})
    const [deployConfigById, setDeployConfigById] = useState({})
    const [deployWebSocketsById, setDeployWebSocketsById] = useState({})

    const [observabilityAnchorEl, setObservabilityAnchorEl] = useState(null)
    const [observabilityRow, setObservabilityRow] = useState(null)

    const sandboxStatusText = (status) => {
        if (status === 'Not Running') return t('flowlist.notRunning')
        if (status === 'Ready') return t('flowlist.ready')
        if (status === 'Getting Ready') return t('flowlist.gettingReady')
        if (status === 'Stopping') return t('flowlist.stopping')
        if (status === 'Error') return t('flowlist.error')
        return status
    }

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc'
        const newOrder = isAsc ? 'desc' : 'asc'
        setOrder(newOrder)
        setOrderBy(property)
        localStorage.setItem(localStorageKeyOrder, newOrder)
        localStorage.setItem(localStorageKeyOrderBy, property)
    }

    const handleSortData = () => {
        if (!data) return []
        return [...data]
            .map((row) => ({
                ...row,
                sandboxStatus: row.sandboxStatus || 'Not Running'
            }))
            .sort((a, b) => {
                if (orderBy === 'name') {
                    return order === 'asc'
                        ? (a.name || '').localeCompare(b.name || '')
                        : (b.name || '').localeCompare(a.name || '')
                } else if (orderBy === 'updatedDate') {
                    return order === 'asc'
                        ? new Date(a.updatedDate) - new Date(b.updatedDate)
                        : new Date(b.updatedDate) - new Date(a.updatedDate)
                }
                return 0
            })
    }

    useEffect(() => {
        setSortedData(handleSortData())
    }, [data, order, orderBy])

    const setDeployStatusForId = (id, status) => {
        setDeployStatusById((prev) => ({ ...prev, [id]: status }))
    }

    const setDeployConfigForId = (id, config) => {
        setDeployConfigById((prev) => ({ ...prev, [id]: config }))
    }

    const setDeployWebSocketForId = (id, ws) => {
        setDeployWebSocketsById((prev) => ({ ...prev, [id]: ws }))
    }

    const updateSandboxStatus = (
        id,
        newStatus,
        sandboxAppUrl = null,
        sandboxGrafanaUrl = null,
        sandboxTracerUrl = null,
        sandboxDebugLogsUrl = null
    ) => {
        setSortedData((prevData) =>
            prevData.map((row) =>
                row.id === id
                    ? {
                          ...row,
                          sandboxStatus: newStatus,
                          sandboxAppUrl: sandboxAppUrl || row.sandboxAppUrl,
                          sandboxGrafanaUrl: sandboxGrafanaUrl || row.sandboxGrafanaUrl,
                          sandboxTracerUrl: sandboxTracerUrl || row.sandboxTracerUrl,
                          sandboxDebugLogsUrl: sandboxDebugLogsUrl || row.sandboxDebugLogsUrl
                      }
                    : row
            )
        )
    }

    const updateDeploymentStatus = (id, newStatus, deploymentConfig = null, deploymentLogs = null) => {
        setSortedData((prevData) =>
            prevData.map((row) =>
                row.id === id
                    ? {
                          ...row,
                          deploymentStatus: newStatus,
                          deploymentConfig: deploymentConfig || row.deploymentConfig,
                          deploymentLogs: deploymentLogs || row.deploymentLogs
                      }
                    : row
            )
        )
    }

    const handleRunSandbox = async (id) => {
        updateSandboxStatus(id, 'Sending Request')
        const res = await chatflowsApi.deploySandbox(id)
        updateSandboxStatus(
            id,
            res.data?.sandboxStatus || 'Error',
            res.data?.sandboxAppUrl,
            res.data?.sandboxGrafanaUrl,
            res.data?.sandboxTracerUrl,
            res.data?.sandboxDebugLogsUrl
        )
    }

    const handleStopSandbox = async (id) => {
        updateSandboxStatus(id, 'Sending Request')
        const res = await stopSandboxApi(id)
        try {
            if (res.data?.sandboxStatus) {
                updateSandboxStatus(id, res.data?.sandboxStatus)
            } else {
                throw new Error('Failed to stop sandbox')
            }
        } catch (error) {
            setError(error)
        }
    }

    const downloadDeploymentPackage = async (id, deploymentConfig) => {
        try {
            const response = await chatflowsApi.buildDeploymentPackage(id, deploymentConfig, {
                responseType: 'arraybuffer'
            })
            const blob = new Blob([response.data], { type: 'application/zip' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.style.display = 'none'
            a.href = url
            a.download = `deployment_package_${id}.zip`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Error downloading deployment package:', error)
            setError(error)
        }
        setBuildDeploymentPackageDialogOpen(false)
    }

    const handleBuildDeploymentPackage = (id) => {
        setBuildDeploymentPackageDialogProps({ id })
        setBuildDeploymentPackageDialogOpen(true)
    }

    const startClickDeploymentMonitoring = useCallback(
        (id, deploymentConfig) => {
            if (deployWebSocketsById[id]) {
                deployWebSocketsById[id].close()
            }

            const wsUrl = `${window.location.origin.replace(/^http/, 'ws')}/studio-backend/ws/monitor-click-deployment`
            const wsInstance = new WebSocket(wsUrl)

            setDeployWebSocketForId(id, wsInstance)

            wsInstance.onopen = () => {
                console.log('[WS] Connected for click deployment monitoring', id)
                wsInstance.send(
                    JSON.stringify({
                        hostname: deploymentConfig.hostname,
                        username: deploymentConfig.username,
                        chatflow_id: id
                    })
                )
            }

            wsInstance.onmessage = (event) => {
                let data
                try {
                    data = JSON.parse(event.data)
                } catch {
                    return
                }

                console.log('[WS] Click deployment message:', data)

                if (data.status === 'Success') {
                    setDeployStatusForId(id, ['Success', data.message])
                    updateDeploymentStatus(id, 'Success', null, JSON.stringify([data.message]))
                    chatflowsApi
                        .updateDeploymentStatus(id, {
                            status: 'Success',
                            message: data.message,
                            logs: [data.message]
                        })
                        .catch((error) => {
                            console.error('Failed to update deployment status in database:', error)
                        })
                    wsInstance.close()
                    setDeployWebSocketForId(id, null)
                } else if (data.status === 'Error') {
                    const errorMessage = data.message
                    setDeployStatusForId(id, ['Error', errorMessage])
                    updateDeploymentStatus(id, 'Error', null, JSON.stringify([errorMessage]))
                    chatflowsApi
                        .updateDeploymentStatus(id, {
                            status: 'Error',
                            message: errorMessage,
                            logs: [errorMessage]
                        })
                        .catch((error) => {
                            console.error('Failed to update deployment status in database:', error)
                        })
                    wsInstance.close()
                    setDeployWebSocketForId(id, null)
                } else if (data.status === 'In Progress') {
                    const progressMessage = data.message || 'Deployment in progress...'
                    const logs = data.logs || []
                    const logText = logs.length > 0 ? logs.join('\n') : progressMessage
                    setDeployStatusForId(id, ['Info', logText])

                    if (logs.length > 0) {
                        chatflowsApi
                            .updateDeploymentStatus(id, {
                                status: 'In Progress',
                                message: progressMessage,
                                logs
                            })
                            .catch((error) => {
                                console.error('Failed to update In Progress deployment status:', error)
                            })
                    }
                }
            }

            wsInstance.onerror = (error) => {
                console.error('[WS] Click deployment error:', error)
                setDeployStatusForId(id, ['Error', 'Connection error during deployment monitoring'])
                wsInstance.close()
                setDeployWebSocketForId(id, null)
            }

            wsInstance.onclose = (event) => {
                console.log(
                    `[WS] Click deployment closed: code=${event.code}, reason='${event.reason}', wasClean=${event.wasClean}`
                )
                setDeployWebSocketForId(id, null)

                if (event.code !== 1000 && event.code !== 1001) {
                    console.log('[WS] Abnormal closure detected, checking deployment status...')
                    setTimeout(async () => {
                        try {
                            const response = await chatflowsApi.getSpecificChatflow(id)
                            if (response.data && response.data.deploymentStatus === 'In Progress') {
                                setDeployStatusForId(id, ['Error', 'Connection lost during deployment'])
                                updateDeploymentStatus(id, 'Error', null, JSON.stringify(['Connection lost during deployment']))
                                chatflowsApi
                                    .updateDeploymentStatus(id, {
                                        status: 'Error',
                                        message: 'Connection lost during deployment',
                                        logs: ['Connection lost during deployment']
                                    })
                                    .catch((error) => {
                                        console.error('Failed to update deployment status in database:', error)
                                    })
                            } else if (response.data && response.data.deploymentStatus) {
                                const finalStatus = response.data.deploymentStatus
                                const logs = response.data.deploymentLogs
                                    ? JSON.parse(response.data.deploymentLogs)
                                    : [finalStatus === 'Success' ? 'Deployment completed successfully' : 'Deployment failed']
                                const message =
                                    logs[0] ||
                                    (finalStatus === 'Success'
                                        ? 'Deployment completed successfully'
                                        : 'Deployment failed')
                                setDeployStatusForId(id, [finalStatus, message])
                                updateDeploymentStatus(id, finalStatus, null, JSON.stringify(logs))
                            }
                        } catch (error) {
                            console.error('Failed to check final deployment status:', error)
                            setDeployStatusForId(id, ['Error', 'Connection lost during deployment'])
                            updateDeploymentStatus(id, 'Error', null, JSON.stringify(['Connection lost during deployment']))
                        }
                    }, 1000)
                }
            }

            return wsInstance
        },
        [deployWebSocketsById]
    )

    const oneClickDeployment = async (id, deploymentConfig) => {
        try {
            updateDeploymentStatus(id, 'In Progress', JSON.stringify(deploymentConfig), JSON.stringify(['Deployment initiated...']))

            await chatflowsApi
                .updateDeploymentStatus(id, {
                    status: 'In Progress',
                    message: 'Deployment initiated...',
                    logs: ['Deployment initiated...']
                })
                .catch((error) => {
                    console.error('Failed to update deployment status before API call:', error)
                })

            setDeployStatusForId(id, ['Info', 'Deployment initiated...'])

            const response = await chatflowsApi.clickDeployment(id, deploymentConfig)

            if (response.data && !response.data.error) {
                startClickDeploymentMonitoring(id, deploymentConfig)
            }

            return response.data
        } catch (error) {
            setDeployStatusForId(id, ['Error', error?.message || 'Failed to start deployment'])
            updateDeploymentStatus(id, 'Error', null, JSON.stringify([error?.message || 'Failed to start deployment']))
            return { error: error?.message || 'Deployment failed' }
        }
    }

    const handleOneClickDeployment = (id) => {
        if (oneClickDeploymentDialogProps.id !== id) {
            setOneClickDeploymentDialogProps({})
            setOneClickDeploymentDialogOpen(false)
            setTimeout(() => {
                setOneClickDeploymentDialogProps({ id })
                setOneClickDeploymentDialogOpen(true)
            }, 0)
        } else {
            setOneClickDeploymentDialogProps({ id })
            setOneClickDeploymentDialogOpen(true)
        }
    }

    const handleOpenUrl = (url) => {
        window.open(url, '_blank')
    }

    useEffect(() => {
        const openConnections = []

        const openWebSocketConnection = (id, status) => {
            const wsEndpoint = config.sandbox_status_endpoint
            const ws = new WebSocket(`${config.studio_server_url}/${wsEndpoint}`)

            ws.onopen = () => {
                const payload = JSON.stringify({ id, status })
                ws.send(payload)
            }

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data)
                if (['Done', 'Error', 'Not Running', 'Ready'].includes(data.status)) {
                    ws.close()
                    openConnections.splice(openConnections.indexOf(ws), 1)
                    updateSandboxStatus(
                        id,
                        data.status,
                        data.sandbox_app_url,
                        data.sandbox_grafana_url,
                        data.sandbox_tracer_url,
                        data.sandbox_debuglogs_url
                    )
                    if (updateFlowToServerApi) {
                        updateFlowToServerApi(id, {
                            sandboxStatus: data.status,
                            sandboxAppUrl: data.sandbox_app_url,
                            sandboxGrafanaUrl: data.sandbox_grafana_url,
                            sandboxTracerUrl: data.sandbox_tracer_url,
                            sandboxDebugLogsUrl: data.sandbox_debuglogs_url
                        })
                    }
                }
            }

            ws.onclose = () => {}
            return ws
        }

        sortedData.forEach((row) => {
            if (row.sandboxStatus === 'Getting Ready' || row.sandboxStatus === 'Stopping') {
                const ws = openWebSocketConnection(row.id, row.sandboxStatus)
                openConnections.push(ws)
            }

            if (
                row.deploymentStatus === 'In Progress' &&
                (!deployWebSocketsById[row.id] || deployWebSocketsById[row.id].readyState !== WebSocket.OPEN)
            ) {
                console.log(`Found in-progress deployment for chatflow ${row.id}, creating websocket...`)

                let deploymentConfig = { hostname: '', username: '' }
                if (row.deploymentConfig) {
                    try {
                        deploymentConfig = JSON.parse(row.deploymentConfig)
                    } catch (e) {
                        console.warn('Failed to parse deployment config for websocket reconnection')
                    }
                }

                if (row.deploymentLogs) {
                    try {
                        const logs = JSON.parse(row.deploymentLogs)
                        const logText = logs.length > 0 ? logs.join('\n') : 'Deployment in progress...'
                        setDeployStatusForId(row.id, ['Info', logText])
                    } catch (e) {
                        setDeployStatusForId(row.id, ['Info', 'Deployment in progress...'])
                    }
                } else {
                    setDeployStatusForId(row.id, ['Info', 'Deployment in progress...'])
                }

                const deployWs = startClickDeploymentMonitoring(row.id, deploymentConfig)
                openConnections.push(deployWs)
            }
        })

        return () => {
            openConnections.forEach((ws) => {
                ws.close()
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortedData])

    useEffect(() => {
        return () => {
            Object.values(deployWebSocketsById).forEach((ws) => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.close()
                }
            })
        }
    }, [deployWebSocketsById])

    return (
        <>
            <TableContainer sx={{ border: 1, borderColor: theme.palette.grey[900] + 25, borderRadius: 2 }} component={Paper}>
                <Table sx={{ minWidth: 650 }} size='small' aria-label='a dense table'>
                    <TableHead
                        sx={{
                            backgroundColor: customization.isDarkMode ? theme.palette.common.black : theme.palette.grey[100],
                            height: 56
                        }}
                    >
                        <TableRow>
                            <StyledTableCell>
                                <TableSortLabel active={orderBy === 'name'} direction={order} onClick={() => handleRequestSort('name')}>
                                    {t('flowlist.workflowName')}
                                </TableSortLabel>
                            </StyledTableCell>
                            <StyledTableCell>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent='center'>
                                    {t('flowlist.sandboxStatus')}
                                </Stack>
                            </StyledTableCell>
                            <StyledTableCell>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent='center'>
                                    {t('flowlist.sandboxControl')}
                                </Stack>
                            </StyledTableCell>
                            <StyledTableCell>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent='center'>
                                    {t('flowlist.openSandbox')}
                                </Stack>
                            </StyledTableCell>
                            <StyledTableCell>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent='center'>
                                    {t('flowlist.observability')}
                                </Stack>
                            </StyledTableCell>
                            <StyledTableCell>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent='center'>
                                    {t('flowlist.oneClickDeploy')}
                                </Stack>
                            </StyledTableCell>
                            <StyledTableCell>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent='center'>
                                    {t('flowlist.actions')}
                                </Stack>
                            </StyledTableCell>
                            <StyledTableCell>
                                <TableSortLabel
                                    active={orderBy === 'updatedDate'}
                                    direction={order}
                                    onClick={() => handleRequestSort('updatedDate')}
                                >
                                    {t('flowlist.lastModified')}
                                </TableSortLabel>
                            </StyledTableCell>
                            {userRole === 'admin' && (
                                <StyledTableCell>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent='center'>
                                        {t('flowlist.user')}
                                    </Stack>
                                </StyledTableCell>
                            )}
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {isLoading ? (
                            <>
                                {[...Array(2)].map((_, idx) => (
                                    <StyledTableRow key={idx}>
                                        {Array(userRole === 'admin' ? 9 : 8)
                                            .fill(0)
                                            .map((_, jdx) => (
                                                <StyledTableCell key={jdx}>
                                                    <Skeleton variant='text' />
                                                </StyledTableCell>
                                            ))}
                                    </StyledTableRow>
                                ))}
                            </>
                        ) : sortedData.length === 0 ? (
                            <StyledTableRow>
                                <StyledTableCell colSpan={userRole === 'admin' ? 9 : 8} align='center'>
                                    {t('flowlist.noData')}
                                </StyledTableCell>
                            </StyledTableRow>
                        ) : (
                            sortedData.filter(filterFunction).map((row, index) => (
                                <StyledTableRow key={index}>
                                    <StyledTableCell>
                                        <Tooltip title={row.templateName || row.name}>
                                            <Typography
                                                sx={{
                                                    display: '-webkit-box',
                                                    fontSize: 14,
                                                    fontWeight: 500,
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    textOverflow: 'ellipsis',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                <Link
                                                    to={`/${isAgentCanvas ? 'agentcanvas' : isOpeaCanvas ? 'opeacanvas' : 'canvas'}/${row.id}`}
                                                    style={{ color: '#1162cc', textDecoration: 'none' }}
                                                >
                                                    {row.templateName || row.name}
                                                </Link>
                                            </Typography>
                                        </Tooltip>
                                    </StyledTableCell>

                                    <StyledTableCell>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent='center' alignItems='center'>
                                            {row.sandboxStatus === 'Getting Ready' ||
                                            row.sandboxStatus === 'Stopping' ||
                                            row.sandboxStatus === 'Deleting existing namespace' ||
                                            row.sandboxStatus === 'Sending Request' ? (
                                                <CircularProgress size={20} />
                                            ) : null}
                                            <Typography variant='body2'>{sandboxStatusText(row.sandboxStatus)}</Typography>
                                        </Stack>
                                    </StyledTableCell>

                                    <StyledTableCell>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent='center' alignItems='center'>
                                            {row.sandboxStatus === 'Ready' ||
                                            row.sandboxStatus === 'Getting Ready' ||
                                            row.sandboxStatus === 'Deleting existing namespace' ? (
                                                <Tooltip title={t('flowlist.stopSandbox', { defaultValue: 'Stop Sandbox' })}>
                                                    <Button color='primary' startIcon={<StopCircleOutlined />} onClick={() => handleStopSandbox(row.id)}></Button>
                                                </Tooltip>
                                            ) : (
                                                <Tooltip title={t('flowlist.runSandbox', { defaultValue: 'Run Sandbox' })}>
                                                    <Button
                                                        color='primary'
                                                        startIcon={<PlayCircleOutline />}
                                                        onClick={() => {
                                                            window.open(`/debuglogs/sandbox-${row.id}`, '_blank')
                                                            handleRunSandbox(row.id)
                                                        }}
                                                        disabled={row.sandboxStatus === 'Stopping' || row.sandboxStatus === 'Sending Request'}
                                                    ></Button>
                                                </Tooltip>
                                            )}
                                        </Stack>
                                    </StyledTableCell>

                                    <StyledTableCell>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent='center' alignItems='center'>
                                            <Tooltip
                                                title={
                                                    row.sandboxStatus === 'Ready'
                                                        ? t('flowlist.openApp')
                                                        : t('flowlist.sandboxNotRunning')
                                                }
                                            >
                                                <span>
                                                    <Button
                                                        color={row.sandboxStatus === 'Not Running' ? 'inherit' : 'primary'}
                                                        startIcon={<OpenInNew />}
                                                        onClick={() => handleOpenUrl(row.sandboxAppUrl)}
                                                        disabled={row.sandboxStatus !== 'Ready'}
                                                    ></Button>
                                                </span>
                                            </Tooltip>
                                        </Stack>
                                    </StyledTableCell>

                                    <StyledTableCell>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent='center' alignItems='center'>
                                            <Tooltip
                                                title={
                                                    row.sandboxStatus === 'Ready'
                                                        ? t('flowlist.observabilityOptions')
                                                        : t('flowlist.sandboxNotRunning')
                                                }
                                            >
                                                <span>
                                                    <Button
                                                        color={row.sandboxStatus === 'Not Running' ? 'inherit' : 'primary'}
                                                        startIcon={<TroubleshootOutlined />}
                                                        disabled={row.sandboxStatus !== 'Ready'}
                                                        aria-controls={`observability-menu-${row.id}`}
                                                        aria-haspopup='true'
                                                        onClick={(event) => {
                                                            setObservabilityAnchorEl(event.currentTarget)
                                                            setObservabilityRow(row)
                                                        }}
                                                    ></Button>
                                                </span>
                                            </Tooltip>
                                            <Menu
                                                id={`observability-menu-${row.id}`}
                                                anchorEl={observabilityAnchorEl}
                                                open={Boolean(observabilityAnchorEl) && observabilityRow?.id === row.id}
                                                onClose={() => setObservabilityAnchorEl(null)}
                                            >
                                                <MenuItem
                                                    onClick={() => {
                                                        handleOpenUrl(row.sandboxGrafanaUrl)
                                                        setObservabilityAnchorEl(null)
                                                    }}
                                                    disabled={row.sandboxStatus !== 'Ready'}
                                                >
                                                    <Analytics fontSize='small' sx={{ mr: 1 }} /> {t('flowlist.monitoringDashboard')}
                                                </MenuItem>
                                                <MenuItem
                                                    onClick={() => {
                                                        handleOpenUrl(row.sandboxTracerUrl)
                                                        setObservabilityAnchorEl(null)
                                                    }}
                                                    disabled={row.sandboxStatus !== 'Ready'}
                                                >
                                                    <ViewTimelineOutlined fontSize='small' sx={{ mr: 1, transform: 'scaleX(-1)' }} />{' '}
                                                    {t('flowlist.llmTraces')}
                                                </MenuItem>
                                                <MenuItem
                                                    onClick={() => {
                                                        handleOpenUrl(row.sandboxDebugLogsUrl)
                                                        setObservabilityAnchorEl(null)
                                                    }}
                                                    disabled={row.sandboxStatus !== 'Ready'}
                                                >
                                                    <TerminalOutlined fontSize='small' sx={{ mr: 1 }} /> {t('flowlist.debugLogs')}
                                                </MenuItem>
                                            </Menu>
                                        </Stack>
                                    </StyledTableCell>

                                    <StyledTableCell>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent='center' alignItems='center'>
                                            {row.deploymentStatus === 'In Progress' ||
                                            (deployWebSocketsById[row.id] &&
                                                deployWebSocketsById[row.id].readyState === WebSocket.OPEN) ? (
                                                <Tooltip
                                                    title={t('flowlist.deploymentInProgress', {
                                                        defaultValue: 'Deployment in progress - click to monitor'
                                                    })}
                                                >
                                                    <Button
                                                        startIcon={<CircularProgress size={16} />}
                                                        onClick={() => handleOneClickDeployment(row.id)}
                                                        color='primary'
                                                        variant='outlined'
                                                    ></Button>
                                                </Tooltip>
                                            ) : (
                                                <Tooltip
                                                    title={t('flowlist.oneClickDeploy', {
                                                        defaultValue: '1 Click Deployment'
                                                    })}
                                                >
                                                    <span>
                                                        <Button
                                                            startIcon={<InstallDesktopOutlined />}
                                                            onClick={() => handleOneClickDeployment(row.id)}
                                                        ></Button>
                                                    </span>
                                                </Tooltip>
                                            )}
                                        </Stack>
                                    </StyledTableCell>

                                    <StyledTableCell>
                                        <FlowListMenu
                                            isAgentCanvas={isAgentCanvas}
                                            chatflow={row}
                                            setError={setError}
                                            updateFlowsApi={updateFlowsApi}
                                            sandboxStatus={row.sandboxStatus}
                                        />
                                    </StyledTableCell>

                                    <StyledTableCell>{moment(row.updatedDate).format('YYYY-MM-DD HH:mm:ss')}</StyledTableCell>

                                    {userRole === 'admin' && <StyledTableCell>{row.userid}</StyledTableCell>}
                                </StyledTableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <BuildDeploymentPackageDialog
                show={buildDeploymentPackageDialogOpen}
                dialogProps={buildDeploymentPackageDialogProps}
                onCancel={() => setBuildDeploymentPackageDialogOpen(false)}
                onConfirm={downloadDeploymentPackage}
            />

            <OneClickDeploymentDialog
                key={oneClickDeploymentDialogProps.id || 'none'}
                show={oneClickDeploymentDialogOpen}
                dialogProps={oneClickDeploymentDialogProps}
                onCancel={() => setOneClickDeploymentDialogOpen(false)}
                onConfirm={oneClickDeployment}
                deployStatus={deployStatusById[oneClickDeploymentDialogProps.id]}
                setDeployStatus={(status) => setDeployStatusForId(oneClickDeploymentDialogProps.id, status)}
                deploymentConfig={deployConfigById[oneClickDeploymentDialogProps.id] || { hostname: '', username: '' }}
                setDeploymentConfig={(config) => setDeployConfigForId(oneClickDeploymentDialogProps.id, config)}
                deployWebSocket={deployWebSocketsById[oneClickDeploymentDialogProps.id]}
            />
        </>
    )
}

FlowListTable.propTypes = {
    data: PropTypes.array,
    images: PropTypes.object,
    isLoading: PropTypes.bool,
    filterFunction: PropTypes.func,
    updateFlowsApi: PropTypes.object,
    setError: PropTypes.func,
    isAgentCanvas: PropTypes.bool,
    isOpeaCanvas: PropTypes.bool,
    stopSandboxApi: PropTypes.func,
    updateFlowToServerApi: PropTypes.func,
    userRole: PropTypes.string
}

export default FlowListTable
