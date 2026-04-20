import { useState, useEffect, useRef, useCallback } from 'react'
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
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    Tooltip,
    Typography
} from '@mui/material'
import { useTheme, styled } from '@mui/material/styles'
import { tableCellClasses } from '@mui/material/TableCell'

// icons
import { IconPlus, IconRefresh, IconEye, IconTrash } from '@tabler/icons-react'

// API
import evaluationApi from '@/api/evaluation'

// components
import CreateRunModal from './CreateRunModal'
import RunDetailsModal from './RunDetailsModal'

import { StyledButton } from '@/ui-component/button/StyledButton'

const POLL_INTERVAL_MS = 5000
const ACTIVE_STATUSES = ['pending', 'running']

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: theme.palette.grey[900] + 25,
    verticalAlign: 'middle',
    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.grey[900]
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14
    }
}))

const OverflowTypography = styled(Typography)(() => ({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block'
}))


const StyledTableRow = styled(TableRow)(() => ({
    '&:last-child td, &:last-child th': {
        border: 0
    }
}))

const statusColor = (status) => {
    switch (status) {
        case 'completed':
            return 'success'
        case 'failed':
            return 'error'
        case 'running':
            return 'primary'
        case 'pending':
        default:
            return 'default'
    }
}

const effectiveRunStatus = (run) => {
    if (run.status === 'completed' && run.results?.some((r) => r.passed === false)) {
        return 'failed'
    }
    return run.status
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

const computeMetricAverages = (run) => {
    const metrics = run.metrics || []
    if (metrics.length === 0) return []

    const results = run.results || []
    return metrics.map((metricName) => {
        const scores = results
            .map((r) => r.metric_scores?.[metricName]?.score)
            .filter((s) => s !== null && s !== undefined && typeof s === 'number')
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
        return { metric: metricName, avg }
    })
}

const getRunId = (run) => run?.id ?? run?.run_id

const ExecutionTab = ({ isVisible }) => {
    const theme = useTheme()

    const [runs, setRuns] = useState([])
    const [datasetMap, setDatasetMap] = useState({})
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const [order, setOrder] = useState('desc')
    const [orderBy, setOrderBy] = useState('created_at')
    const [createModalOpen, setCreateModalOpen] = useState(false)
    const [detailsModalOpen, setDetailsModalOpen] = useState(false)
    const [selectedRunId, setSelectedRunId] = useState(null)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [runToDelete, setRunToDelete] = useState(null)
    const [deleting, setDeleting] = useState(false)

    // Track interval ids per run_id
    const pollTimersRef = useRef({})

    const stopPolling = useCallback((runId) => {
        if (pollTimersRef.current[runId]) {
            clearInterval(pollTimersRef.current[runId])
            delete pollTimersRef.current[runId]
        }
    }, [])

    const startPolling = useCallback(
        (runId) => {
            if (pollTimersRef.current[runId]) return
            pollTimersRef.current[runId] = setInterval(async () => {
                try {
                    const res = await evaluationApi.getRun(runId)
                    const updated = res.data
                    setRuns((prev) =>
                        prev.map((r) => (getRunId(r) === runId ? { ...r, ...updated } : r))
                    )
                    if (!ACTIVE_STATUSES.includes(updated?.status)) {
                        stopPolling(runId)
                    }
                } catch {
                    stopPolling(runId)
                }
            }, POLL_INTERVAL_MS)
        },
        [stopPolling]
    )

    const loadRuns = useCallback(async () => {
        try {
            setIsLoading(true)
            setError(null)
            const [runsRes, datasetsRes] = await Promise.all([
                evaluationApi.getRuns(),
                evaluationApi.getDatasets().catch(() => ({ data: [] }))
            ])
            let data = runsRes.data || []
            const dsMap = {}
            ;(datasetsRes.data || []).forEach((ds) => { dsMap[ds.id] = ds.name })
            setDatasetMap(dsMap)
            
            // Start polling for any active runs
            data.forEach((run) => {
                if (ACTIVE_STATUSES.includes(run.status)) {
                    startPolling(getRunId(run))
                }
            })
            
            // Wait for full details of completed runs so we can detect per-entry failures
            const completedRuns = data.filter((r) => r.status === 'completed')
            if (completedRuns.length > 0) {
                const responses = await Promise.all(
                    completedRuns.map((r) =>
                        evaluationApi.getRun(getRunId(r)).catch(() => null)
                    )
                )
                const updates = {}
                responses.forEach((resp, idx) => {
                    if (resp?.data) updates[getRunId(completedRuns[idx])] = resp.data
                })
                if (Object.keys(updates).length > 0) {
                    data = data.map((r) => (updates[getRunId(r)] ? { ...r, ...updates[getRunId(r)] } : r))
                }
            }
            
            setRuns(data)
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to load evaluation runs.')
        } finally {
            setIsLoading(false)
        }
    }, [startPolling])

    useEffect(() => {
        if (isVisible) loadRuns()
    }, [isVisible, loadRuns])

    // Cleanup all poll timers on unmount
    useEffect(() => {
        return () => {
            Object.keys(pollTimersRef.current).forEach((id) => clearInterval(pollTimersRef.current[id]))
            pollTimersRef.current = {}
        }
    }, [])

    const handleRunCreated = (newRun) => {
        setRuns((prev) => [newRun, ...prev])
        if (ACTIVE_STATUSES.includes(newRun.status)) {
            startPolling(getRunId(newRun))
        }
    }

    const handleOpenDetails = (runId) => {
        setSelectedRunId(runId)
        setDetailsModalOpen(true)
    }

    const handleCloseDetails = () => {
        setDetailsModalOpen(false)
        setSelectedRunId(null)
    }

    const handleOpenDeleteConfirm = (e, run) => {
        e.stopPropagation()
        setRunToDelete(run)
        setDeleteConfirmOpen(true)
    }

    const handleConfirmDelete = async () => {
        if (!runToDelete) return
        try {
            setDeleting(true)
            await evaluationApi.deleteRun(getRunId(runToDelete))
            setRuns((prev) => prev.filter((r) => getRunId(r) !== getRunId(runToDelete)))
            stopPolling(getRunId(runToDelete))
            setDeleteConfirmOpen(false)
            setRunToDelete(null)
        } catch (err) {
            setError(err?.response?.data?.detail || 'Failed to delete run.')
        } finally {
            setDeleting(false)
        }
    }

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc'
        setOrder(isAsc ? 'desc' : 'asc')
        setOrderBy(property)
    }

    const sortedRuns = [...runs].sort((a, b) => {
        let cmp = 0
        if (orderBy === 'created_at') {
            cmp = new Date(a.created_at) - new Date(b.created_at)
        } else if (orderBy === 'run_id') {
            cmp = String(getRunId(a)).localeCompare(String(getRunId(b)))
        } else if (orderBy === 'status') {
            cmp = String(a.status).localeCompare(String(b.status))
        }
        return order === 'asc' ? cmp : -cmp
    })

    const columns = [
        { id: 'run_id', label: 'Run ID' },
        { id: 'sandbox_id', label: 'Sandbox', sortable: false },
        { id: 'dataset_id', label: 'Dataset', sortable: false },
        { id: 'model_name', label: 'Judge Model', sortable: false },
        { id: 'status', label: 'Status' },
        { id: 'score_summary', label: 'Score Summary', sortable: false },
        { id: 'created_at', label: 'Created At' },
        { id: 'actions', label: 'Actions', sortable: false }
    ]

    return (
        <Box>
            <Stack direction='row' justifyContent='flex-start' alignItems='center' sx={{ mb: 2 }} spacing={1}>
                <StyledButton
                    variant='contained'
                    startIcon={<IconPlus size={16} />}
                    onClick={() => setCreateModalOpen(true)}
                    sx={{ borderRadius: 2, height: 40 }}
                >
                    Create New Run
                </StyledButton>
                <Tooltip title='Refresh'>
                    <StyledButton
                        size='small'
                        variant='outlined'
                        onClick={loadRuns}
                        disabled={isLoading}
                        startIcon={isLoading ? <CircularProgress size={14} /> : <IconRefresh size={16} />}
                        sx={{ borderRadius: 2, height: 40 }}
                    >
                        Refresh
                    </StyledButton>
                </Tooltip>
            </Stack>

            {error && (
                <Typography color='error' sx={{ mb: 2 }}>
                    {error}
                </Typography>
            )}

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            {columns.map((col) => (
                                <StyledTableCell key={col.id}>
                                    {col.sortable === false ? (
                                        col.label
                                    ) : (
                                        <TableSortLabel
                                            active={orderBy === col.id}
                                            direction={orderBy === col.id ? order : 'asc'}
                                            onClick={() => handleRequestSort(col.id)}
                                        >
                                            {col.label}
                                        </TableSortLabel>
                                    )}
                                </StyledTableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <StyledTableRow>
                                <StyledTableCell colSpan={8} align='center' sx={{ py: 4 }}>
                                    <CircularProgress size={24} />
                                </StyledTableCell>
                            </StyledTableRow>
                        ) : sortedRuns.length === 0 ? (
                            <StyledTableRow>
                                <StyledTableCell colSpan={8} align='center' sx={{ py: 4 }}>
                                    <Typography variant='body2' color='text.secondary'>
                                        No evaluation runs yet. Click &quot;Create New Run&quot; to get started.
                                    </Typography>
                                </StyledTableCell>
                            </StyledTableRow>
                        ) : (
                            sortedRuns.map((run) => (
                                <StyledTableRow
                                    key={getRunId(run)}
                                    hover
                                    onClick={() => handleOpenDetails(getRunId(run))}
                                    sx={{ cursor: 'pointer' }}
                                >
                                    <StyledTableCell sx={{ maxWidth: 120 }}>
                                        <Typography variant='body2' sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                                            {getRunId(run)}
                                        </Typography>
                                    </StyledTableCell>
                                    <StyledTableCell sx={{ maxWidth: 180 }}>
                                        <Typography variant='body2' sx={{ fontSize: '0.9rem', wordBreak: 'break-all' }}>
                                            {run.sandbox_id || '—'}
                                        </Typography>
                                    </StyledTableCell>
                                    <StyledTableCell sx={{ maxWidth: 160 }}>
                                        <Typography variant='body2' sx={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>
                                            {datasetMap[run.dataset_id] || run.dataset_id || '—'}
                                        </Typography>
                                    </StyledTableCell>
                                    <StyledTableCell sx={{ maxWidth: 160 }}>
                                        <Typography variant='body2' sx={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>
                                            {run.model_name || '—'}
                                        </Typography>
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Chip
                                            label={effectiveRunStatus(run)}
                                            color={statusColor(effectiveRunStatus(run))}
                                            size='small'
                                            icon={
                                                ACTIVE_STATUSES.includes(run.status) ? (
                                                    <CircularProgress size={12} color='inherit' />
                                                ) : undefined
                                            }
                                        />
                                    </StyledTableCell>
                                    <StyledTableCell sx={{ minWidth: 140, maxWidth: 'none' }}>
                                        {(() => {
                                            const metricAvgs = computeMetricAverages(run)
                                            if (metricAvgs.length === 0) return <Typography variant='body2' color='text.secondary'>N/A</Typography>
                                            return (
                                                <Stack spacing={0.5}>
                                                    {metricAvgs.map(({ metric, avg }) => (
                                                        <Box key={metric} sx={{ fontSize: '0.8rem' }}>
                                                            <Typography variant='caption' component='div'>
                                                                <strong>{metric}:</strong>{' '}
                                                                {avg !== null ? avg.toFixed(3) : 'N/A'}
                                                            </Typography>
                                                        </Box>
                                                    ))}
                                                </Stack>
                                            )
                                        })()}
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Tooltip title={formatDate(run.created_at)} placement='top'>
                                            <OverflowTypography variant='body2'>{formatDate(run.created_at)}</OverflowTypography>
                                        </Tooltip>
                                    </StyledTableCell>
                                    <StyledTableCell onClick={(e) => e.stopPropagation()}>
                                        <Stack direction='row' spacing={0.5}>
                                            <Tooltip title='View Details'>
                                                <IconButton
                                                    size='small'
                                                    color='primary'
                                                    onClick={() => handleOpenDetails(getRunId(run))}
                                                >
                                                    <IconEye size={16} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title='Delete'>
                                                <IconButton
                                                    size='small'
                                                    color='error'
                                                    onClick={(e) => handleOpenDeleteConfirm(e, run)}
                                                >
                                                    <IconTrash size={16} />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    </StyledTableCell>
                                </StyledTableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <CreateRunModal
                open={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onRunCreated={handleRunCreated}
            />

            <RunDetailsModal
                open={detailsModalOpen}
                onClose={handleCloseDetails}
                runId={selectedRunId}
            />

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
                <DialogTitle>Delete Run?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete this evaluation run? This action cannot be undone.
                    </Typography>
                    {runToDelete && (
                        <Typography variant='caption' color='textSecondary' sx={{ mt: 1, display: 'block' }}>
                            Run ID: {getRunId(runToDelete).substring(0, 12)}...
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleConfirmDelete}
                        color='error'
                        variant='contained'
                        disabled={deleting}
                        startIcon={deleting ? <CircularProgress size={14} /> : undefined}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

ExecutionTab.propTypes = {
    isVisible: PropTypes.bool
}

export default ExecutionTab
