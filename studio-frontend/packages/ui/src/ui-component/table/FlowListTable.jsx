import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import moment from 'moment'
import { styled } from '@mui/material/styles'
import {
    Box,
    Button,
    Chip,
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
    useTheme
} from '@mui/material'
import { tableCellClasses } from '@mui/material/TableCell'
import FlowListMenu from '../button/FlowListMenu'
import { Link } from 'react-router-dom'
import {
    OpenInNew,
    StopCircleOutlined,
    Analytics,
    PlayCircleOutline,
    UnarchiveOutlined
} from '@mui/icons-material' 

import BuildDeploymentPackageDialog from '../dialog/BuildDeploymentPackageDialog'
import chatflowsApi from '@/api/chatflows'
import config from '@/config'
import { update } from 'lodash'

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
    // hide last border
    '&:last-child td, &:last-child th': {
        border: 0
    }
}))

const getLocalStorageKeyName = (name, isAgentCanvas) => {
    return (isAgentCanvas ? 'agentcanvas' : 'chatflowcanvas') + '_' + name
}

export const FlowListTable = ({ data, images, isLoading, filterFunction, updateFlowsApi, setError, isAgentCanvas, isOpeaCanvas, stopSandboxApi, updateFlowToServerApi }) => {
    // overwrite setError
    setError = (error) => {
        console.error(error)
    }
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)

    const localStorageKeyOrder = getLocalStorageKeyName('order', isAgentCanvas)
    const localStorageKeyOrderBy = getLocalStorageKeyName('orderBy', isAgentCanvas)

    const [order, setOrder] = useState(localStorage.getItem(localStorageKeyOrder) || 'desc')
    const [orderBy, setOrderBy] = useState(localStorage.getItem(localStorageKeyOrderBy) || 'updatedDate')
    

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc'
        const newOrder = isAsc ? 'desc' : 'asc'
        setOrder(newOrder)
        setOrderBy(property)
        localStorage.setItem(localStorageKeyOrder, newOrder)
        localStorage.setItem(localStorageKeyOrderBy, property)
    }

    const [sortedData, setSortedData] = useState([]);

    const handleSortData = () => {
        if (!data) return [];
        console.log('handleSortData', data);
        const sorted = [...data].map((row) => ({
            ...row,
            sandboxStatus: row.sandboxStatus || 'Not Running' // Ensure initial status
        })).sort((a, b) => {
            if (orderBy === 'name') {
                return order === 'asc' ? (a.name || '').localeCompare(b.name || '') : (b.name || '').localeCompare(a.name || '');
            } else if (orderBy === 'updatedDate') {
                return order === 'asc'
                    ? new Date(a.updatedDate) - new Date(b.updatedDate)
                    : new Date(b.updatedDate) - new Date(a.updatedDate);
            }
            return 0;
        });
        return sorted;
    };

    useEffect(() => {
        console.log("triggering websocket")
        const studio_server_url = config.studio_server_url;
        const statusCheckEndpoint = config.sandbox_status_endpoint;
        const openConnections = [];
        const openWebSocketConnection = (id, status) => {
            const ws = new WebSocket(`${studio_server_url}/${statusCheckEndpoint}`);
            ws.onopen = () => {
                const payload = JSON.stringify({id: id, status: status});
                ws.send(payload);
                console.log('Connected to WebSocket server', id);
            };
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log('Deployment status:', data.status, id);
                if (data.status === 'Ready' || data.status === 'Error' || data.status === 'Not Running') {
                    ws.close();
                    openConnections.splice(openConnections.indexOf(ws), 1);
                    updateSandboxStatus(id, data.status, data.sandbox_app_url, data.sandbox_grafana_url);
                    updateFlowToServerApi(id, {sandboxStatus: data.status, sandboxAppUrl: data.sandbox_app_url, sandboxGrafanaUrl: data.sandbox_grafana_url});
                }
            };
            ws.onclose = () => {
                console.log('Disconnected from WebSocket server', id);
            };
            return ws;
        };
        sortedData.map((row) => {
            if (row.sandboxStatus === 'Getting Ready' || row.sandboxStatus === 'Stopping') {
                const ws = openWebSocketConnection(row.id, row.sandboxStatus);
                openConnections.push(ws);
            }
        });
        return () => {
            openConnections.forEach((ws) => {
                ws.close();
            });
        }; 
    }, [sortedData]);

    const updateSandboxStatus = (id, newStatus, sandboxAppUrl = null, sandboxGrafanaUrl = null) => {
        setSortedData((prevData) =>
            prevData.map((row) =>
                row.id === id ? { ...row, sandboxStatus: newStatus, sandboxAppUrl: sandboxAppUrl || row.sandboxAppUrl, sandboxGrafanaUrl: sandboxGrafanaUrl || row.sandboxGrafanaUrl } : row
            )
        );
    };

    const handleRunSandbox = async (id) => {
        updateSandboxStatus(id, 'Sending Request');
        const res = await chatflowsApi.deploySandbox(id)
        updateSandboxStatus(id, res.data?.sandboxStatus || 'Error', res.data?.sandboxAppUrl, res.data?.sandboxGrafanaUrl)
    }

    const handleStopSandbox = async (id) => {
        updateSandboxStatus(id, 'Sending Request');
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


    const [buildDeploymentPackageDialogOpen, setBuildDeploymentPackageDialogOpen] = useState(false)
    const [buildDeploymentPackageDialogProps, setBuildDeploymentPackageDialogProps] = useState({})

    const downloadDeploymentPackage = async(id, deploymentConfig) => {
        console.log('downloadDeploymentPackage', id, deploymentConfig);
        try {
            const response = await chatflowsApi.buildDeploymentPackage(id, deploymentConfig, {
                responseType: 'arraybuffer',
            });
            const blob = new Blob([response.data], { type: 'application/zip' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `deployment_package_${id}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading deployment package:', error);
            setError(error);
        }
        setBuildDeploymentPackageDialogOpen(false)
    }
    
    const handleBuildDeploymentPackage = (id) => {
        setBuildDeploymentPackageDialogProps({
            id: id
        })
        setBuildDeploymentPackageDialogOpen(true)
    }

    

    useEffect(() => {
        setSortedData(handleSortData());
    }, [data, order, orderBy]); // Run effect when any dependency changes

    // const handleRequestSort = (property) => {
    //     const isAsc = orderBy === property && order === 'asc';
    //     setOrder(isAsc ? 'desc' : 'asc');
    //     setOrderBy(property);
    // };

    // const sortedData = data
    //     ? [...data].sort((a, b) => {
    //           if (orderBy === 'name') {
    //               return order === 'asc' ? (a.name || '').localeCompare(b.name || '') : (b.name || '').localeCompare(a.name || '')
    //           } else if (orderBy === 'updatedDate') {
    //               return order === 'asc'
    //                   ? new Date(a.updatedDate) - new Date(b.updatedDate)
    //                   : new Date(b.updatedDate) - new Date(a.updatedDate)
    //           }
    //           return 0
    //       })
    //     : []

    const handleOpenUrl = (url) => {
        console.log('Opening URL', url);
        window.open(url, '_blank');
    }
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
                            <StyledTableCell component='th' scope='row' style={{ width: '20%' }} key='0'>
                                <TableSortLabel active={orderBy === 'name'} direction={order} onClick={() => handleRequestSort('name')}>
                                    Workflow Name
                                </TableSortLabel>
                            </StyledTableCell>
                            <StyledTableCell style={{ width: '30%' }} key='1'>
                                <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={1}
                                    justifyContent='center'
                                >
                                Sandbox
                                </Stack>
                            </StyledTableCell>
                            <StyledTableCell style={{ width: '5%' }} key='2'>
                                <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={1}
                                    justifyContent='center'
                                >
                                Deployment
                                </Stack>
                            </StyledTableCell>
                            <StyledTableCell style={{ width: '25%' }} key='3'>
                                <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={1}
                                    justifyContent='center'
                                >
                                    Actions
                                </Stack>
                            </StyledTableCell>
                            <StyledTableCell style={{ width: '25%' }} key='4'>
                                <TableSortLabel
                                    active={orderBy === 'updatedDate'}
                                    direction={order}
                                    onClick={() => handleRequestSort('updatedDate')}
                                >
                                    Last Modified Date
                                </TableSortLabel>
                            </StyledTableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <>
                                <StyledTableRow>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                </StyledTableRow>
                                <StyledTableRow>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                </StyledTableRow>
                            </>
                        ) : (
                            <>
                                {sortedData.filter(filterFunction).map((row, index) => (
                                    <StyledTableRow key={index}>
                                        <StyledTableCell key='0'>
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
                                                        to={`/${isAgentCanvas ? 'agentcanvas' : isOpeaCanvas? 'opeacanvas': 'canvas'}/${row.id}`}
                                                        style={{ color: '#1162cc', textDecoration: 'none' }}
                                                    >
                                                        {row.templateName || row.name}
                                                    </Link>
                                                </Typography>
                                            </Tooltip>
                                        </StyledTableCell>
                                        <StyledTableCell key='1'>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Box flexBasis="40%">
                                                    <Stack direction="row" alignItems="center" spacing={1}>
                                                        {row.sandboxStatus === "Getting Ready" || row.sandboxStatus === "Stopping" ? (
                                                                    <CircularProgress size={20} />
                                                                ): null
                                                        }
                                                        <Typography variant="body2">{row.sandboxStatus}</Typography>
                                                    </Stack>
                                                </Box>
                                                <Box flexBasis="60%">
                                                    <Stack direction="row" alignItems="center" spacing={0.1}>
                                                        <Box flexBasis="40%" justifyContent="center" alignItems="center" display="flex">
                                                            {row.sandboxStatus === "Ready" || row.sandboxStatus === "Getting Ready"? (
                                                                <Tooltip title="Stop Sandbox">
                                                                    <Button
                                                                        color='primary'
                                                                        startIcon={<StopCircleOutlined />}
                                                                        onClick={() => {
                                                                            handleStopSandbox(row.id);
                                                                        }}
                                                                    >
                                                                    </Button>
                                                                </Tooltip>
                                                            ) : (
                                                                <Tooltip title="Run Sandbox">
                                                                        <Button
                                                                        color='primary'
                                                                        startIcon={<PlayCircleOutline />}
                                                                        onClick={() => {
                                                                            handleRunSandbox(row.id);
                                                                        }}
                                                                        disabled={row.sandboxStatus==='Stopping'}
                                                                    >
                                                                    </Button>
                                                                </Tooltip>
                                                            )}
                                                        </Box>
                                                        <Box flexBasis="30%">
                                                            <Tooltip title={row.sandboxStatus === 'Ready' ? "Click to open Application UI" : "Sandbox is not running"}>
                                                                <span>
                                                                    <Button
                                                                        // variant="outlined"
                                                                        // style={{ width: '20px' }}
                                                                        color={row.sandboxStatus === 'Not Running' ? 'inherit' : 'primary'}
                                                                        startIcon={<OpenInNew />}
                                                                        onClick={() => {
                                                                            // console.log('Button clicked for', row.name || row.id);
                                                                            handleOpenUrl(row.sandboxAppUrl);
                                                                        }}
                                                                        disabled={row.sandboxStatus !== 'Ready'}
                                                                    >
                                                                    </Button>
                                                                </span>
                                                            </Tooltip>
                                                        </Box>
                                                        <Box flexBasis="30%">
                                                            <Tooltip title={row.sandboxStatus === 'Ready' ? "Click to open Monitoring Dashboard" : "Sandbox is not running"}>
                                                                <span>
                                                                    <Button
                                                                        // variant="outlined"
                                                                        // style={{ width: '20px' }}
                                                                        color={row.sandboxStatus === 'Not Running' ? 'inherit' : 'primary'}
                                                                        startIcon={<Analytics />}
                                                                        onClick={() => {
                                                                            // console.log('Button clicked for', row.name || row.id);
                                                                            handleOpenUrl(row.sandboxGrafanaUrl);
                                                                        }}
                                                                        disabled={row.sandboxStatus !== 'Ready'}
                                                                    >
                                                                    </Button>
                                                                </span>
                                                            </Tooltip>
                                                        </Box>
                                                    </Stack>
                                                </Box>
                                            </Stack>
                                        </StyledTableCell>
                                        <StyledTableCell key='2'>
                                            <Tooltip title={"Generate Deployment Package"}>
                                                <span>
                                                    <Button
                                                        startIcon={<UnarchiveOutlined />}
                                                        onClick={() => {
                                                            // console.log('Button clicked for', row.name || row.id);
                                                            handleBuildDeploymentPackage(row.id);
                                                        }}
                                                    >
                                                    </Button>
                                                </span>
                                            </Tooltip>
                                        </StyledTableCell>
                                        <StyledTableCell key='3'>
                                            <Stack
                                                direction={{ xs: 'column', sm: 'row' }}
                                                spacing={1}
                                                justifyContent='center'
                                                alignItems='center'
                                            >
                                                <FlowListMenu
                                                    isAgentCanvas={isAgentCanvas}
                                                    chatflow={row}
                                                    setError={setError}
                                                    updateFlowsApi={updateFlowsApi}
                                                    sandboxStatus={row.sandboxStatus}
                                                    updateSandboxStatus={updateSandboxStatus}
                                                />
                                            </Stack>
                                        </StyledTableCell>
                                        <StyledTableCell key='4'>{moment(row.updatedDate).format('MMMM Do, YYYY')}</StyledTableCell>
                                    </StyledTableRow>
                                ))}
                            </>
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
}
