import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

// material-ui
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Drawer,
    IconButton,
    Paper,
    Stack,
    Tab,
    Tabs,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
    styled
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { tableCellClasses } from '@mui/material/TableCell'

// icons
import { IconX, IconAlertTriangle } from '@tabler/icons-react'

// API
import evaluationApi from '@/api/evaluation'
import chatflowsApi from '@/api/chatflows'

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: theme.palette.grey[900] + 25,
    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.grey[900],
        fontWeight: 600
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 13,
        padding: '8px 12px'
    }
}))

const StyledTableRow = styled(TableRow)(() => ({
    '&:last-child td': {
        border: 0
    }
}))

const statusColor = (status) => {
    switch (status) {
        case true:
            return 'success'
        case false:
            return 'error'
        default:
            return 'default'
    }
}

const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
        const dt = new Date(dateStr)
        if (isNaN(dt.getTime())) return dateStr
        return dt.toLocaleString()
    } catch {
        return dateStr
    }
}

const truncateText = (text, maxLength = 100) => {
    if (!text) return '—'
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
}

const formatMetricScore = (score) => {
    if (score === null || score === undefined) return 'N/A'
    if (typeof score === 'number') return score.toFixed(3)
    return String(score)
}

const applyConfigurationSnapshot = (snapshot, setters) => {
    if (!snapshot || typeof snapshot !== 'object') {
        return false
    }

    const hasSnapshotData = Array.isArray(snapshot?.workflow_nodes) || snapshot?.data_management
    if (!hasSnapshotData) {
        return false
    }

    const workflowNodes = Array.isArray(snapshot?.workflow_nodes) ? snapshot.workflow_nodes : []
    const dataManagement = snapshot?.data_management || {}

    setters.setWorkflowNodes(workflowNodes)
    setters.setDataManagementFiles(Array.isArray(dataManagement.files) ? dataManagement.files : [])
    setters.setDataFilesError(dataManagement.error || '')

    if (dataManagement.status) {
        setters.setDataFilesStatus(dataManagement.status)
        return true
    }

    setters.setDataFilesStatus(workflowNodes.length > 0 ? 'done' : 'not-applicable')
    return true
}

function TabPanel(props) {
    const { children, value, index, ...other } = props

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
            style={{ paddingTop: '24px' }}
        >
            {value === index && (
                <Box>
                    {children}
                </Box>
            )}
        </div>
    )
}
TabPanel.propTypes = {
    children: PropTypes.node,
    index: PropTypes.number.isRequired,
    value: PropTypes.number.isRequired,
}

