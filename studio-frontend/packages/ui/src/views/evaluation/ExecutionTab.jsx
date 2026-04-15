import { useState, useEffect, useRef, useCallback } from 'react'
import PropTypes from 'prop-types'

// material-ui
import {
    Box,
    Button,
    Chip,
    CircularProgress,
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
import { IconPlus, IconRefresh } from '@tabler/icons-react'

// API
import evaluationApi from '@/api/evaluation'

// components
import CreateRunModal from './CreateRunModal'

const POLL_INTERVAL_MS = 5000
const ACTIVE_STATUSES = ['pending', 'running']

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: theme.palette.grey[900] + 25,
    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.grey[900]
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14,
        height: 56
    }
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

const formatScore = (scoreSummary) => {
    if (!scoreSummary || typeof scoreSummary !== 'object') return '—'
    const entries = Object.entries(scoreSummary)
    if (entries.length === 0) return '—'
    return entries.map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(3) : v}`).join(', ')
}

const ExecutionTab = ({ isVisible }) => {
    const theme = useTheme()

    const [runs, setRuns] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const [order, setOrder] = useState('desc')
    const [orderBy, setOrderBy] = useState('created_at')
    const [createModalOpen, setCreateModalOpen] = useState(false)

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
                        prev.map((r) => (r.run_id === runId ? { ...r, ...updated } : r))
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
            const res = await evaluationApi.getRuns()
            const data = res.data || []
            setRuns(data)
            // Start polling for any active runs
            data.forEach((run) => {
                if (ACTIVE_STATUSES.includes(run.status)) {
                    startPolling(run.run_id)
                }
            })
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
            startPolling(newRun.run_id)
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
            cmp = String(a.run_id).localeCompare(String(b.run_id))
        } else if (orderBy === 'status') {
            cmp = String(a.status).localeCompare(String(b.status))
        }
        return order === 'asc' ? cmp : -cmp
    })

    const columns = [
        { id: 'run_id', label: 'Run ID' },
        { id: 'sandbox_id', label: 'Sandbox', sortable: false },
        { id: 'status', label: 'Status' },
        { id: 'score_summary', label: 'Score Summary', sortable: false },
        { id: 'created_at', label: 'Created At' }
    ]

    return (
        <Box>
            <Stack direction='row' justifyContent='flex-end' alignItems='center' sx={{ mb: 2 }} spacing={1}>
                <Tooltip title='Refresh'>
                    <Button
                        size='small'
                        variant='outlined'
                        onClick={loadRuns}
                        disabled={isLoading}
                        startIcon={isLoading ? <CircularProgress size={14} /> : <IconRefresh size={16} />}
                    >
                        Refresh
                    </Button>
                </Tooltip>
                <Button
                    variant='contained'
                    startIcon={<IconPlus size={16} />}
                    onClick={() => setCreateModalOpen(true)}
                >
                    New Run
                </Button>
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
                                <StyledTableCell colSpan={5} align='center' sx={{ py: 4 }}>
                                    <CircularProgress size={24} />
                                </StyledTableCell>
                            </StyledTableRow>
                        ) : sortedRuns.length === 0 ? (
                            <StyledTableRow>
                                <StyledTableCell colSpan={5} align='center' sx={{ py: 4 }}>
                                    <Typography variant='body2' color='text.secondary'>
                                        No evaluation runs yet. Click &quot;New Run&quot; to get started.
                                    </Typography>
                                </StyledTableCell>
                            </StyledTableRow>
                        ) : (
                            sortedRuns.map((run) => (
                                <StyledTableRow key={run.run_id} hover>
                                    <StyledTableCell>
                                        <Typography variant='body2' sx={{ fontFamily: 'monospace' }}>
                                            {run.run_id}
                                        </Typography>
                                    </StyledTableCell>
                                    <StyledTableCell>{run.sandbox_id || '—'}</StyledTableCell>
                                    <StyledTableCell>
                                        <Chip
                                            label={run.status}
                                            color={statusColor(run.status)}
                                            size='small'
                                            icon={
                                                ACTIVE_STATUSES.includes(run.status) ? (
                                                    <CircularProgress size={12} color='inherit' />
                                                ) : undefined
                                            }
                                        />
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Typography variant='body2'>{formatScore(run.score_summary)}</Typography>
                                    </StyledTableCell>
                                    <StyledTableCell>{formatDate(run.created_at)}</StyledTableCell>
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
        </Box>
    )
}

ExecutionTab.propTypes = {
    isVisible: PropTypes.bool
}

export default ExecutionTab
