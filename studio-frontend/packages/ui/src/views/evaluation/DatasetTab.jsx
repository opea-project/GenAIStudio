import { useState, useEffect, useCallback, useRef } from 'react'
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
    FormControlLabel,
    FormControl,
    IconButton,
    LinearProgress,
    Menu,
    MenuItem,
    Paper,
    Stack,
    Switch,
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
import { styled } from '@mui/material/styles'
import { tableCellClasses } from '@mui/material/TableCell'

// icons
import { IconChevronDown, IconEye, IconPlus, IconRefresh, IconTrash, IconWand, IconX, IconPlayerStop } from '@tabler/icons-react'

// API
import evaluationApi from '@/api/evaluation'
import DatasetDetailDialog from './DatasetDetailDialog'
import FileUploadArea from '@/ui-component/file/FileUploadArea'
import ModelSelect from './ModelSelect'

import { StyledButton } from '@/ui-component/button/StyledButton'

const DATASET_UPLOAD_TYPES = ['.json', '.jsonl']
const SYNTHESIZE_UPLOAD_TYPES = ['.pdf', '.txt', '.docx']

const DEFAULT_SYNTHESIS_OPTIONS = {
    targetGoldens: 10,
    maxGoldensPerDocument: 5,
    maxContexts: 5,
    minContexts: 1,
    averageChunksPerContext: 3,
    chunkSize: 1024,
    chunkOverlap: 64,
    numEvolutions: 1,
    inputQuality: 0.4,
    llmTimeout: 0,
    asyncMode: false,
    maxConcurrent: 1
}

const getAcceptedFileLabel = (types) => types.join(', ')

const deriveNameFromFile = (filename) => {
    const lastDot = filename.lastIndexOf('.')
    return lastDot > 0 ? filename.slice(0, lastDot) : filename
}

const parseManualEntries = (entriesText) => {
    const trimmed = entriesText.trim()
    if (!trimmed) return []

    try {
        const parsed = JSON.parse(trimmed)
        return Array.isArray(parsed) ? parsed : [parsed]
    } catch {
        return trimmed
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => JSON.parse(line))
    }
}

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

const normalizeDatasetName = (value) => (value || '').trim().toLowerCase()

const statusColor = (status) => {
    switch (status) {
        case 'completed':
            return 'success'
        case 'failed':
            return 'error'
        case 'synthesizing':
            return 'primary'
        case 'pending':
        default:
            return 'default'
    }
}

const STATUS_CONFIG = {
    pending: { label: 'pending' },
    synthesizing: { label: 'synthesizing' },
    completed: { label: 'completed' },
    failed: { label: 'failed' },
    stopped: { label: 'stopped' },
}

const StatusChip = ({ status, error }) => {
    const cfg = STATUS_CONFIG[status] || { label: status }
    const isInProgress = status === 'synthesizing' || status === 'pending'
    const chip = (
        <Chip
            label={cfg.label}
            color={statusColor(status)}
            size='small'
            icon={isInProgress ? <CircularProgress size={12} color='inherit' /> : undefined}
        />
    )
    if (status === 'failed' && error) {
        return (
            <Tooltip title={error} placement='top'>
                {chip}
            </Tooltip>
        )
    }
    return chip
}

StatusChip.propTypes = {
    status: PropTypes.string,
    error: PropTypes.string
}

// ── New Dataset Modal ─────────────────────────────────────────────────────────