const RunDetailsModal = ({ open, onClose, runId }) => {
    const theme = useTheme()

    const [tabValue, setTabValue] = useState(0)

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue)
    }

    const [run, setRun] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [datasetName, setDatasetName] = useState(null)
    const [workflowNodes, setWorkflowNodes] = useState([])
    const [dataManagementFiles, setDataManagementFiles] = useState([])
    // 'idle' | 'not-applicable' | 'checking' | 'done' | 'error'
    const [dataFilesStatus, setDataFilesStatus] = useState('idle')
    const [dataFilesError, setDataFilesError] = useState('')

    const [selectedEntry, setSelectedEntry] = useState(null)
    const [drawerOpen, setDrawerOpen] = useState(false)

    const handleOpenDrawer = (result) => {
        setSelectedEntry(result)
        setDrawerOpen(true)
    }

    const handleCloseDrawer = () => {
        setDrawerOpen(false)
        setSelectedEntry(null)
    }

    const getEffectiveStatus = (runData) => {
        if (runData.status === 'completed' && runData.results?.some((r) => r.passed === false)) {
            return 'failed'
        }
        return runData.status
    }

    const getOrderedMetricEntries = (runData, result) => {
        if (!result?.metric_scores) return []

        const configuredMetrics = Array.isArray(runData?.metrics) ? runData.metrics : []
        const scoredMetrics = Object.keys(result.metric_scores)
        const orderedMetricNames = [
            ...configuredMetrics,
            ...scoredMetrics.filter((metricName) => !configuredMetrics.includes(metricName))
        ]

        return orderedMetricNames
            .map((metricName) => [metricName, result.metric_scores[metricName]])
            .filter(([, scoreDetails]) => Boolean(scoreDetails))
    }

    const getResultReasons = (runData, result) => {
        const metricReasons = getOrderedMetricEntries(runData, result)
            .filter(([, scoreDetails]) => scoreDetails.reason)
            .map(([metricName, scoreDetails]) => `${metricName}: ${scoreDetails.reason}`)

        if (metricReasons.length > 0) {
            return metricReasons
        }

        if (!result?.reason) return []

        return String(result.reason)
            .split(/;\s*/)
            .filter(Boolean)
    }

    useEffect(() => {
        if (!open || !runId) return

        const fetchRun = async () => {
            try {
                setLoading(true)
                setError(null)
                setDatasetName(null)
                setWorkflowNodes([])
                setDataManagementFiles([])
                setDataFilesStatus('idle')
                setDataFilesError('')
                const res = await evaluationApi.getRun(runId)
                setRun(res.data)
                try {
                    const dsRes = await evaluationApi.getDataset(res.data.dataset_id)
                    setDatasetName(dsRes.data.name)
                } catch {
                    // non-critical
                }
                if (
                    applyConfigurationSnapshot(res.data.configuration_snapshot, {
                        setWorkflowNodes,
                        setDataManagementFiles,
                        setDataFilesStatus,
                        setDataFilesError
                    })
                ) {
                    return
                }
                try {
                    const chatflowId = res.data.sandbox_id?.replace(/^sandbox-/, '')
                    if (chatflowId) {
                        const cfRes = await chatflowsApi.getSpecificChatflow(chatflowId).catch((e) => {
                            console.error('[RunDetailsModal] getSpecificChatflow failed:', e)
                            throw e
                        })
                        const flowData = cfRes.data?.flowData
                        if (flowData) {
                            const parsed = typeof flowData === 'string' ? JSON.parse(flowData) : flowData
                            const nodes = parsed.nodes || []
                            setWorkflowNodes(nodes)

                            const hasDataprepNode = nodes.some((node) =>
                                String(node?.data?.name || '').startsWith('opea_service@prepare_doc_redis_prep')
                            )

                            if (!hasDataprepNode) {
                                setDataFilesStatus('not-applicable')
                            } else if (res.data.sandbox_id) {
                                setDataFilesStatus('checking')
                                try {
                                    const filesRes = await evaluationApi.getSandboxDataManagementFiles({
                                        sandbox_id: res.data.sandbox_id
                                    })
                                    const files = Array.isArray(filesRes.data?.files) ? filesRes.data.files : []
                                    setDataManagementFiles(files)
                                    setDataFilesStatus('done')
                                } catch (filesErr) {
                                    console.error('[RunDetailsModal] getSandboxDataManagementFiles failed:', filesErr)
                                    const errMsg = filesErr?.response?.data?.message || filesErr?.response?.data?.detail || filesErr?.message || 'Unknown error'
                                    setDataManagementFiles([])
                                    setDataFilesError(errMsg)
                                    setDataFilesStatus('error')
                                }
                            }
                        }
                    }
                } catch {
                    // non-critical
                }
            } catch (err) {
                setError(err?.response?.data?.detail || 'Failed to load run details.')
                setLoading(false)
            } finally {
                setLoading(false)
            }
        }

        fetchRun()
    }, [open, runId])

    if (!open) return null

    return (
        <Dialog open={open} onClose={onClose} maxWidth='lg' fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant='h5'>Evaluation Run Details</Typography>
                <IconButton size='small' onClick={onClose}>
                    <IconX size={18} />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Typography color='error'>{error}</Typography>
                ) : run ? (
                    <Box sx={{ width: '100%' }}>
                        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                            <Tabs value={tabValue} onChange={handleTabChange} aria-label="run details tabs">
                                <Tab label="Results" id="simple-tab-0" aria-controls="simple-tabpanel-0" />
                                <Tab label="Configuration" id="simple-tab-1" aria-controls="simple-tabpanel-1" />
                            </Tabs>
                        </Box>
                        <TabPanel value={tabValue} index={0}>
                            <Stack spacing={3}>
                                {/* Run Metadata */}
                                <Box>
                                    <Typography variant='h6' sx={{ mb: 2 }}>
                                        Run Information
                                    </Typography>
                            <Paper sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50' }}>
                                <Stack spacing={1.5}>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                        <Box>
                                            <Typography variant='caption' color='textSecondary'>
                                                Run ID
                                            </Typography>
                                            <Typography variant='body2' sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                                {run.id}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant='caption' color='textSecondary'>
                                                Sandbox
                                            </Typography>
                                            <Typography variant='body2' sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                {truncateText(run.sandbox_id, 50)}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant='caption' color='textSecondary'>
                                                Status
                                            </Typography>
                                            <Box sx={{ mt: 0.5 }}>
                                                <Chip
                                                    label={getEffectiveStatus(run)}
                                                    color={
                                                        getEffectiveStatus(run) === 'completed'
                                                            ? 'success'
                                                            : getEffectiveStatus(run) === 'failed'
                                                              ? 'error'
                                                              : 'primary'
                                                    }
                                                    size='small'
                                                />
                                            </Box>
                                        </Box>
                                        <Box>
                                            <Typography variant='caption' color='textSecondary'>
                                                Dataset
                                            </Typography>
                                            <Typography variant='body2'>{datasetName || run.dataset_id}</Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant='caption' color='textSecondary'>
                                                Judge Model
                                            </Typography>
                                            <Typography variant='body2'>{run.model_name}</Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant='caption' color='textSecondary'>
                                                Metrics
                                            </Typography>
                                            <Stack direction='row' spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                                                {run.metrics.map((m) => (
                                                    <Chip key={m} label={m} size='small' variant='outlined' />
                                                ))}
                                            </Stack>
                                        </Box>
                                        <Box>
                                            <Typography variant='caption' color='textSecondary'>
                                                Created At
                                            </Typography>
                                            <Typography variant='body2' sx={{ fontSize: '0.9rem' }}>
                                                {formatDate(run.created_at)}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant='caption' color='textSecondary'>
                                                Completed At
                                            </Typography>
                                            <Typography variant='body2' sx={{ fontSize: '0.9rem' }}>
                                                {run.completed_at ? formatDate(run.completed_at) : '—'}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant='caption' color='textSecondary'>
                                                Average Scores
                                            </Typography>
                                            <Box sx={{ mt: 0.5 }}>
                                                {run.results && run.results.length > 0 ? (
                                                    <Stack spacing={0.5}>
                                                        {run.metrics.map((metricName) => {
                                                            const scores = run.results
                                                                .map((r) => r.metric_scores?.[metricName]?.score)
                                                                .filter((s) => s !== null && s !== undefined && typeof s === 'number')
                                                            const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
                                                            return (
                                                                <Typography key={metricName} variant='body2' sx={{ fontSize: '0.85rem' }}>
                                                                    {metricName}: {avg !== null ? avg.toFixed(3) : 'N/A'}
                                                                </Typography>
                                                            )
                                                        })}
                                                    </Stack>
                                                ) : (
                                                    <Typography variant='body2' sx={{ fontSize: '0.85rem' }}>N/A</Typography>
                                                )}
                                            </Box>
                                        </Box>
                                    </Box>
                                    {run.error && (
                                        <>
                                            <Divider />
                                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                                <IconAlertTriangle size={18} color={theme.palette.error.main} style={{ marginTop: 2 }} />
                                                <Box>
                                                    <Typography variant='caption' color='error'>
                                                        Error
                                                    </Typography>
                                                    <Typography
                                                        variant='body2'
                                                        color='error'
                                                        sx={{ mt: 0.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                                    >
                                                        {run.error}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </>
                                    )}
                                </Stack>
                            </Paper>
                        </Box>

                        {/* Results Table */}
                        {run.results && run.results.length > 0 && (
                            <Box>
                                <Typography variant='h6' sx={{ mb: 2 }}>
                                    Evaluation Results ({run.results.length} entries)
                                </Typography>
                                {(() => {
                                        const hasContext = run.results.some(
                                            (r) => r.entry?.context && r.entry.context.length > 0
                                        )
                                        return (
                                            <TableContainer component={Paper}>
                                                <Table size='small' sx={{ tableLayout: 'fixed' }}>
                                                    <TableHead>
                                                        <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100' }}>
                                                            <StyledTableCell sx={{ width: '80px' }}>Entry</StyledTableCell>
                                                            <StyledTableCell sx={{ width: hasContext ? '18%' : '22%' }}>Input</StyledTableCell>
                                                            {hasContext && <StyledTableCell sx={{ width: '14%' }}>Context</StyledTableCell>}
                                                            <StyledTableCell sx={{ width: hasContext ? '24%' : '28%' }}>Actual Output</StyledTableCell>
                                                            <StyledTableCell sx={{ width: '120px' }}>Metrics</StyledTableCell>
                                                            <StyledTableCell align='center' sx={{ width: '100px' }}>Status</StyledTableCell>
                                                            <StyledTableCell sx={{ width: hasContext ? '24%' : '28%' }}>Reason</StyledTableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {run.results.map((result) => {
                                                            const orderedMetricEntries = getOrderedMetricEntries(run, result)
                                                            const failReasons = getResultReasons(run, result)
                                                            const failReasonText = failReasons.join('\n')
                                                            return (
                                                                <StyledTableRow 
                                                                    key={result.id}
                                                                    hover
                                                                    onClick={() => handleOpenDrawer(result)}
                                                                    sx={{ cursor: 'pointer' }}
                                                                >
                                                                    <StyledTableCell>
                                                                        <Typography variant='caption' sx={{ fontFamily: 'monospace' }}>
                                                                            #{result.entry_id}
                                                                        </Typography>
                                                                    </StyledTableCell>
                                                                    <StyledTableCell sx={{ position: 'relative', p: 0, overflow: 'hidden' }}>
                                                                        <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden', padding: '8px 12px' }}>
                                                                            <Typography variant='caption' sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', display: 'block' }}>
                                                                                {result.entry?.input || '—'}
                                                                            </Typography>
                                                                            <Box sx={(t) => ({ position: 'absolute', bottom: 0, left: 0, right: 0, height: '36px', background: `linear-gradient(to bottom, transparent, ${t.palette.background.paper})`, pointerEvents: 'none' })} />
                                                                        </Box>
                                                                    </StyledTableCell>
                                                                    {hasContext && (
                                                                        <StyledTableCell sx={{ position: 'relative', p: 0, overflow: 'hidden' }}>
                                                                            <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden', padding: '8px 12px' }}>
                                                                                <Typography variant='caption' sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', display: 'block' }}>
                                                                                    {result.entry?.context?.length > 0 ? result.entry.context.join('\n\n') : '—'}
                                                                                </Typography>
                                                                                <Box sx={(t) => ({ position: 'absolute', bottom: 0, left: 0, right: 0, height: '36px', background: `linear-gradient(to bottom, transparent, ${t.palette.background.paper})`, pointerEvents: 'none' })} />
                                                                            </Box>
                                                                        </StyledTableCell>
                                                                    )}
                                                                    <StyledTableCell sx={{ position: 'relative', p: 0, overflow: 'hidden' }}>
                                                                        <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden', padding: '8px 12px' }}>
                                                                            <Typography variant='caption' sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', display: 'block' }}>
                                                                                {result.actual_output || '—'}
                                                                            </Typography>
                                                                            <Box sx={(t) => ({ position: 'absolute', bottom: 0, left: 0, right: 0, height: '36px', background: `linear-gradient(to bottom, transparent, ${t.palette.background.paper})`, pointerEvents: 'none' })} />
                                                                        </Box>
                                                                    </StyledTableCell>
                                                                    <StyledTableCell>
                                                                        {orderedMetricEntries.length > 0 ? (
                                                                            <Stack spacing={0.5}>
                                                                                {orderedMetricEntries.map(([metricName, scores]) => (
                                                                                    <Box key={metricName} sx={{ fontSize: '0.8rem' }}>
                                                                                        <Typography variant='caption' component='div'>
                                                                                            <strong>{metricName}:</strong> {formatMetricScore(scores.score)}
                                                                                        </Typography>
                                                                                    </Box>
                                                                                ))}
                                                                            </Stack>
                                                                        ) : (
                                                                            '—'
                                                                        )}
                                                                    </StyledTableCell>
                                                                    <StyledTableCell align='center'>
                                                                        <Chip
                                                                            label={result.passed ? 'COMPLETED' : 'FAILED'}
                                                                            color={statusColor(result.passed)}
                                                                            size='small'
                                                                        />
                                                                    </StyledTableCell>
                                                                    <StyledTableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                                                        {failReasons.length > 0 ? (
                                                                            <Typography
                                                                                variant='caption'
                                                                                component='div'
                                                                                sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                                                            >
                                                                                {failReasonText}
                                                                            </Typography>
                                                                        ) : (
                                                                            '—'
                                                                        )}
                                                                    </StyledTableCell>
                                                                </StyledTableRow>
                                                            )
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        )
                                    })()}
                            </Box>
                        )}

                        {(!run.results || run.results.length === 0) && (
                            <Typography color='textSecondary' align='center'>
                                No results available yet.
                            </Typography>
                        )}
                    </Stack>
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    <Box sx={{ width: '100%' }}>
                        <Typography variant='h6' sx={{ mb: 1.5 }}>
                            Sandbox Workflow Configuration
                        </Typography>
                        <Paper sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50' }}>
                            <Stack spacing={2}>
                                {workflowNodes.length === 0 ? (
                                    <Typography variant='body2' color='textSecondary'>N/A</Typography>
                                ) : (
                                    <Stack spacing={2}>
                                        {workflowNodes
                                            .filter((node) => node.data?.inputs && Object.keys(node.data.inputs).length > 0)
                                            .map((node) => {
                                                const inputs = node.data.inputs
                                                const displayInputs = Object.entries(inputs).filter(
                                                    ([, v]) =>
                                                        v !== '' &&
                                                        v !== null &&
                                                        v !== undefined &&
                                                        !String(v).startsWith('{{')
                                                )
                                                if (displayInputs.length === 0) return null
                                                const paramLabels = {}
                                                ;(node.data.inputParams || []).forEach((p) => {
                                                    paramLabels[p.name] = p.label
                                                })
                                                return (
                                                    <Box key={node.id}>
                                                        <Typography
                                                            variant='caption'
                                                            sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}
                                                            color='textSecondary'
                                                        >
                                                            {node.data.label}
                                                        </Typography>
                                                        <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                                                            {displayInputs.map(([key, val]) => (
                                                                <Box key={key} sx={{ fontSize: '0.8rem' }}>
                                                                    <Typography variant='caption' component='div'>
                                                                        <strong>{paramLabels[key] || key}:</strong>{' '}
                                                                        {typeof val === 'boolean'
                                                                            ? String(val)
                                                                            : truncateText(String(val), 60)}
                                                                    </Typography>
                                                                </Box>
                                                            ))}
                                                        </Stack>
                                                    </Box>
                                                )
                                            })}
                                    </Stack>
                                )}

                                <Divider />

                                <Box>
                                    <Typography variant='caption' sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }} color='textSecondary'>
                                        Data Management Files
                                    </Typography>
                                    <Box sx={{ mt: 0.5 }}>
                                        {dataFilesStatus === 'idle' || dataFilesStatus === 'not-applicable' ? (
                                            <Typography variant='caption' color='textSecondary'>N/A</Typography>
                                        ) : dataFilesStatus === 'checking' ? (
                                            <Stack direction='row' spacing={1} alignItems='center'>
                                                <CircularProgress size={14} />
                                                <Typography variant='caption' color='textSecondary'>
                                                    Checking...
                                                </Typography>
                                            </Stack>
                                        ) : dataFilesStatus === 'error' ? (
                                            <Tooltip title={dataFilesError} placement='top'>
                                                <Typography variant='caption' color='warning.main' sx={{ cursor: 'help' }}>
                                                    Unable to check (sandbox may be stopped)
                                                </Typography>
                                            </Tooltip>
                                        ) : dataManagementFiles.length > 0 ? (
                                            <Stack spacing={0.25}>
                                                {dataManagementFiles.slice(0, 5).map((file, idx) => {
                                                    const label = typeof file === 'string' ? file : file?.name || file?.id || file?.file_name || JSON.stringify(file)
                                                    return (
                                                        <Typography key={`${label}-${idx}`} variant='caption' color='textSecondary'>
                                                            {truncateText(label, 70)}
                                                        </Typography>
                                                    )
                                                })}
                                                {dataManagementFiles.length > 5 && (
                                                    <Typography variant='caption' color='textSecondary'>
                                                        +{dataManagementFiles.length - 5} more
                                                    </Typography>
                                                )}
                                            </Stack>
                                        ) : (
                                            <Typography variant='caption' color='textSecondary'>
                                                No files uploaded
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            </Stack>
                        </Paper>
                    </Box>
                </TabPanel>
            </Box>
        ) : null}
    </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>

            {/* Entry Details Drawer */}
            <Drawer 
                anchor="right" 
                open={drawerOpen} 
                onClose={handleCloseDrawer} 
                sx={{ zIndex: (theme) => theme.zIndex.modal + 10 }}
                PaperProps={{ sx: { width: { xs: '100%', sm: 600, md: 800 }, p: 3, bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'background.paper' } }}
            >
                {selectedEntry && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6">Entry #{selectedEntry.entry_id} Details</Typography>
                            <IconButton onClick={handleCloseDrawer} size="small">
                                <IconX size={20} />
                            </IconButton>
                        </Box>
                        <Divider sx={{ mb: 3 }} />
                        <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                            <Stack spacing={3}>
                                <Box>
                                    <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>Input</Typography>
                                    <Paper variant="outlined" sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50' }}>
                                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                            {selectedEntry.entry?.input || '—'}
                                        </Typography>
                                    </Paper>
                                </Box>
                                
                                {selectedEntry.entry?.context && selectedEntry.entry.context.length > 0 && (
                                    <Box>
                                        <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>Context</Typography>
                                        <Paper variant="outlined" sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50' }}>
                                            {selectedEntry.entry.context.map((ctx, idx) => (
                                                <Typography key={idx} variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', mb: idx < selectedEntry.entry.context.length - 1 ? 2 : 0 }}>
                                                    {ctx}
                                                </Typography>
                                            ))}
                                        </Paper>
                                    </Box>
                                )}

                                <Box>
                                    <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>Actual Output</Typography>
                                    <Paper variant="outlined" sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50' }}>
                                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                            {selectedEntry.actual_output || '—'}
                                        </Typography>
                                    </Paper>
                                </Box>

                                {selectedEntry.expected_output && (
                                    <Box>
                                        <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>Expected Output</Typography>
                                        <Paper variant="outlined" sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50' }}>
                                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                {selectedEntry.expected_output}
                                            </Typography>
                                        </Paper>
                                    </Box>
                                )}

                                <Box>
                                    <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>Execution Status</Typography>
                                    <Chip label={selectedEntry.passed ? 'COMPLETED' : 'FAILED'} color={statusColor(selectedEntry.passed)} size="small" />
                                </Box>

                                {getResultReasons(run, selectedEntry).length > 0 && (
                                    <Box>
                                        <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>Reasons</Typography>
                                        <Paper variant="outlined" sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50' }}>
                                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                {getResultReasons(run, selectedEntry).join('\n')}
                                            </Typography>
                                        </Paper>
                                    </Box>
                                )}
                            </Stack>
                        </Box>
                    </Box>
                )}
            </Drawer>
        </Dialog>
    )
}

RunDetailsModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    runId: PropTypes.string
}

export default RunDetailsModal
