import { useState, useMemo, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import PropTypes from 'prop-types'

// material-ui
import {
    Box,
    Button,
    Chip,
    LinearProgress,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    Typography,
    IconButton,
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText
} from '@mui/material'
import { useTheme, styled } from '@mui/material/styles'
import { tableCellClasses } from '@mui/material/TableCell'

// icons
import { IconDots, IconEye, IconTrash, IconDownload, IconPlayerStop, IconCheckbox } from '@tabler/icons-react'

// API
import finetuningApi from '@/api/finetuning'

// utils - format created date as 'MonthName DayOrdinal, Year' e.g. 'September 4th, 2025'
const formatDate = (date) => {
    if (!date) return 'Unknown'
    let dt
    try {
        if (typeof date === 'number') {
            dt = date < 1e12 ? new Date(date * 1000) : new Date(date)
        } else if (typeof date === 'string' && /^\d+$/.test(date)) {
            const n = parseInt(date, 10)
            dt = n < 1e12 ? new Date(n * 1000) : new Date(n)
        } else {
            dt = new Date(date)
        }
        if (isNaN(dt.getTime())) return 'Unknown'

        const month = dt.toLocaleString('default', { month: 'long' })
        const day = dt.getDate()
        const year = dt.getFullYear()

        const ordinal = (n) => {
            const s = ["th", "st", "nd", "rd"]
            const v = n % 100
            return s[(v - 20) % 10] || s[v] || s[0]
        }

        return `${month} ${day}${ordinal(day)}, ${year}`
    } catch (e) {
        return 'Unknown'
    }
}

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
    '&:last-child td, &:last-child th': {
        border: 0
    }
}))

