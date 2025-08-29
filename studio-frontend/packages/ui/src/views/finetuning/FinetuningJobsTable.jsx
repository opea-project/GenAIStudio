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
    MenuItem
} from '@mui/material'
import { useTheme } from '@mui/material/styles'

// icons
import { IconDots, IconEye, IconTrash, IconDownload } from '@tabler/icons-react'

// utils - simple date formatting helper
const formatDistanceToNow = (date) => {
    const now = new Date()
    const diff = now - new Date(date)
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor(diff / (1000 * 60))
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    return 'Just now'
}

const FinetuningJobsTable = ({ data, isLoading }) => {
    const theme = useTheme()
    const [anchorEl, setAnchorEl] = useState(null)
    const [selectedJob, setSelectedJob] = useState(null)

    const handleMenuClick = (event, job) => {
        setAnchorEl(event.currentTarget)
        setSelectedJob(job)
    }

    const handleMenuClose = () => {
        setAnchorEl(null)
        setSelectedJob(null)
    }

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'completed':
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
        <TableContainer component={Paper}>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell><strong>Job Name</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                        <TableCell><strong>Model</strong></TableCell>
                        <TableCell><strong>Dataset</strong></TableCell>
                        <TableCell><strong>Progress</strong></TableCell>
                        <TableCell><strong>Created Date</strong></TableCell>
                        <TableCell><strong>Actions</strong></TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.map((job) => (
                        <TableRow key={job.id} hover>
                            <TableCell>
                                <Typography variant="subtitle2" fontWeight="600">
                                    {job.name}
                                </Typography>
                            </TableCell>
                            <TableCell>
                                <Chip
                                    label={job.status}
                                    color={getStatusColor(job.status)}
                                    size="small"
                                    variant="outlined"
                                />
                            </TableCell>
                            <TableCell>
                                <Typography variant="body2">
                                    {job.model || 'N/A'}
                                </Typography>
                            </TableCell>
                            <TableCell>
                                <Typography variant="body2">
                                    {job.dataset || 'N/A'}
                                </Typography>
                            </TableCell>
                            <TableCell>
                                <Stack spacing={1} sx={{ minWidth: 120 }}>
                                    <LinearProgress
                                        variant="determinate"
                                        value={getProgressValue(job.progress)}
                                        sx={{ height: 6, borderRadius: 3 }}
                                    />
                                    <Typography variant="caption" color="textSecondary">
                                        {job.progress || '0%'}
                                    </Typography>
                                </Stack>
                            </TableCell>
                            <TableCell>
                                <Typography variant="body2" color="textSecondary">
                                    {job.createdDate
                                        ? formatDistanceToNow(job.createdDate)
                                        : 'Unknown'
                                    }
                                </Typography>
                            </TableCell>
                            <TableCell>
                                <IconButton
                                    size="small"
                                    onClick={(e) => handleMenuClick(e, job)}
                                >
                                    <IconDots />
                                </IconButton>
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
                <MenuItem onClick={() => { /* TODO: View job details */ handleMenuClose() }}>
                    <IconEye style={{ marginRight: 8 }} size={16} />
                    View Details
                </MenuItem>
                <MenuItem 
                    onClick={() => { /* TODO: Download model */ handleMenuClose() }}
                    disabled={selectedJob?.status !== 'completed'}
                >
                    <IconDownload style={{ marginRight: 8 }} size={16} />
                    Download Model
                </MenuItem>
                <MenuItem 
                    onClick={() => { /* TODO: Delete job */ handleMenuClose() }}
                    sx={{ color: 'error.main' }}
                >
                    <IconTrash style={{ marginRight: 8 }} size={16} />
                    Delete Job
                </MenuItem>
            </Menu>
        </TableContainer>
    )
}

FinetuningJobsTable.propTypes = {
    data: PropTypes.array.isRequired,
    isLoading: PropTypes.bool
}

FinetuningJobsTable.defaultProps = {
    isLoading: false
}

export default FinetuningJobsTable