const NewDatasetModal = ({ open, onClose, onCreated, existingDatasetNames }) => {
    const missingUploadError = 'Upload a .json or .jsonl file, or paste dataset entries manually.'
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [entries, setEntries] = useState('')
    const [file, setFile] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleClose = () => {
        setName('')
        setDescription('')
        setEntries('')
        setFile(null)
        setError('')
        onClose()
    }

    const handleFileChange = (nextFile) => {
        setFile(nextFile)
        setError('')
        if (nextFile && !name.trim()) {
            setName(deriveNameFromFile(nextFile.name))
        }
    }

    const handleSubmit = async () => {
        if (!name.trim()) {
            setError('Dataset name is required.')
            return
        }

        const normalizedName = normalizeDatasetName(name)
        const hasDuplicateName = existingDatasetNames.some(
            (existingName) => normalizeDatasetName(existingName) === normalizedName
        )
        if (hasDuplicateName) {
            setError('A dataset with this name already exists. Please choose a different name.')
            return
        }

        if (!file && !entries.trim()) {
            setError(missingUploadError)
            return
        }

        setSubmitting(true)
        setError('')
        try {
            let res

            if (file) {
                const formData = new FormData()
                formData.append('file', file)
                formData.append('name', name.trim())
                if (description.trim()) formData.append('description', description.trim())
                res = await evaluationApi.createDataset(formData)
            } else {
                res = await evaluationApi.createDataset({
                    name: name.trim(),
                    description: description.trim(),
                    entries: parseManualEntries(entries)
                })
            }

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
                <Typography variant='h4'>Import Dataset</Typography>
                <IconButton size='small' onClick={handleClose}>
                    <IconX size={18} />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    <FileUploadArea
                        onFileUpload={handleFileChange}
                        acceptedTypes={DATASET_UPLOAD_TYPES}
                        maxSizeMB={25}
                        error={error === missingUploadError ? error : null}
                        title='Drop your dataset file here or click to browse'
                        subtitle={`Accepted types: ${getAcceptedFileLabel(DATASET_UPLOAD_TYPES)}. JSON can be an array of entries or an object with an entries array.`}
                        buttonLabel={file ? 'Replace File' : 'Choose File'}
                    />
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
    onCreated: PropTypes.func,
    existingDatasetNames: PropTypes.arrayOf(PropTypes.string)
}

// ── Synthesize Modal ──────────────────────────────────────────────────────────

const SynthesizeModal = ({ open, onClose, onCreated, existingDatasetNames }) => {
    const [models, setModels] = useState([])
    const [datasetName, setDatasetName] = useState('')
    const [description, setDescription] = useState('')
    const [modelName, setModelName] = useState('')
    const [sourceFile, setSourceFile] = useState(null)
    const [options, setOptions] = useState(DEFAULT_SYNTHESIS_OPTIONS)
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [loadingOptions, setLoadingOptions] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const fetchModels = () => {
        evaluationApi.getModels().then((res) => setModels(res.data || [])).catch(() => {})
    }

    useEffect(() => {
        if (!open) return
        setLoadingOptions(true)
        setError('')
        evaluationApi
            .getModels()
            .then((res) => setModels(res.data || []))
            .catch(() => setError('Failed to load judge models.'))
            .finally(() => setLoadingOptions(false))
    }, [open])

    const handleClose = () => {
        setDatasetName('')
        setDescription('')
        setModelName('')
        setSourceFile(null)
        setOptions(DEFAULT_SYNTHESIS_OPTIONS)
        setShowAdvanced(false)
        setError('')
        onClose()
    }

    const updateOption = (key, value) => {
        setOptions((previous) => ({
            ...previous,
            [key]: value
        }))
    }

    const missingSrcError = 'A source file is required to synthesize a dataset.'

    const handleFileChange = (nextFile) => {
        setSourceFile(nextFile)
        setError('')
        if (nextFile && !datasetName.trim()) {
            setDatasetName(deriveNameFromFile(nextFile.name))
        }
    }

    const handleSubmit = async () => {
        if (!sourceFile) {
            setError(missingSrcError)
            return
        }
        if (!datasetName.trim() || !modelName) {
            setError('Dataset name and judge model are required.')
            return
        }

        const normalizedName = normalizeDatasetName(datasetName)
        const hasDuplicateName = existingDatasetNames.some(
            (existingName) => normalizeDatasetName(existingName) === normalizedName
        )
        if (hasDuplicateName) {
            setError('A dataset with this name already exists. Please choose a different name.')
            return
        }

        setSubmitting(true)
        setError('')
        try {
            const formData = new FormData()
            formData.append('file', sourceFile)
            formData.append('name', datasetName.trim())
            formData.append('model_name', modelName)
            formData.append('embed_model_name', 'nomic-embed-text')
            formData.append('num_goldens', String(options.targetGoldens))
            formData.append('max_goldens_per_document', String(options.maxGoldensPerDocument))
            formData.append('max_contexts', String(options.maxContexts))
            formData.append('min_contexts', String(options.minContexts))
            formData.append('average_chunks_per_context', String(options.averageChunksPerContext))
            formData.append('chunk_size', String(options.chunkSize))
            formData.append('chunk_overlap', String(options.chunkOverlap))
            formData.append('num_evolutions', String(options.numEvolutions))
            formData.append('input_quality', String(options.inputQuality))
            formData.append('llm_timeout', String(options.llmTimeout))
            formData.append('async_mode', String(options.asyncMode))
            formData.append('max_concurrent', String(options.maxConcurrent))
            if (description.trim()) formData.append('description', description.trim())

            const res = await evaluationApi.synthesizeDataset(formData)
            // Server returns 202 immediately — close the modal and let polling update status
            onCreated && onCreated(res.data)
            handleClose()
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to start synthesis.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth='md' fullWidth>
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
                        <FileUploadArea
                            onFileUpload={handleFileChange}
                            acceptedTypes={SYNTHESIZE_UPLOAD_TYPES}
                            maxSizeMB={50}
                            error={error === missingSrcError ? error : null}
                            title='Drop your source document here or click to browse'
                            subtitle={`Accepted types: ${getAcceptedFileLabel(SYNTHESIZE_UPLOAD_TYPES)}. Word uploads require .docx format.`}
                            buttonLabel={sourceFile ? 'Replace File' : 'Choose File'}
                        />
                        <TextField
                            label='Dataset Name'
                            size='small'
                            fullWidth
                            value={datasetName}
                            onChange={(e) => setDatasetName(e.target.value)}
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
                        <ModelSelect
                            models={models}
                            value={modelName}
                            onChange={setModelName}
                            onModelsRefresh={fetchModels}
                            disabled={submitting}
                            label='Generator Model'
                        />
                        <TextField
                            label='Total Goldens'
                            size='small'
                            fullWidth
                            type='number'
                            inputProps={{ min: 1, max: 200 }}
                            value={options.targetGoldens}
                            onChange={(e) => updateOption('targetGoldens', Number(e.target.value))}
                            helperText='The synthesized dataset will contain exactly this many goldens.'
                        />
                        <Stack spacing={1} sx={{ pt: 1 }}>
                            <Button variant='text' onClick={() => setShowAdvanced((open) => !open)} sx={{ alignSelf: 'flex-start', px: 0 }}>
                                {showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
                            </Button>
                            {showAdvanced && (
                                <Stack spacing={2}>
                                    <TextField
                                        label='Max Goldens Per Document'
                                        size='small'
                                        fullWidth
                                        type='number'
                                        inputProps={{ min: 1, max: 20 }}
                                        value={options.maxGoldensPerDocument}
                                        onChange={(e) => updateOption('maxGoldensPerDocument', Number(e.target.value))}
                                    />
                                    <TextField
                                        label='Max Contexts'
                                        size='small'
                                        fullWidth
                                        type='number'
                                        inputProps={{ min: 1, max: 50 }}
                                        value={options.maxContexts}
                                        onChange={(e) => updateOption('maxContexts', Number(e.target.value))}
                                    />
                                    <TextField
                                        label='Min Contexts'
                                        size='small'
                                        fullWidth
                                        type='number'
                                        inputProps={{ min: 1, max: 50 }}
                                        value={options.minContexts}
                                        onChange={(e) => updateOption('minContexts', Number(e.target.value))}
                                    />
                                    <TextField
                                        label='Avg. Chunks Per Context'
                                        size='small'
                                        fullWidth
                                        type='number'
                                        inputProps={{ min: 1, max: 20 }}
                                        value={options.averageChunksPerContext}
                                        onChange={(e) => updateOption('averageChunksPerContext', Number(e.target.value))}
                                    />
                                    <TextField
                                        label='Chunk Size'
                                        size='small'
                                        fullWidth
                                        type='number'
                                        inputProps={{ min: 64, max: 4096 }}
                                        value={options.chunkSize}
                                        onChange={(e) => updateOption('chunkSize', Number(e.target.value))}
                                        helperText='Applied during uploaded document splitting before contexts are sent to studio-eval.'
                                    />
                                    <TextField
                                        label='Chunk Overlap'
                                        size='small'
                                        fullWidth
                                        type='number'
                                        inputProps={{ min: 0, max: 1024 }}
                                        value={options.chunkOverlap}
                                        onChange={(e) => updateOption('chunkOverlap', Number(e.target.value))}
                                    />
                                    <TextField
                                        label='Number of Evolutions'
                                        size='small'
                                        fullWidth
                                        type='number'
                                        inputProps={{ min: 1, max: 10 }}
                                        value={options.numEvolutions}
                                        onChange={(e) => updateOption('numEvolutions', Number(e.target.value))}
                                    />
                                    <TextField
                                        label='Input Quality Threshold'
                                        size='small'
                                        fullWidth
                                        type='number'
                                        inputProps={{ min: 0, max: 1, step: 0.05 }}
                                        value={options.inputQuality}
                                        onChange={(e) => updateOption('inputQuality', Number(e.target.value))}
                                    />
                                    <TextField
                                        label='LLM Timeout (seconds)'
                                        size='small'
                                        fullWidth
                                        type='number'
                                        inputProps={{ min: 0, max: 3600 }}
                                        value={options.llmTimeout}
                                        onChange={(e) => updateOption('llmTimeout', Number(e.target.value))}
                                        helperText='0 disables the Ollama request timeout for this synthesis request.'
                                    />
                                    <FormControlLabel
                                        control={<Switch checked={options.asyncMode} onChange={(e) => updateOption('asyncMode', e.target.checked)} />}
                                        label='Enable Async Generation'
                                    />
                                    <TextField
                                        label='Max Concurrent Async Calls'
                                        size='small'
                                        fullWidth
                                        type='number'
                                        inputProps={{ min: 1, max: 50 }}
                                        value={options.maxConcurrent}
                                        onChange={(e) => updateOption('maxConcurrent', Number(e.target.value))}
                                        disabled={!options.asyncMode}
                                    />
                                    <Typography variant='caption' color='text.secondary'>
                                        Omitted from the UI: output path and Ollama base URL are deployment-managed; context quality scoring is not available in this flow.
                                    </Typography>
                                </Stack>
                            )}
                        </Stack>
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
                    {submitting ? 'Starting…' : 'Synthesize'}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

SynthesizeModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onCreated: PropTypes.func,
    existingDatasetNames: PropTypes.arrayOf(PropTypes.string)
}

// ── DatasetTab ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5000
const IN_PROGRESS_STATUSES = new Set(['pending', 'synthesizing'])

const DatasetTab = ({ isVisible }) => {
    const [datasets, setDatasets] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const [order, setOrder] = useState('desc')
    const [orderBy, setOrderBy] = useState('created_at')
    const [newDatasetOpen, setNewDatasetOpen] = useState(false)
    const [synthesizeOpen, setSynthesizeOpen] = useState(false)
    const [createMenuAnchor, setCreateMenuAnchor] = useState(null)
    const [detailDatasetId, setDetailDatasetId] = useState(null)
    const [detailOpen, setDetailOpen] = useState(false)
    const [deleteConfirmId, setDeleteConfirmId] = useState(null)
    const [deletingDataset, setDeletingDataset] = useState(false)
    const [stoppingDataset, setStoppingDataset] = useState(null)
    const pollTimerRef = useRef(null)

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

    // Poll individual in-progress datasets without a full list reload
    const pollInProgress = useCallback(async (currentDatasets) => {
        const inProgress = currentDatasets.filter((ds) => IN_PROGRESS_STATUSES.has(ds.status))
        if (inProgress.length === 0) return

        const updates = await Promise.allSettled(
            inProgress.map((ds) => evaluationApi.getDataset(ds.id))
        )

        setDatasets((prev) => {
            const updated = [...prev]
            updates.forEach((result, idx) => {
                if (result.status === 'fulfilled') {
                    const fresh = result.value.data
                    const i = updated.findIndex((d) => d.id === fresh.id)
                    if (i !== -1) {
                        updated[i] = {
                            ...updated[i],
                            status: fresh.status,
                            error: fresh.error,
                            entry_count: fresh.entries ? fresh.entries.length : (updated[i].entry_count || 0),
                            completed_contexts: fresh.completed_contexts,
                            total_contexts: fresh.total_contexts,
                            completed_goldens: fresh.completed_goldens,
                            target_goldens: fresh.target_goldens,
                            updated_at: fresh.updated_at,
                        }
                    }
                }
            })
            return updated
        })
    }, [])

    // Manage polling lifecycle
    useEffect(() => {
        const hasInProgress = datasets.some((ds) => IN_PROGRESS_STATUSES.has(ds.status))

        if (hasInProgress && isVisible) {
            if (!pollTimerRef.current) {
                pollTimerRef.current = setInterval(() => {
                    setDatasets((current) => {
                        pollInProgress(current)
                        return current
                    })
                }, POLL_INTERVAL_MS)
            }
        } else {
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current)
                pollTimerRef.current = null
            }
        }

        return () => {
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current)
                pollTimerRef.current = null
            }
        }
    }, [datasets, isVisible, pollInProgress])

    useEffect(() => {
        if (isVisible) loadDatasets()
    }, [isVisible, loadDatasets])

    const handleDatasetCreated = (ds) => {
        setDatasets((prev) => [ds, ...prev])
    }

    const handleCreateMenuOpen = (event) => {
        setCreateMenuAnchor(event.currentTarget)
    }

    const handleCreateMenuClose = () => {
        setCreateMenuAnchor(null)
    }

    const handleOpenNewDataset = () => {
        handleCreateMenuClose()
        setNewDatasetOpen(true)
    }

    const handleOpenSynthesize = () => {
        handleCreateMenuClose()
        setSynthesizeOpen(true)
    }

    const handleOpenDataset = (id) => {
        setDetailDatasetId(id)
        setDetailOpen(true)
    }

    const handleDatasetChanged = (patch) => {
        setDatasets((prev) => prev.map((ds) => (ds.id === patch.id ? { ...ds, ...patch } : ds)))
    }

    const handleDeleteDataset = async () => {
        if (!deleteConfirmId) return
        setDeletingDataset(true)
        try {
            const dsToDelete = datasets.find((ds) => ds.id === deleteConfirmId)
            if (dsToDelete && IN_PROGRESS_STATUSES.has(dsToDelete.status)) {
                await evaluationApi.stopDataset(deleteConfirmId).catch(() => {})
            }
            await evaluationApi.deleteDataset(deleteConfirmId)
            setDatasets((prev) => prev.filter((ds) => ds.id !== deleteConfirmId))
            setDeleteConfirmId(null)
        } catch {
            // ignore — user can retry
        } finally {
            setDeletingDataset(false)
        }
    }

    const handleStopDataset = async (e, id) => {
        e.stopPropagation()
        setStoppingDataset(id)
        try {
            await evaluationApi.stopDataset(id)
            setDatasets((prev) => prev.map((ds) => (ds.id === id ? { ...ds, status: 'stopped' } : ds)))
        } catch {
            // ignore
        } finally {
            setStoppingDataset(null)
        }
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
        { id: 'status', label: 'Status', sortable: false },
        { id: 'entry_count', label: 'Entries' },
        { id: 'created_at', label: 'Created At' },
        { id: 'actions', label: 'Actions', sortable: false }
    ]

    const existingDatasetNames = datasets.map((ds) => ds.name).filter(Boolean)

    const isCreateMenuOpen = Boolean(createMenuAnchor)

    return (
        <Box>
            <Stack direction='row' justifyContent='flex-start' alignItems='center' sx={{ mb: 2 }} spacing={1}>
                <StyledButton
                    variant='contained'
                    startIcon={<IconPlus size={16} />}
                    endIcon={<IconChevronDown size={16} />}
                    onClick={handleCreateMenuOpen}
                    sx={{ borderRadius: 2, height: 40 }}
                    aria-controls={isCreateMenuOpen ? 'dataset-create-menu' : undefined}
                    aria-haspopup='menu'
                    aria-expanded={isCreateMenuOpen ? 'true' : undefined}
                >
                    Add Dataset
                </StyledButton>
                <Menu
                    id='dataset-create-menu'
                    anchorEl={createMenuAnchor}
                    open={isCreateMenuOpen}
                    onClose={handleCreateMenuClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                >
                    <MenuItem onClick={handleOpenNewDataset}>
                        <Stack direction='row' alignItems='center' spacing={1}>
                            <IconPlus size={16} />
                            <Typography variant='body2'>Import Dataset</Typography>
                        </Stack>
                    </MenuItem>
                    <MenuItem onClick={handleOpenSynthesize}>
                        <Stack direction='row' alignItems='center' spacing={1}>
                            <IconWand size={16} />
                            <Typography variant='body2'>Synthesize Dataset</Typography>
                        </Stack>
                    </MenuItem>
                </Menu>
                <Tooltip title='Refresh'>
                    <StyledButton
                        size='small'
                        variant='outlined'
                        onClick={loadDatasets}
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
                                <StyledTableCell colSpan={6} align='center' sx={{ py: 4 }}>
                                    <CircularProgress size={24} />
                                </StyledTableCell>
                            </StyledTableRow>
                        ) : sortedDatasets.length === 0 ? (
                            <StyledTableRow>
                                <StyledTableCell colSpan={6} align='center' sx={{ py: 4 }}>
                                    <Typography variant='body2' color='text.secondary'>
                                        No datasets yet. Create one manually or synthesize from an uploaded source file.
                                    </Typography>
                                </StyledTableCell>
                            </StyledTableRow>
                        ) : (
                            sortedDatasets.map((ds) => (
                                <StyledTableRow
                                    key={ds.id}
                                    hover
                                    onClick={() => ds.status === 'completed' && handleOpenDataset(ds.id)}
                                    sx={{ cursor: ds.status === 'completed' ? 'pointer' : 'default' }}
                                >
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
                                    <StyledTableCell>
                                        <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5, width: '100%' }}>
                                            <StatusChip status={ds.status || 'completed'} error={ds.error} />
                                            {IN_PROGRESS_STATUSES.has(ds.status) && (() => {
                                                const total = ds.target_goldens ?? 0
                                                const completed = ds.completed_goldens ?? 0
                                                const pct = total > 0 ? Math.round((completed / total) * 100) : null
                                                return (
                                                    <Box sx={{ width: '100%', minWidth: 80 }}>
                                                        <LinearProgress
                                                            color='primary'
                                                            variant={pct !== null ? 'determinate' : 'indeterminate'}
                                                            value={pct ?? undefined}
                                                            sx={{ borderRadius: 1 }}
                                                        />
                                                        {pct !== null && (
                                                            <Typography variant='caption' color='text.secondary'>
                                                                {completed}/{total} goldens ({pct}%)
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                )
                                            })()}
                                        </Box>
                                    </StyledTableCell>
                                    <StyledTableCell>{ds.entry_count ?? '—'}</StyledTableCell>
                                    <StyledTableCell>{formatDate(ds.created_at)}</StyledTableCell>
                                    <StyledTableCell align='right'>
                                        <Stack direction='row' spacing={0.5} justifyContent='flex-end'>
                                            <Tooltip
                                                title={
                                                    ds.status !== 'completed'
                                                        ? 'Available when completed'
                                                        : 'Open dataset'
                                                }
                                            >
                                                <span>
                                                    <IconButton
                                                        size='small'
                                                        onClick={(e) => { e.stopPropagation(); handleOpenDataset(ds.id) }}
                                                        disabled={ds.status !== 'completed'}
                                                    >
                                                        <IconEye size={16} />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                            {IN_PROGRESS_STATUSES.has(ds.status) && (
                                                <Tooltip title='Stop Synthesis'>
                                                    <IconButton
                                                        size='small'
                                                        color='error'
                                                        onClick={(e) => handleStopDataset(e, ds.id)}
                                                        disabled={stoppingDataset === ds.id}
                                                    >
                                                        {stoppingDataset === ds.id ? (
                                                            <CircularProgress size={14} color='inherit' />
                                                        ) : (
                                                            <IconPlayerStop size={16} />
                                                        )}
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            <Tooltip title='Delete dataset'>
                                                <IconButton
                                                    size='small'
                                                    color='error'
                                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(ds.id) }}
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

            <NewDatasetModal
                open={newDatasetOpen}
                onClose={() => setNewDatasetOpen(false)}
                onCreated={handleDatasetCreated}
                existingDatasetNames={existingDatasetNames}
            />
            <SynthesizeModal
                open={synthesizeOpen}
                onClose={() => setSynthesizeOpen(false)}
                onCreated={handleDatasetCreated}
                existingDatasetNames={existingDatasetNames}
            />
            <DatasetDetailDialog
                open={detailOpen}
                datasetId={detailDatasetId}
                onClose={() => setDetailOpen(false)}
                onDatasetChanged={handleDatasetChanged}
            />

            {/* Delete dataset confirmation */}
            <Dialog open={Boolean(deleteConfirmId)} onClose={() => setDeleteConfirmId(null)} maxWidth='xs' fullWidth>
                <DialogTitle>
                    <Typography variant='h4'>Delete Dataset</Typography>
                </DialogTitle>
                <DialogContent>
                    <Typography variant='body1'>
                        Are you sure you want to delete this dataset? This cannot be undone.
                    </Typography>
                    {deleteConfirmId && IN_PROGRESS_STATUSES.has(datasets.find((ds) => ds.id === deleteConfirmId)?.status) && (
                        <Typography variant='body2' color='error.main' sx={{ mt: 1 }}>
                            Synthesis is currently in progress and will be stopped before being deleted.
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDeleteConfirmId(null)} disabled={deletingDataset}>
                        Cancel
                    </Button>
                    <Button
                        variant='contained'
                        color='error'
                        onClick={handleDeleteDataset}
                        disabled={deletingDataset}
                        startIcon={deletingDataset ? <CircularProgress size={14} color='inherit' /> : null}
                    >
                        {deletingDataset ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

DatasetTab.propTypes = {
    isVisible: PropTypes.bool
}

export default DatasetTab
