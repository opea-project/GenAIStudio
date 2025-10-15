import { useState } from 'react'
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
import { useTheme } from '@mui/material/styles'

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

const FinetuningJobsTable = ({ data, isLoading = false, onRefresh = null }) => {
    const theme = useTheme()
    const [anchorEl, setAnchorEl] = useState(null)
    const [selectedJob, setSelectedJob] = useState(null)
    const [actionLoading, setActionLoading] = useState(false)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [detailsData, setDetailsData] = useState(null)
    const [checkpointsOpen, setCheckpointsOpen] = useState(false)
    const [checkpointsData, setCheckpointsData] = useState(null)

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

    return (
        <>
            <style>{`@keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.2; } 100% { opacity: 1; } }`}</style>
            <TableContainer component={Paper}>
            <Table>
                <TableHead>
                        <TableRow>
                        <TableCell><strong>Job ID</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                        <TableCell><strong>Model</strong></TableCell>
                        <TableCell><strong>Task</strong></TableCell>
                        <TableCell><strong>Dataset</strong></TableCell>
                        <TableCell><strong>Checkpoints</strong></TableCell>
                        <TableCell><strong>Actions</strong></TableCell>
                        <TableCell><strong>Created Date</strong></TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.map((job) => (
                        <TableRow key={job.id} hover>
                            <TableCell>
                                <Typography variant="subtitle2" fontWeight="600">
                                    {job.id}
                                </Typography>
                            </TableCell>
                            <TableCell>
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
                            </TableCell>
                            <TableCell>
                                <Typography variant="body2">
                                    {job.model || 'N/A'}
                                </Typography>
                            </TableCell>
                                <TableCell>
                                    <Typography variant="body2">
                                        {job.task || job.task_type || job.taskType || 'N/A'}
                                    </Typography>
                                </TableCell>
                            <TableCell>
                                <Typography variant="body2">
                                    {job.dataset || 'N/A'}
                                </Typography>
                            </TableCell>
                            {/* Progress column removed per request */}
                            <TableCell>
                                <Button
                                    size="small"
                                    startIcon={<IconCheckbox />}
                                    onClick={() => handleViewCheckpoints(job)}
                                >
                                    View
                                </Button>
                            </TableCell>
                            <TableCell>
                                <IconButton
                                    size="small"
                                    onClick={(e) => handleMenuClick(e, job)}
                                >
                                    <IconDots />
                                </IconButton>
                            </TableCell>
                            <TableCell>
                                <Typography variant="body2">
                                    {job.createdDate ? formatDate(job.createdDate) : 'Unknown'}
                                </Typography>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
                <MenuItem onClick={handleViewDetails} disabled={actionLoading}>
                    <IconEye style={{ marginRight: 8 }} size={16} />
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
            </TableContainer>
        </>
    )
}

FinetuningJobsTable.propTypes = {
    data: PropTypes.array.isRequired,
    isLoading: PropTypes.bool,
    onRefresh: PropTypes.func
}

// default props handled via function default parameters

export default FinetuningJobsTable