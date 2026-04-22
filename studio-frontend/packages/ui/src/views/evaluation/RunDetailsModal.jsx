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
import { IconX, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react'

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

const GRADE_CONFIG = [
    { grade: 'A', min: 0.90, color: '#2e7d32', label: 'Excellent',  range: '≥ 0.90' },
    { grade: 'B', min: 0.75, color: '#558b2f', label: 'Good',       range: '0.75 – 0.89' },
    { grade: 'C', min: 0.60, color: '#f57c00', label: 'Acceptable', range: '0.60 – 0.74' },
    { grade: 'D', min: 0.50, color: '#e64a19', label: 'Poor',       range: '0.50 – 0.59' },
    { grade: 'E', min: 0.40, color: '#c62828', label: 'Very Poor',  range: '0.40 – 0.49' },
    { grade: 'F', min: -Infinity, color: '#7f0000', label: 'Failed', range: '< 0.40 or no score' },
]
const CANCELLED_STATUSES = ['stopped', 'cancelled', 'canceled']

const getGrade = (avgScore) => {
    if (avgScore === null || avgScore === undefined) return GRADE_CONFIG[GRADE_CONFIG.length - 1]
    for (const cfg of GRADE_CONFIG) {
        if (avgScore >= cfg.min) return cfg
    }
    return GRADE_CONFIG[GRADE_CONFIG.length - 1]
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
    const [entryTabValue, setEntryTabValue] = useState(0)

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue)
    }
    
    const handleEntryTabChange = (event, newValue) => {
        setEntryTabValue(newValue)
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

    const handleOpenDrawer = (result, snapshotEntry) => {
        setEntryTabValue(0)
        setSelectedEntry({ ...result, _snapshotEntry: snapshotEntry })
        setDrawerOpen(true)
    }

    const handleCloseDrawer = () => {
        setDrawerOpen(false)
        setSelectedEntry(null)
    }

    const getEffectiveStatus = (runData) => {
        if (CANCELLED_STATUSES.includes(runData?.status)) {
            return 'stopped'
        }
        return runData?.status
    }

    const isCancelledRun = (runData) => CANCELLED_STATUSES.includes(runData?.status)

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

    const getExpectedOutput = (result, snapshotEntry) => {
        return result?.expected_output ?? snapshotEntry?.expected_output ?? result?.entry?.expected_output ?? null
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
                // Use snapshot first; fall back to live fetch only for old runs without snapshot
                if (res.data.dataset_name_snapshot) {
                    setDatasetName(res.data.dataset_name_snapshot)
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
                                                {(() => {
                                                    const effStatus = getEffectiveStatus(run)
                                                    const statusLabel = {
                                                        running: 'running',
                                                        pending: 'pending',
                                                        completed: 'completed',
                                                        failed: 'failed',
                                                        stopped: 'cancelled',
                                                    }[effStatus] ?? effStatus
                                                    const statusColor = {
                                                        running: 'primary',
                                                        pending: 'default',
                                                        completed: 'success',
                                                        failed: 'error',
                                                        stopped: 'default',
                                                    }[effStatus] ?? 'default'
                                                    const isActive = run.status === 'running' || run.status === 'pending'
                                                    return (
                                                        <Chip
                                                            label={statusLabel}
                                                            color={statusColor}
                                                            size='small'
                                                            icon={isActive ? <CircularProgress size={10} color='inherit' /> : undefined}
                                                        />
                                                    )
                                                })()}
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
                                                Average Metric Scores
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
                                <Stack direction='row' alignItems='center' sx={{ mb: 1.5 }}>
                                    <Typography variant='h6'>
                                        Evaluation Results ({run.results.length} entries)
                                    </Typography>
                                </Stack>
                                {/* Grade Distribution Summary */}
                                {(() => {
                                    const gradeCounts = {}
                                    GRADE_CONFIG.forEach((g) => { gradeCounts[g.grade] = 0 })
                                    run.results.forEach((result) => {
                                        const entries = (Array.isArray(run.metrics) ? run.metrics : [])
                                            .map((m) => [m, result.metric_scores?.[m]])
                                            .filter(([, s]) => Boolean(s))
                                        const validScores = entries
                                            .map(([, s]) => s.score)
                                            .filter((s) => s !== null && s !== undefined && typeof s === 'number')
                                        const avg = validScores.length > 0
                                            ? validScores.reduce((a, b) => a + b, 0) / validScores.length
                                            : null
                                        gradeCounts[getGrade(avg).grade]++
                                    })
                                    return (
                                        <Stack direction='row' alignItems='center' spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
                                            <Typography variant='caption' color='textSecondary' sx={{ fontWeight: 600 }}>
                                                Distribution:
                                            </Typography>
                                            {GRADE_CONFIG.map((cfg) => {
                                                const count = gradeCounts[cfg.grade] ?? 0
                                                return (
                                                    <Box
                                                        key={cfg.grade}
                                                        sx={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 0.5,
                                                            px: 1, py: 0.25,
                                                            borderRadius: '10px',
                                                            backgroundColor: cfg.color + '18',
                                                            border: `1.5px solid ${cfg.color}55`,
                                                            opacity: count === 0 ? 0.3 : 1,
                                                            transition: 'opacity 0.2s',
                                                        }}
                                                    >
                                                        <Typography variant='caption' sx={{ fontWeight: 700, color: cfg.color, lineHeight: 1 }}>
                                                            Grade {cfg.grade}
                                                        </Typography>
                                                        <Typography variant='caption' sx={{ color: 'text.secondary', lineHeight: 1 }}>
                                                            {count}
                                                        </Typography>
                                                    </Box>
                                                )
                                            })}
                                            <Tooltip
                                                placement='top'
                                                title={
                                                    <Box sx={{ p: 0.5 }}>
                                                        <Typography variant='caption' sx={{ fontWeight: 700, display: 'block', mb: 0.75 }}>
                                                            Grading Scale (avg metric score)
                                                        </Typography>
                                                        {GRADE_CONFIG.map((g) => (
                                                            <Typography key={g.grade} variant='caption' sx={{ display: 'block', lineHeight: 1.8 }}>
                                                                <strong style={{ color: g.color }}>{g.grade}</strong>
                                                                {' – '}{g.label}: {g.range}
                                                            </Typography>
                                                        ))}
                                                    </Box>
                                                }
                                            >
                                                <IconButton size='small' sx={{ p: 0 }}>
                                                    <IconInfoCircle size={14} />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    )
                                })()}
                                {(() => {
                                        const snapshotMap = {}
                                        if (Array.isArray(run.dataset_entries_snapshot)) {
                                            run.dataset_entries_snapshot.forEach((e) => { snapshotMap[e.id] = e })
                                        }
                                        const hasContext = run.results.some(
                                            (r) => {
                                                const snapshotEntry = snapshotMap[r.entry_id]
                                                return (r.entry?.context && r.entry.context.length > 0)
                                                    || (snapshotEntry?.context && snapshotEntry.context.length > 0)
                                            }
                                        )
                                        return (
                                            <TableContainer component={Paper}>
                                                <Table size='small' sx={{ tableLayout: 'fixed' }}>
                                                    <TableHead>
                                                        <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100' }}>
                                                            <StyledTableCell sx={{ width: '80px' }}>Entry</StyledTableCell>
                                                            <StyledTableCell sx={{ width: hasContext ? '14%' : '16%' }}>Input</StyledTableCell>
                                                            {hasContext && <StyledTableCell sx={{ width: '12%' }}>Context</StyledTableCell>}
                                                            <StyledTableCell sx={{ width: hasContext ? '16%' : '18%' }}>Actual Output</StyledTableCell>
                                                            <StyledTableCell sx={{ width: hasContext ? '16%' : '18%' }}>Expected Output</StyledTableCell>
                                                            <StyledTableCell sx={{ width: '160px' }}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                    <span>Eval Score</span>
                                                                </Box>
                                                            </StyledTableCell>
                                                            <StyledTableCell sx={{ width: hasContext ? '18%' : '20%' }}>Reason</StyledTableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {(() => {
                                                            return run.results.map((result) => {
                                                                const snapshotEntry = snapshotMap[result.entry_id]
                                                                const orderedMetricEntries = getOrderedMetricEntries(run, result)
                                                                const failReasons = getResultReasons(run, result)
                                                                const failReasonText = failReasons.join('\n')
                                                                const expectedOutput = getExpectedOutput(result, snapshotEntry)
                                                                return (
                                                                    <StyledTableRow 
                                                                        key={result.id}
                                                                        hover
                                                                        onClick={() => handleOpenDrawer(result, snapshotEntry)}
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
                                                                                    {(snapshotEntry?.input ?? result.entry?.input) || '—'}
                                                                                </Typography>
                                                                                <Box sx={(t) => ({ position: 'absolute', bottom: 0, left: 0, right: 0, height: '36px', background: `linear-gradient(to bottom, transparent, ${t.palette.background.paper})`, pointerEvents: 'none' })} />
                                                                            </Box>
                                                                        </StyledTableCell>
                                                                        {hasContext && (
                                                                            <StyledTableCell sx={{ position: 'relative', p: 0, overflow: 'hidden' }}>
                                                                                <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden', padding: '8px 12px' }}>
                                                                                    <Typography variant='caption' sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', display: 'block' }}>
                                                                                        {(() => {
                                                                                            const ctx = snapshotEntry?.context ?? result.entry?.context
                                                                                            return ctx?.length > 0 ? ctx.join('\n\n') : '—'
                                                                                        })()}
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
                                                                        <StyledTableCell sx={{ position: 'relative', p: 0, overflow: 'hidden' }}>
                                                                            <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden', padding: '8px 12px' }}>
                                                                                <Typography variant='caption' sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', display: 'block' }}>
                                                                                    {expectedOutput || '—'}
                                                                                </Typography>
                                                                                <Box sx={(t) => ({ position: 'absolute', bottom: 0, left: 0, right: 0, height: '36px', background: `linear-gradient(to bottom, transparent, ${t.palette.background.paper})`, pointerEvents: 'none' })} />
                                                                            </Box>
                                                                        </StyledTableCell>
                                                                        <StyledTableCell>
                                                                            {(() => {
                                                                                const validScores = orderedMetricEntries
                                                                                    .map(([, scores]) => scores.score)
                                                                                    .filter((s) => s !== null && s !== undefined && typeof s === 'number')
                                                                                const avgScore = validScores.length > 0
                                                                                    ? validScores.reduce((a, b) => a + b, 0) / validScores.length
                                                                                    : null
                                                                                const gradeCfg = getGrade(avgScore)
                                                                                return (
                                                                                    <Stack spacing={1} alignItems='flex-start' sx={{ minWidth: 0, width: '100%' }}>
                                                                                        <Tooltip title={`${gradeCfg.label} (${gradeCfg.range})`}>
                                                                                            <Box sx={{
                                                                                                display: 'inline-flex', alignItems: 'center',
                                                                                                px: 1, py: 0.25,
                                                                                                borderRadius: '10px',
                                                                                                backgroundColor: gradeCfg.color + '18',
                                                                                                border: `1.5px solid ${gradeCfg.color}55`,
                                                                                                color: gradeCfg.color,
                                                                                                fontWeight: 700,
                                                                                                fontSize: '0.7rem',
                                                                                                userSelect: 'none',
                                                                                                whiteSpace: 'nowrap',
                                                                                                cursor: 'default',
                                                                                            }}>
                                                                                                Grade {gradeCfg.grade}
                                                                                            </Box>
                                                                                        </Tooltip>
                                                                                        {orderedMetricEntries.length > 0 ? (
                                                                                            <Stack spacing={0.25}>
                                                                                                {orderedMetricEntries.map(([metricName, scores]) => (
                                                                                                    <Typography key={metricName} variant='caption' component='div' sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                                                                                                        {metricName}: <strong style={{ color: 'inherit' }}>{formatMetricScore(scores.score)}</strong>
                                                                                                    </Typography>
                                                                                                ))}
                                                                                            </Stack>
                                                                                        ) : (
                                                                                            <Typography variant='caption'>—</Typography>
                                                                                        )}
                                                                                    </Stack>
                                                                                )
                                                                            })()}
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
                                                            })
                                                        })()}
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
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="h6">Entry #{selectedEntry.entry_id} Details</Typography>
                        <IconButton onClick={handleCloseDrawer} size="small">
                            <IconX size={20} />
                        </IconButton>
                    </Box>
                    <Stack spacing={1.25} sx={{ mb: 2, alignItems: 'flex-start' }}>
                        {(() => {
                            const entries = getOrderedMetricEntries(run, selectedEntry)
                            const validScores = entries
                                .map(([, s]) => s.score)
                                .filter((s) => s !== null && s !== undefined && typeof s === 'number')
                            const avgScore = validScores.length > 0
                                ? validScores.reduce((a, b) => a + b, 0) / validScores.length
                                : null
                            const gradeCfg = getGrade(avgScore)
                            return (
                                <Stack spacing={1} sx={{ flex: 1, minWidth: 0, width: '100%' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                                        <Typography variant="overline" color="textSecondary" sx={{ lineHeight: 1, flexShrink: 0 }}>
                                            Eval Score:
                                        </Typography>
                                        <Tooltip title={`${gradeCfg.label} (${gradeCfg.range})`}>
                                            <Box sx={{
                                                display: 'inline-flex', alignItems: 'center',
                                                px: 1.25, py: 0.375,
                                                borderRadius: '10px',
                                                backgroundColor: gradeCfg.color + '18',
                                                border: `1.5px solid ${gradeCfg.color}55`,
                                                color: gradeCfg.color,
                                                fontWeight: 700,
                                                fontSize: '0.78rem',
                                                userSelect: 'none',
                                                cursor: 'default',
                                                width: 'fit-content',
                                            }}>
                                                Grade {gradeCfg.grade}
                                            </Box>
                                        </Tooltip>
                                    </Box>
                                    {entries.length > 0 ? (
                                        <Stack spacing={0.25}>
                                            {entries.map(([metricName, scoreDetails]) => (
                                                <Typography key={metricName} variant='caption' component='div' sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                                                    {metricName}: <strong style={{ color: 'inherit' }}>{formatMetricScore(scoreDetails.score)}</strong>
                                                </Typography>
                                            ))}
                                        </Stack>
                                    ) : (
                                        <Typography variant='body2' color='textSecondary'>N/A</Typography>
                                    )}
                                </Stack>
                            )
                        })()}
                    </Stack>
                    <Divider />
                    
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs variant="scrollable" scrollButtons="auto" value={entryTabValue} onChange={handleEntryTabChange} aria-label="entry details tabs">
                            <Tab label="Input" />
                            <Tab label="Context" disabled={!((selectedEntry._snapshotEntry?.context ?? selectedEntry.entry?.context)?.length > 0)} />
                            <Tab label="Actual Output" />
                            <Tab label="Expected Output" disabled={!getExpectedOutput(selectedEntry, selectedEntry._snapshotEntry)} />
                            <Tab label="Reasons" disabled={getResultReasons(run, selectedEntry).length === 0} />
                        </Tabs>
                    </Box>

                    <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1, mt: 1 }}>
                        <TabPanel value={entryTabValue} index={0}>
                            <Paper variant="outlined" sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50' }}>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {(selectedEntry._snapshotEntry?.input ?? selectedEntry.entry?.input) || '—'}
                                </Typography>
                            </Paper>
                        </TabPanel>
                        
                        <TabPanel value={entryTabValue} index={1}>
                            {(() => {
                                const ctxList = selectedEntry._snapshotEntry?.context ?? selectedEntry.entry?.context
                                return ctxList && ctxList.length > 0 && (
                                    <Paper variant="outlined" sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50' }}>
                                        {ctxList.map((ctx, idx) => (
                                            <Typography key={idx} variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', mb: idx < ctxList.length - 1 ? 2 : 0 }}>
                                                {ctx}
                                            </Typography>
                                        ))}
                                    </Paper>
                                )
                            })()}
                        </TabPanel>

                        <TabPanel value={entryTabValue} index={2}>
                            <Paper variant="outlined" sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50' }}>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {selectedEntry.actual_output || '—'}
                                </Typography>
                            </Paper>
                        </TabPanel>

                        <TabPanel value={entryTabValue} index={3}>
                            {getExpectedOutput(selectedEntry, selectedEntry._snapshotEntry) && (
                                <Paper variant="outlined" sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50' }}>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {getExpectedOutput(selectedEntry, selectedEntry._snapshotEntry)}
                                    </Typography>
                                </Paper>
                            )}
                        </TabPanel>

                        <TabPanel value={entryTabValue} index={4}>
                            {getResultReasons(run, selectedEntry).length > 0 && (
                                <Paper variant="outlined" sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50' }}>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {getResultReasons(run, selectedEntry).join('\n')}
                                    </Typography>
                                </Paper>
                            )}
                        </TabPanel>
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
