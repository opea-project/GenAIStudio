import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'

// material-ui
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    TextField,
    Tooltip,
    Typography
} from '@mui/material'
import { useTheme, styled } from '@mui/material/styles'
import { tableCellClasses } from '@mui/material/TableCell'

// icons
import { IconPlus, IconRefresh, IconWand, IconX } from '@tabler/icons-react'

// API
import evaluationApi from '@/api/evaluation'

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

// ── New Dataset Modal ─────────────────────────────────────────────────────────

const NewDatasetModal = ({ open, onClose, onCreated }) => {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [entries, setEntries] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleClose = () => {
        setName('')
        setDescription('')
        setEntries('')
        setError('')
        onClose()
    }

    const handleSubmit = async () => {
        if (!name.trim()) {
            setError('Dataset name is required.')
            return
        }
        setSubmitting(true)
        setError('')
        try {
            // Parse entries: newline-separated JSON objects or a JSON array
            let parsedEntries = []
            const trimmed = entries.trim()
            if (trimmed) {
                try {
                    parsedEntries = JSON.parse(trimmed)
                    if (!Array.isArray(parsedEntries)) parsedEntries = [parsedEntries]
                } catch {
                    // Try newline-separated JSON objects
                    parsedEntries = trimmed
                        .split('\n')
                        .map((l) => l.trim())
                        .filter(Boolean)
                        .map((l) => JSON.parse(l))
                }
            }
            const res = await evaluationApi.createDataset({
                name: name.trim(),
                description: description.trim(),
                entries: parsedEntries
            })
            onCreated && onCreated(res.data)
            handleClose()
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to create dataset.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant='h4'>New Dataset</Typography>
                <IconButton size='small' onClick={handleClose}>
                    <IconX size={18} />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    <TextField
                        label='Name'
                        size='small'
                        fullWidth
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    <TextField
                        label='Description'
                        size='small'
                        fullWidth
                        multiline
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                    <TextField
                        label='Entries (JSON array or newline-separated JSON objects)'
                        size='small'
                        fullWidth
                        multiline
                        rows={6}
                        value={entries}
                        onChange={(e) => setEntries(e.target.value)}
                        placeholder={'[{"question": "...", "expected": "..."}]'}
                        inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
                    />
                    {error && (
                        <Typography variant='body2' color='error'>
                            {error}
                        </Typography>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={handleClose} disabled={submitting}>
                    Cancel
                </Button>
                <Button
                    variant='contained'
                    onClick={handleSubmit}
                    disabled={submitting}
                    startIcon={submitting ? <CircularProgress size={16} color='inherit' /> : null}
                >
                    {submitting ? 'Creating…' : 'Create'}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

NewDatasetModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onCreated: PropTypes.func
}

// ── Synthesize Modal ──────────────────────────────────────────────────────────

const SynthesizeModal = ({ open, onClose, onCreated }) => {
    const [sandboxes, setSandboxes] = useState([])
    const [sandboxId, setSandboxId] = useState('')
    const [datasetName, setDatasetName] = useState('')
    const [numSamples, setNumSamples] = useState(20)
    const [loadingOptions, setLoadingOptions] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!open) return
        setLoadingOptions(true)
        evaluationApi
            .getSandboxes()
            .then((res) => setSandboxes(res.data || []))
            .catch(() => setError('Failed to load sandboxes.'))
            .finally(() => setLoadingOptions(false))
    }, [open])

    const handleClose = () => {
        setSandboxId('')
        setDatasetName('')
        setNumSamples(20)
        setError('')
        onClose()
    }

    const handleSubmit = async () => {
        if (!sandboxId || !datasetName.trim()) {
            setError('Sandbox and dataset name are required.')
            return
        }
        setSubmitting(true)
        setError('')
        try {
            const res = await evaluationApi.synthesizeDataset({
                sandbox_id: sandboxId,
                name: datasetName.trim(),
                num_samples: numSamples
            })
            onCreated && onCreated(res.data)
            handleClose()
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to synthesize dataset.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant='h4'>Synthesize Dataset</Typography>
                <IconButton size='small' onClick={handleClose}>
                    <IconX size={18} />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                {loadingOptions ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        <FormControl fullWidth size='small'>
                            <InputLabel>Sandbox</InputLabel>
                            <Select
                                label='Sandbox'
                                value={sandboxId}
                                onChange={(e) => setSandboxId(e.target.value)}
                            >
                                {sandboxes.map((sb) => (
                                    <MenuItem key={sb.id} value={sb.id}>
                                        {sb.name || sb.id}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            label='Dataset Name'
                            size='small'
                            fullWidth
                            value={datasetName}
                            onChange={(e) => setDatasetName(e.target.value)}
                            required
                        />
                        <TextField
                            label='Number of Samples'
                            size='small'
                            fullWidth
                            type='number'
                            inputProps={{ min: 1, max: 500 }}
                            value={numSamples}
                            onChange={(e) => setNumSamples(Number(e.target.value))}
                        />
                        {error && (
                            <Typography variant='body2' color='error'>
                                {error}
                            </Typography>
                        )}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={handleClose} disabled={submitting}>
                    Cancel
                </Button>
                <Button
                    variant='contained'
                    onClick={handleSubmit}
                    disabled={submitting || loadingOptions}
                    startIcon={submitting ? <CircularProgress size={16} color='inherit' /> : null}
                >
                    {submitting ? 'Synthesizing…' : 'Synthesize'}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

SynthesizeModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onCreated: PropTypes.func
}

// ── DatasetTab ────────────────────────────────────────────────────────────────

const DatasetTab = ({ isVisible }) => {
    const theme = useTheme()

    const [datasets, setDatasets] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const [order, setOrder] = useState('desc')
    const [orderBy, setOrderBy] = useState('created_at')
    const [newDatasetOpen, setNewDatasetOpen] = useState(false)
    const [synthesizeOpen, setSynthesizeOpen] = useState(false)

    const loadDatasets = useCallback(async () => {
        try {
            setIsLoading(true)
            setError(null)
            const res = await evaluationApi.getDatasets()
            setDatasets(res.data || [])
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to load datasets.')
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        if (isVisible) loadDatasets()
    }, [isVisible, loadDatasets])

    const handleDatasetCreated = (ds) => {
        setDatasets((prev) => [ds, ...prev])
    }

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc'
        setOrder(isAsc ? 'desc' : 'asc')
        setOrderBy(property)
    }

    const sortedDatasets = [...datasets].sort((a, b) => {
        let cmp = 0
        if (orderBy === 'created_at') {
            cmp = new Date(a.created_at) - new Date(b.created_at)
        } else if (orderBy === 'name') {
            cmp = String(a.name).localeCompare(String(b.name))
        } else if (orderBy === 'entry_count') {
            cmp = (a.entry_count || 0) - (b.entry_count || 0)
        }
        return order === 'asc' ? cmp : -cmp
    })

    const columns = [
        { id: 'name', label: 'Name' },
        { id: 'description', label: 'Description', sortable: false },
        { id: 'entry_count', label: 'Entries' },
        { id: 'created_at', label: 'Created At' }
    ]

    return (
        <Box>
            <Stack direction='row' justifyContent='flex-end' alignItems='center' sx={{ mb: 2 }} spacing={1}>
                <Tooltip title='Refresh'>
                    <Button
                        size='small'
                        variant='outlined'
                        onClick={loadDatasets}
                        disabled={isLoading}
                        startIcon={isLoading ? <CircularProgress size={14} /> : <IconRefresh size={16} />}
                    >
                        Refresh
                    </Button>
                </Tooltip>
                <Button
                    variant='outlined'
                    startIcon={<IconWand size={16} />}
                    onClick={() => setSynthesizeOpen(true)}
                >
                    Synthesize
                </Button>
                <Button
                    variant='contained'
                    startIcon={<IconPlus size={16} />}
                    onClick={() => setNewDatasetOpen(true)}
                >
                    New Dataset
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
                                <StyledTableCell colSpan={4} align='center' sx={{ py: 4 }}>
                                    <CircularProgress size={24} />
                                </StyledTableCell>
                            </StyledTableRow>
                        ) : sortedDatasets.length === 0 ? (
                            <StyledTableRow>
                                <StyledTableCell colSpan={4} align='center' sx={{ py: 4 }}>
                                    <Typography variant='body2' color='text.secondary'>
                                        No datasets yet. Create one manually or synthesize from a sandbox.
                                    </Typography>
                                </StyledTableCell>
                            </StyledTableRow>
                        ) : (
                            sortedDatasets.map((ds) => (
                                <StyledTableRow key={ds.id} hover>
                                    <StyledTableCell>
                                        <Typography variant='body2' fontWeight={500}>
                                            {ds.name}
                                        </Typography>
                                    </StyledTableCell>
                                    <StyledTableCell>
                                        <Typography variant='body2' color='text.secondary'>
                                            {ds.description || '—'}
                                        </Typography>
                                    </StyledTableCell>
                                    <StyledTableCell>{ds.entry_count ?? '—'}</StyledTableCell>
                                    <StyledTableCell>{formatDate(ds.created_at)}</StyledTableCell>
                                </StyledTableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <NewDatasetModal
                open={newDatasetOpen}
                onClose={() => setNewDatasetOpen(false)}
                onCreated={handleDatasetCreated}
            />
            <SynthesizeModal
                open={synthesizeOpen}
                onClose={() => setSynthesizeOpen(false)}
                onCreated={handleDatasetCreated}
            />
        </Box>
    )
}

DatasetTab.propTypes = {
    isVisible: PropTypes.bool
}

export default DatasetTab