const FinetuningJobsTable = ({ data, isLoading = false, onRefresh = null, filterFunction = null }) => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    // sorting
    const [order, setOrder] = useState('asc')
    const [orderBy, setOrderBy] = useState('createdDate')
    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc'
        setOrder(isAsc ? 'desc' : 'asc')
        setOrderBy(property)
    }
    // sorted data
    const sortedData = useMemo(() => {
        if (!data) return []
        return [...data].sort((a, b) => {
            let cmp = 0
            if (orderBy === 'id') {
                cmp = String(a.id).localeCompare(String(b.id))
            } else if (orderBy === 'createdDate') {
                cmp = new Date(a.createdDate) - new Date(b.createdDate)
            } else {
                cmp = 0
            }
            return order === 'asc' ? cmp : -cmp
        })
    }, [data, order, orderBy])
    const [anchorEl, setAnchorEl] = useState(null)
    const [selectedJob, setSelectedJob] = useState(null)
    const [actionLoading, setActionLoading] = useState(false)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [detailsData, setDetailsData] = useState(null)
    const [checkpointsOpen, setCheckpointsOpen] = useState(false)
    const [checkpointsData, setCheckpointsData] = useState(null)
    const [logsOpen, setLogsOpen] = useState(false)
    const [logsData, setLogsData] = useState('')
    const [logsLoading, setLogsLoading] = useState(false)
    const logsContainerRef = useRef(null)

    // When logs dialog opens or logsData changes, scroll to bottom
    useEffect(() => {
        if (!logsOpen) return
        // scroll after next paint to ensure content is rendered
        const id = setTimeout(() => {
            try {
                const el = logsContainerRef.current
                if (el) {
                    el.scrollTop = el.scrollHeight
                }
            } catch (e) {
                // ignore
            }
        }, 0)
        return () => clearTimeout(id)
    }, [logsOpen, logsData])

    const handleMenuClick = (event, job) => {
        setAnchorEl(event.currentTarget)
        setSelectedJob(job)
    }

    const handleMenuClose = () => {
        setAnchorEl(null)
        setSelectedJob(null)
    }

    const handleCancelJob = async () => {
        if (!selectedJob) return
        
        setActionLoading(true)
        try {
            await finetuningApi.cancelJob(selectedJob.id)
            handleMenuClose()
            if (onRefresh) onRefresh()
        } catch (error) {
            console.error('Error canceling job:', error)
            alert('Failed to cancel job: ' + (error.message || 'Unknown error'))
        } finally {
            setActionLoading(false)
        }
    }

    const handleViewCheckpoints = async (jobArg = null) => {
        const jobToUse = jobArg || selectedJob
        if (!jobToUse) return

        // ensure selectedJob is set for downstream operations
        setSelectedJob(jobToUse)

        setActionLoading(true)
        try {
            const response = await finetuningApi.listCheckpoints(jobToUse.id)
            setCheckpointsData(response.data)
            setCheckpointsOpen(true)
            handleMenuClose()
        } catch (error) {
            console.error('Error fetching checkpoints:', error)
            alert('Failed to fetch checkpoints: ' + (error.message || 'Unknown error'))
        } finally {
            setActionLoading(false)
        }
    }

    const handleViewLogs = async (jobArg = null) => {
        const jobToUse = jobArg || selectedJob
        if (!jobToUse) return

        // ensure selectedJob is set for downstream operations
        setSelectedJob(jobToUse)

        setLogsLoading(true)
        try {
            // call backend API to fetch logs (may return { logs: string })
            const response = await finetuningApi.getJobLogs(jobToUse.id)
            const body = response.data
            // Support two shapes: { logs: string } or raw string
            if (body && typeof body === 'object' && 'logs' in body) {
                // If the service provided an error message, prefer showing that when logs are empty
                const logsStr = body.logs || ''
                if (!logsStr && body.error) {
                    setLogsData(`Error: ${body.error}`)
                } else {
                    setLogsData(normalizeLogs(logsStr))
                }
            } else if (typeof body === 'string') {
                setLogsData(normalizeLogs(body))
            } else {
                setLogsData(JSON.stringify(body, null, 2))
            }
            setLogsOpen(true)
            handleMenuClose()
        } catch (error) {
            console.error('Error fetching logs:', error)
            alert('Failed to fetch logs: ' + (error?.message || 'Unknown error'))
        } finally {
            setLogsLoading(false)
        }
    }

    // Normalize logs string:
    // - decode common escaped sequences ("\\n", "\\r", "\\t", "\\uXXXX", "\\xHH")
    // - convert escaped ESC sequences into the real ESC character
    // - strip ANSI escape sequences (colors / CSI sequences)
    // - remove C0 control chars except newline, carriage return and tab
    const normalizeLogs = (raw) => {
        if (!raw && raw !== 0) return ''
        try {
            let s = String(raw)

            // Iteratively decode escaped sequences up to a safe depth (handles double-escaped strings)
            for (let i = 0; i < 6; i++) {
                const prev = s
                // common escapes
                s = s.replace(/\\r/g, '\r').replace(/\\n/g, '\n').replace(/\\t/g, '\t')
                // hex and unicode escapes
                s = s.replace(/\\x([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
                s = s.replace(/\\u([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
                // octal-ish common sequence for ESC
                s = s.replace(/\\0?33/g, '\x1b')
                if (s === prev) break
            }

            // Replace any textual \u001b or \x1b left as two-char sequences with actual ESC char
            s = s.replace(/\\u001b/g, '\x1b').replace(/\\x1b/g, '\x1b')
            // Also replace literal textual backslash-u forms that may have survived
            s = s.replace(/\u001b/g, '\x1b')

            // Now convert the string '\x1b' into the real ESC character
            s = s.replace(/\\x1b/g, '\x1b')
            s = s.replace(/\x1b/g, '\x1b')
            // If we have the two-character sequence \x1b, coerce into the actual character
            s = s.replace(/\\x1b/g, '\x1b')
            // Best-effort: turn any remaining textual '\u001b' into the ESC char
            s = s.replace(/\\u001b/g, '\x1b')

            // Finally replace the textual token '\x1b' with the actual ESC character
            s = s.replace(/\\x1b/g, '\x1b')
            s = s.replace(/\x1b/g, String.fromCharCode(27))

            // Remove ANSI CSI/SGR sequences (ESC [ ... letters)
            s = s.replace(/\x1b\[[0-9;=?]*[A-Za-z]/g, '')
            // Remove OSC sequences ESC ] ... BEL or ESC \
            s = s.replace(/\x1b\][^\x1b]*?(\x07|\x1b\\)/g, '')
            // Remove any leftover ESC followed by non-printable run
            s = s.replace(/\x1b[^\n\r]*/g, '')

            // Remove C0 control chars except newline (10), carriage return (13) and tab (9)
            s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

            // Normalize CR to newline so progress-carriage returns become visible lines
            s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

            // Collapse repeated blank lines a bit (optional)
            s = s.replace(/\n{3,}/g, '\n\n')

            // Trim trailing whitespace on each line but keep indentation
            s = s.split('\n').map((l) => l.replace(/[\s\u00A0]+$/u, '')).join('\n')

            return s
        } catch (e) {
            // On any failure just return the original string representation
            return String(raw)
        }
    }

    const handleViewDetails = async () => {
        if (!selectedJob) return

        setActionLoading(true)
        try {
            const response = await finetuningApi.getJob(selectedJob.id)
            setDetailsData(response.data)
            setDetailsOpen(true)
            handleMenuClose()
        } catch (error) {
            console.error('Error fetching job details:', error)
            alert('Failed to fetch job details: ' + (error.message || 'Unknown error'))
        } finally {
            setActionLoading(false)
        }
    }

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'completed':
            case 'succeeded':
                return 'success'
            case 'running':
                return 'primary'
            case 'failed':
                return 'error'
            case 'pending':
                return 'default'
            default:
                return 'default'
        }
    }

    const getProgressValue = (progress) => {
        if (typeof progress === 'string' && progress.includes('%')) {
            return parseInt(progress.replace('%', ''))
        }
        return progress || 0
    }

    if (isLoading) {
        return (
            <Box>
                <LinearProgress />
                <Typography variant="body2" sx={{ mt: 1 }}>
                    Loading fine-tuning jobs...
                </Typography>
            </Box>
        )
    }

    if (!data || data.length === 0) {
        return (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" color="textSecondary">
                    No fine-tuning jobs found
                </Typography>
            </Paper>
        )
    }

    const visibleData = useMemo(() => {
        if (!sortedData || sortedData.length === 0) return []
        if (typeof filterFunction === 'function') {
            try {
                return sortedData.filter(filterFunction)
            } catch (e) {
                console.error('Error in filterFunction:', e)
                return sortedData
            }
        }
        return sortedData
    }, [sortedData, filterFunction])

    return (
        <>
            {/* toolbar is provided by parent*/}
            <style>{`@keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.2; } 100% { opacity: 1; } }`}</style>
            <TableContainer sx={{ border: 1, borderColor: theme.palette.grey[900] + 25, borderRadius: 2 }} component={Paper}>
                <Table sx={{ minWidth: 650 }} size='small' aria-label='a dense table'>
                    <TableHead
                        sx={{
                            backgroundColor: customization.isDarkMode ? theme.palette.common.black : theme.palette.grey[100],
                            height: 56
                        }}
                    >
                        <StyledTableRow>
                            <StyledTableCell>
                                <TableSortLabel
                                    active={orderBy === 'id'}
                                    direction={order}
                                    onClick={() => handleRequestSort('id')}
                                >
                                    <strong>ID</strong>
                                </TableSortLabel>
                            </StyledTableCell>
                            <StyledTableCell><strong>Status</strong></StyledTableCell>
                            <StyledTableCell><strong>Model</strong></StyledTableCell>
                            <StyledTableCell><strong>Task</strong></StyledTableCell>
                            <StyledTableCell><strong>Dataset</strong></StyledTableCell>
                            <StyledTableCell><strong>Checkpoints</strong></StyledTableCell>
                            <StyledTableCell align="center"><strong>Logs</strong></StyledTableCell>
                            <StyledTableCell><strong>Actions</strong></StyledTableCell>
                            <StyledTableCell>
                                <TableSortLabel
                                    active={orderBy === 'createdDate'}
                                    direction={order}
                                    onClick={() => handleRequestSort('createdDate')}
                                >
                                    <strong>Created Date</strong>
                                </TableSortLabel>
                            </StyledTableCell>
                        </StyledTableRow>
                    </TableHead>
                    <TableBody>
                        {visibleData.length === 0 ? (
                            <StyledTableRow>
                                <StyledTableCell colSpan={9} align="center">
                                    <Typography variant="body2">No fine-tuning jobs match the current filter</Typography>
                                </StyledTableCell>
                            </StyledTableRow>
                        ) : (
                            visibleData.map((job) => (
                                <StyledTableRow key={job.id}>
                                    <StyledTableCell>
                                        <Typography variant="subtitle2" fontWeight="600">
                                            {job.id}
                                        </Typography>
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        {/* Status with blinking indicator when running; show Chip only for other statuses */}
                                        {String(job.status).toLowerCase() === 'running' ? (
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Box
                                                    sx={{
                                                        width: 10,
                                                        height: 10,
                                                        borderRadius: '50%',
                                                        backgroundColor: theme.palette.primary.main,
                                                        animation: 'blink 1s infinite'
                                                    }}
                                                />
                                                <Typography variant="body2">{job.status}</Typography>
                                            </Stack>
                                        ) : (
                                            <Chip
                                                label={job.status}
                                                color={getStatusColor(job.status)}
                                                size="small"
                                                variant="outlined"
                                            />
                                        )}
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Typography variant="body2">
                                            {job.model || 'N/A'}
                                        </Typography>
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Typography variant="body2">
                                            {job.task || job.task_type || job.taskType || 'N/A'}
                                        </Typography>
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Typography variant="body2">
                                            {job.dataset || 'N/A'}
                                        </Typography>
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Button
                                            size="small"
                                            startIcon={<IconCheckbox />}
                                            onClick={() => handleViewCheckpoints(job)}
                                        >
                                        </Button>
                                    </StyledTableCell>
                                    <StyledTableCell align="center">
                                        <Stack direction="row" spacing={1} justifyContent="center">
                                            <IconButton size="small" color="primary" onClick={() => handleViewLogs(job)} title="Logs">
                                                <IconEye style={{ color: theme.palette.primary.main }} />
                                            </IconButton>
                                        </Stack>
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleMenuClick(e, job)}
                                        >
                                            <IconDots style={{ color: theme.palette.primary.main }} />
                                        </IconButton>
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Typography variant="body2">
                                            {job.createdDate ? formatDate(job.createdDate) : 'Unknown'}
                                        </Typography>
                                    </StyledTableCell>
                                </StyledTableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
                <MenuItem onClick={handleViewDetails} disabled={actionLoading}>
                    <IconEye style={{ marginRight: 8, color: theme.palette.primary.main }} size={16} />
                    View Details
                </MenuItem>
                {/* View Checkpoints removed from Actions menu: use the Checkpoints column button to open the modal */}
                <MenuItem 
                    onClick={handleCancelJob}
                    disabled={actionLoading || selectedJob?.status === 'completed' || selectedJob?.status === 'cancelled' || selectedJob?.status === 'failed'}
                >
                    <IconPlayerStop style={{ marginRight: 8 }} size={16} />
                    Cancel Job
                </MenuItem>
                <MenuItem 
                    onClick={async () => { 
                        if (!selectedJob) return
                        if (!window.confirm('Are you sure you want to delete this job?')) return
                        setActionLoading(true)
                        try {
                            await finetuningApi.deleteJob(selectedJob.id)
                            handleMenuClose()
                            if (onRefresh) onRefresh()
                        } catch (error) {
                            console.error('Error deleting job:', error)
                            alert('Failed to delete job: ' + (error.message || 'Unknown error'))
                        } finally {
                            setActionLoading(false)
                        }
                    }}
                    disabled={actionLoading}
                >
                    <IconTrash style={{ marginRight: 8 }} size={16} />
                    Delete Job
                </MenuItem>
            </Menu>

            {/* Details Dialog */}
            <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Job Details</DialogTitle>
                <DialogContent>
                    {detailsData ? (
                        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(detailsData, null, 2)}</pre>
                    ) : (
                        <Typography variant="body2">No details available</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailsOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Checkpoints Dialog */}
            <Dialog open={checkpointsOpen} onClose={() => setCheckpointsOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Checkpoints</DialogTitle>
                <DialogContent>
                    {checkpointsData && Array.isArray(checkpointsData) && checkpointsData.length > 0 ? (
                        <List>
                            {checkpointsData.map((cp) => (
                                <ListItem key={cp.id || cp.filename}>
                                    <ListItemText primary={cp.filename || cp.id} secondary={cp.metadata ? JSON.stringify(cp.metadata) : null} />
                                </ListItem>
                            ))}
                        </List>
                    ) : (
                        <Typography variant="body2">No checkpoints available</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCheckpointsOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Logs Dialog */}
            <Dialog open={logsOpen} onClose={() => setLogsOpen(false)} maxWidth="lg" fullWidth>
                <DialogTitle>Job Logs</DialogTitle>
                <DialogContent>
                    {logsLoading ? (
                        <Typography variant="body2">Loading logs...</Typography>
                    ) : (
                        <div ref={logsContainerRef} style={{ maxHeight: '60vh', overflow: 'auto' }}>
                            <pre >{logsData || 'No logs available'}</pre>
                        </div>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLogsOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </>
    )
}

FinetuningJobsTable.propTypes = {
    data: PropTypes.array.isRequired,
    isLoading: PropTypes.bool,
    onRefresh: PropTypes.func,
    filterFunction: PropTypes.func
}

FinetuningJobsTable.defaultProps = {
    filterFunction: null
}

// default props handled via function default parameters

export default FinetuningJobsTable