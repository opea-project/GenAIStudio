import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'

// material-ui
import {
    Alert,
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
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Tabs,
    TextField,
    Tooltip,
    Typography
} from '@mui/material'
import { styled } from '@mui/material/styles'
import { tableCellClasses } from '@mui/material/TableCell'

// icons
import { IconCheck, IconPencil, IconPlus, IconTrash, IconX } from '@tabler/icons-react'

// API
import evaluationApi from '@/api/evaluation'

// ── Constants ─────────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 10

const STATUS_COLOR = {
    pending:      'default',
    synthesizing: 'warning',
    completed:    'success',
    failed:       'error'
}

// ── Styled components (same pattern as DatasetTab) ────────────────────────────

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: theme.palette.grey[900] + 25,
    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.grey[900]
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14
    }
}))

const StyledTableRow = styled(TableRow)(() => ({
    '&:last-child td, &:last-child th': {
        border: 0
    }
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const contextToText = (context) => {
    if (!context || context.length === 0) return ''
    return context.join('\n')
}

const textToContext = (text) => {
    if (!text.trim()) return []
    return text
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
}

function TabPanel(props) {
    const { children, value, index, ...other } = props

    return (
        <div
            role='tabpanel'
            hidden={value !== index}
            id={`dataset-detail-tabpanel-${index}`}
            aria-labelledby={`dataset-detail-tab-${index}`}
            {...other}
        >
            {value === index && children}
        </div>
    )
}

TabPanel.propTypes = {
    children: PropTypes.node,
    index: PropTypes.number.isRequired,
    value: PropTypes.number.isRequired
}

// ── DatasetDetailDialog ───────────────────────────────────────────────────────

const DatasetDetailDialog = ({ open, datasetId, onClose, onDatasetChanged }) => {
    const [loading, setLoading] = useState(false)
    const [dataset, setDataset] = useState(null)

    // Editable metadata
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [savingMeta, setSavingMeta] = useState(false)
    const [metaError, setMetaError] = useState('')

    // Per-row edit state
    // editingRow: null | { id: number|null, input, expected_output, contextText }
    // id === null means new entry
    const [editingRow, setEditingRow] = useState(null)
    const [savingRow, setSavingRow] = useState(false)
    const [rowError, setRowError] = useState('')

    // Entry deletion
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)
    const [deletingEntry, setDeletingEntry] = useState(false)

    // Pagination
    const [page, setPage] = useState(0)

    // Focused row detail drawer
    const [selectedEntry, setSelectedEntry] = useState(null)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [detailTabValue, setDetailTabValue] = useState(0)

    // ── Data loading ──────────────────────────────────────────────────────────

    const loadDataset = useCallback(async (id) => {
        setLoading(true)
        try {
            const res = await evaluationApi.getDataset(id)
            const ds = res.data
            setDataset(ds)
            setName(ds.name || '')
            setDescription(ds.description || '')
        } catch {
            setDataset(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (open && datasetId) {
            setPage(0)
            setEditingRow(null)
            setConfirmDeleteId(null)
            setSelectedEntry(null)
            setDrawerOpen(false)
            setDetailTabValue(0)
            setMetaError('')
            setRowError('')
            setDataset(null)
            loadDataset(datasetId)
        }
    }, [open, datasetId, loadDataset])

    // ── Metadata ──────────────────────────────────────────────────────────────

    const metaDirty =
        dataset !== null &&
        (name !== (dataset.name || '') || description !== (dataset.description || ''))

    const handleSaveMeta = async () => {
        if (!name.trim()) {
            setMetaError('Name is required.')
            return
        }
        setSavingMeta(true)
        setMetaError('')
        try {
            const res = await evaluationApi.updateDataset(datasetId, {
                name: name.trim(),
                description: description.trim()
            })
            const updated = res.data
            setDataset((prev) => ({ ...prev, name: updated.name, description: updated.description }))
            onDatasetChanged && onDatasetChanged({ id: datasetId, name: updated.name, description: updated.description })
        } catch (err) {
            setMetaError(err?.response?.data?.message || 'Failed to save metadata.')
        } finally {
            setSavingMeta(false)
        }
    }

    // ── Entry editing ─────────────────────────────────────────────────────────

    const handleEditRow = (entry) => {
        setDrawerOpen(false)
        setSelectedEntry(null)
        setRowError('')
        setEditingRow({
            id: entry.id,
            input: entry.input || '',
            expected_output: entry.expected_output || '',
            contextText: contextToText(entry.context)
        })
    }

    const handleAddRow = () => {
        setDrawerOpen(false)
        setSelectedEntry(null)
        setRowError('')
        setEditingRow({ id: null, input: '', expected_output: '', contextText: '' })
        // Navigate to the page where the new row will appear
        if (dataset?.entries) {
            const newPage = Math.max(0, Math.ceil((dataset.entries.length + 1) / ROWS_PER_PAGE) - 1)
            setPage(newPage)
        }
    }

    const handleCancelEdit = () => {
        setEditingRow(null)
        setRowError('')
    }

    const handleOpenDrawer = (entry, entryNumber) => {
        setDetailTabValue(0)
        setSelectedEntry({ ...entry, _entryNumber: entryNumber })
        setDrawerOpen(true)
    }

    const handleCloseDrawer = () => {
        setDrawerOpen(false)
        setSelectedEntry(null)
    }

    const handleDetailTabChange = (event, newValue) => {
        setDetailTabValue(newValue)
    }

    const handleSaveRow = async () => {
        if (!editingRow.input.trim()) {
            setRowError('Input is required.')
            return
        }
        setSavingRow(true)
        setRowError('')
        try {
            const payload = {
                input: editingRow.input.trim(),
                expected_output: editingRow.expected_output.trim() || null,
                context: textToContext(editingRow.contextText)
            }

            if (editingRow.id !== null) {
                // Update existing entry
                const res = await evaluationApi.updateEntry(datasetId, editingRow.id, payload)
                const updated = res.data
                setDataset((prev) => ({
                    ...prev,
                    entries: prev.entries.map((e) => (e.id === updated.id ? updated : e))
                }))
            } else {
                // Add new entry
                const res = await evaluationApi.addEntries(datasetId, { entries: [payload] })
                const newEntries = res.data.entries || []
                const updatedEntries = [...(dataset?.entries || []), ...newEntries]
                setDataset((prev) => ({ ...prev, entries: updatedEntries }))
                onDatasetChanged && onDatasetChanged({ id: datasetId, entry_count: updatedEntries.length })
            }
            setEditingRow(null)
        } catch (err) {
            setRowError(err?.response?.data?.message || 'Failed to save entry.')
        } finally {
            setSavingRow(false)
        }
    }

    // ── Entry deletion ────────────────────────────────────────────────────────

    const handleDeleteEntry = async (entryId) => {
        setDeletingEntry(true)
        try {
            await evaluationApi.deleteEntry(datasetId, entryId)
            const updatedEntries = (dataset?.entries || []).filter((e) => e.id !== entryId)
            setDataset((prev) => ({ ...prev, entries: updatedEntries }))
            if (selectedEntry?.id === entryId) {
                handleCloseDrawer()
            }
            onDatasetChanged && onDatasetChanged({ id: datasetId, entry_count: updatedEntries.length })
            setConfirmDeleteId(null)
            // Adjust page down if we removed the last entry on the current page
            const maxPage = Math.max(0, Math.ceil(updatedEntries.length / ROWS_PER_PAGE) - 1)
            setPage((prev) => Math.min(prev, maxPage))
        } catch {
            // silently fail — user can retry
        } finally {
            setDeletingEntry(false)
        }
    }

    // ── Derived values ────────────────────────────────────────────────────────

    const entries = dataset?.entries || []
    const pageEntries = entries.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE)
    const showNewRow = editingRow !== null && editingRow.id === null
    const isSynthesizing = dataset?.status === 'synthesizing'

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <Dialog open={open} onClose={onClose} maxWidth='lg' fullWidth>
            <DialogTitle
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}
            >
                <Typography variant='h4'>Dataset Detail</Typography>
                <IconButton size='small' onClick={onClose}>
                    <IconX size={18} />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress />
                    </Box>
                ) : !dataset ? (
                    <Alert severity='error'>Failed to load dataset.</Alert>
                ) : (
                    <Stack spacing={3}>
                        {/* ── Metadata section ── */}
                        <Paper variant='outlined' sx={{ p: 2 }}>
                            <Stack spacing={2}>
                                <Stack direction='row' alignItems='center' spacing={1.5}>
                                    <Typography variant='subtitle1' fontWeight={600}>
                                        Metadata
                                    </Typography>
                                    <Chip
                                        label={dataset.status || 'completed'}
                                        color={STATUS_COLOR[dataset.status] || 'default'}
                                        size='small'
                                        sx={{ fontWeight: 500 }}
                                    />
                                    <Typography variant='body2' color='text.secondary'>
                                        {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                                    </Typography>
                                </Stack>

                                <Stack direction='row' spacing={2} alignItems='flex-start'>
                                    <TextField
                                        label='Name'
                                        size='small'
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        sx={{ flex: 1 }}
                                        required
                                    />
                                    <TextField
                                        label='Description'
                                        size='small'
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        sx={{ flex: 2 }}
                                    />
                                    <Button
                                        variant='contained'
                                        size='small'
                                        disabled={!metaDirty || savingMeta}
                                        onClick={handleSaveMeta}
                                        startIcon={
                                            savingMeta ? (
                                                <CircularProgress size={14} color='inherit' />
                                            ) : (
                                                <IconCheck size={16} />
                                            )
                                        }
                                        sx={{ alignSelf: 'center', whiteSpace: 'nowrap' }}
                                    >
                                        {savingMeta ? 'Saving…' : 'Save'}
                                    </Button>
                                </Stack>

                                {metaError && (
                                    <Typography variant='body2' color='error'>
                                        {metaError}
                                    </Typography>
                                )}
                            </Stack>
                        </Paper>

                        {/* ── Entries table ── */}
                        <Box>
                            <Stack
                                direction='row'
                                justifyContent='space-between'
                                alignItems='center'
                                sx={{ mb: 1 }}
                            >
                                <Typography variant='subtitle1' fontWeight={600}>
                                    Entries
                                </Typography>
                                <Tooltip
                                    title={
                                        isSynthesizing
                                            ? 'Cannot edit while synthesizing'
                                            : editingRow
                                            ? 'Finish editing the current row first'
                                            : 'Add a new entry'
                                    }
                                >
                                    <span>
                                        <Button
                                            size='small'
                                            variant='outlined'
                                            startIcon={<IconPlus size={16} />}
                                            onClick={handleAddRow}
                                            disabled={!!editingRow || isSynthesizing}
                                        >
                                            Add Entry
                                        </Button>
                                    </span>
                                </Tooltip>
                            </Stack>

                            {rowError && (
                                <Alert severity='error' sx={{ mb: 1 }}>
                                    {rowError}
                                </Alert>
                            )}

                            <TableContainer component={Paper} variant='outlined'>
                                <Table size='small'>
                                    <TableHead>
                                        <TableRow>
                                            <StyledTableCell sx={{ width: 48 }}>#</StyledTableCell>
                                            <StyledTableCell sx={{ width: '30%' }}>Input</StyledTableCell>
                                            <StyledTableCell sx={{ width: '30%' }}>
                                                Expected Output
                                            </StyledTableCell>
                                            <StyledTableCell>Context</StyledTableCell>
                                            <StyledTableCell align='right' sx={{ width: 110 }}>
                                                Actions
                                            </StyledTableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {pageEntries.length === 0 && !showNewRow ? (
                                            <StyledTableRow>
                                                <StyledTableCell colSpan={5} align='center' sx={{ py: 3 }}>
                                                    <Typography variant='body2' color='text.secondary'>
                                                        No entries yet. Click &quot;Add Entry&quot; to create one.
                                                    </Typography>
                                                </StyledTableCell>
                                            </StyledTableRow>
                                        ) : (
                                            pageEntries.map((entry, idx) => {
                                                const globalIdx = page * ROWS_PER_PAGE + idx + 1
                                                const isEditing = editingRow?.id === entry.id
                                                const isConfirmingDelete = confirmDeleteId === entry.id

                                                return (
                                                    <StyledTableRow
                                                        key={entry.id}
                                                        hover={!isEditing && !isConfirmingDelete}
                                                        onClick={
                                                            !isEditing && !isConfirmingDelete
                                                                ? () => handleOpenDrawer(entry, globalIdx)
                                                                : undefined
                                                        }
                                                        sx={
                                                            !isEditing && !isConfirmingDelete
                                                                ? { cursor: 'pointer' }
                                                                : undefined
                                                        }
                                                    >
                                                        <StyledTableCell>{globalIdx}</StyledTableCell>

                                                        {isEditing ? (
                                                            <>
                                                                <StyledTableCell sx={{ verticalAlign: 'top', pt: 1 }}>
                                                                    <TextField
                                                                        value={editingRow.input}
                                                                        onChange={(e) =>
                                                                            setEditingRow((r) => ({
                                                                                ...r,
                                                                                input: e.target.value
                                                                            }))
                                                                        }
                                                                        multiline
                                                                        minRows={2}
                                                                        maxRows={6}
                                                                        size='small'
                                                                        fullWidth
                                                                        placeholder='Input (required)'
                                                                    />
                                                                </StyledTableCell>
                                                                <StyledTableCell sx={{ verticalAlign: 'top', pt: 1 }}>
                                                                    <TextField
                                                                        value={editingRow.expected_output}
                                                                        onChange={(e) =>
                                                                            setEditingRow((r) => ({
                                                                                ...r,
                                                                                expected_output: e.target.value
                                                                            }))
                                                                        }
                                                                        multiline
                                                                        minRows={2}
                                                                        maxRows={6}
                                                                        size='small'
                                                                        fullWidth
                                                                        placeholder='Expected output'
                                                                    />
                                                                </StyledTableCell>
                                                                <StyledTableCell sx={{ verticalAlign: 'top', pt: 1 }}>
                                                                    <TextField
                                                                        value={editingRow.contextText}
                                                                        onChange={(e) =>
                                                                            setEditingRow((r) => ({
                                                                                ...r,
                                                                                contextText: e.target.value
                                                                            }))
                                                                        }
                                                                        multiline
                                                                        minRows={2}
                                                                        maxRows={6}
                                                                        size='small'
                                                                        fullWidth
                                                                        placeholder='One context item per line'
                                                                        helperText='Each line → one context string'
                                                                    />
                                                                </StyledTableCell>
                                                                <StyledTableCell align='right' sx={{ verticalAlign: 'top', pt: 1 }}>
                                                                    <Stack
                                                                        direction='row'
                                                                        justifyContent='flex-end'
                                                                        spacing={0.5}
                                                                    >
                                                                        <Tooltip title='Save'>
                                                                            <span>
                                                                                <IconButton
                                                                                    size='small'
                                                                                    color='primary'
                                                                                    onClick={(event) => {
                                                                                        event.stopPropagation()
                                                                                        handleSaveRow()
                                                                                    }}
                                                                                    disabled={savingRow}
                                                                                >
                                                                                    {savingRow ? (
                                                                                        <CircularProgress size={16} />
                                                                                    ) : (
                                                                                        <IconCheck size={16} />
                                                                                    )}
                                                                                </IconButton>
                                                                            </span>
                                                                        </Tooltip>
                                                                        <Tooltip title='Cancel'>
                                                                            <IconButton
                                                                                size='small'
                                                                                onClick={(event) => {
                                                                                    event.stopPropagation()
                                                                                    handleCancelEdit()
                                                                                }}
                                                                                disabled={savingRow}
                                                                            >
                                                                                <IconX size={16} />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    </Stack>
                                                                </StyledTableCell>
                                                            </>
                                                        ) : isConfirmingDelete ? (
                                                            <>
                                                                <StyledTableCell colSpan={3}>
                                                                    <Typography variant='body2' color='error'>
                                                                        Delete this entry? This cannot be undone.
                                                                    </Typography>
                                                                </StyledTableCell>
                                                                <StyledTableCell align='right'>
                                                                    <Stack
                                                                        direction='row'
                                                                        justifyContent='flex-end'
                                                                        spacing={0.5}
                                                                    >
                                                                        <Button
                                                                            size='small'
                                                                            color='error'
                                                                            variant='contained'
                                                                            onClick={(event) => {
                                                                                event.stopPropagation()
                                                                                handleDeleteEntry(entry.id)
                                                                            }}
                                                                            disabled={deletingEntry}
                                                                            startIcon={
                                                                                deletingEntry ? (
                                                                                    <CircularProgress
                                                                                        size={12}
                                                                                        color='inherit'
                                                                                    />
                                                                                ) : null
                                                                            }
                                                                        >
                                                                            Delete
                                                                        </Button>
                                                                        <Button
                                                                            size='small'
                                                                            onClick={(event) => {
                                                                                event.stopPropagation()
                                                                                setConfirmDeleteId(null)
                                                                            }}
                                                                            disabled={deletingEntry}
                                                                        >
                                                                            Cancel
                                                                        </Button>
                                                                    </Stack>
                                                                </StyledTableCell>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <StyledTableCell>
                                                                    <Typography
                                                                        variant='body2'
                                                                        sx={{
                                                                            whiteSpace: 'pre-wrap',
                                                                            wordBreak: 'break-word',
                                                                            maxHeight: 80,
                                                                            overflow: 'hidden'
                                                                        }}
                                                                    >
                                                                        {entry.input || '—'}
                                                                    </Typography>
                                                                </StyledTableCell>
                                                                <StyledTableCell>
                                                                    <Typography
                                                                        variant='body2'
                                                                        sx={{
                                                                            whiteSpace: 'pre-wrap',
                                                                            wordBreak: 'break-word',
                                                                            maxHeight: 80,
                                                                            overflow: 'hidden'
                                                                        }}
                                                                    >
                                                                        {entry.expected_output || '—'}
                                                                    </Typography>
                                                                </StyledTableCell>
                                                                <StyledTableCell>
                                                                    <Typography
                                                                        variant='body2'
                                                                        sx={{
                                                                            whiteSpace: 'pre-wrap',
                                                                            wordBreak: 'break-word',
                                                                            maxHeight: 80,
                                                                            overflow: 'hidden'
                                                                        }}
                                                                    >
                                                                        {entry.context && entry.context.length > 0
                                                                            ? entry.context.join('\n')
                                                                            : '—'}
                                                                    </Typography>
                                                                </StyledTableCell>
                                                                <StyledTableCell align='right'>
                                                                    <Stack
                                                                        direction='row'
                                                                        justifyContent='flex-end'
                                                                        spacing={0.5}
                                                                    >
                                                                        <Tooltip
                                                                            title={
                                                                                isSynthesizing
                                                                                    ? 'Cannot edit while synthesizing'
                                                                                    : 'Edit entry'
                                                                            }
                                                                        >
                                                                            <span>
                                                                                <IconButton
                                                                                    size='small'
                                                                                    onClick={(event) => {
                                                                                        event.stopPropagation()
                                                                                        handleEditRow(entry)
                                                                                    }}
                                                                                    disabled={
                                                                                        !!editingRow || isSynthesizing
                                                                                    }
                                                                                >
                                                                                    <IconPencil size={16} />
                                                                                </IconButton>
                                                                            </span>
                                                                        </Tooltip>
                                                                        <Tooltip
                                                                            title={
                                                                                isSynthesizing
                                                                                    ? 'Cannot delete while synthesizing'
                                                                                    : 'Delete entry'
                                                                            }
                                                                        >
                                                                            <span>
                                                                                <IconButton
                                                                                    size='small'
                                                                                    color='error'
                                                                                    onClick={(event) => {
                                                                                        event.stopPropagation()
                                                                                        handleCloseDrawer()
                                                                                        setConfirmDeleteId(entry.id)
                                                                                    }}
                                                                                    disabled={
                                                                                        !!editingRow || isSynthesizing
                                                                                    }
                                                                                >
                                                                                    <IconTrash size={16} />
                                                                                </IconButton>
                                                                            </span>
                                                                        </Tooltip>
                                                                    </Stack>
                                                                </StyledTableCell>
                                                            </>
                                                        )}
                                                    </StyledTableRow>
                                                )
                                            })
                                        )}

                                        {/* New entry row — always shown at bottom when adding */}
                                        {showNewRow && (
                                            <StyledTableRow>
                                                <StyledTableCell>{entries.length + 1}</StyledTableCell>
                                                <StyledTableCell sx={{ verticalAlign: 'top', pt: 1 }}>
                                                    <TextField
                                                        value={editingRow.input}
                                                        onChange={(e) =>
                                                            setEditingRow((r) => ({ ...r, input: e.target.value }))
                                                        }
                                                        multiline
                                                        minRows={2}
                                                        maxRows={6}
                                                        size='small'
                                                        fullWidth
                                                        placeholder='Input (required)'
                                                        autoFocus
                                                    />
                                                </StyledTableCell>
                                                <StyledTableCell sx={{ verticalAlign: 'top', pt: 1 }}>
                                                    <TextField
                                                        value={editingRow.expected_output}
                                                        onChange={(e) =>
                                                            setEditingRow((r) => ({
                                                                ...r,
                                                                expected_output: e.target.value
                                                            }))
                                                        }
                                                        multiline
                                                        minRows={2}
                                                        maxRows={6}
                                                        size='small'
                                                        fullWidth
                                                        placeholder='Expected output'
                                                    />
                                                </StyledTableCell>
                                                <StyledTableCell sx={{ verticalAlign: 'top', pt: 1 }}>
                                                    <TextField
                                                        value={editingRow.contextText}
                                                        onChange={(e) =>
                                                            setEditingRow((r) => ({
                                                                ...r,
                                                                contextText: e.target.value
                                                            }))
                                                        }
                                                        multiline
                                                        minRows={2}
                                                        maxRows={6}
                                                        size='small'
                                                        fullWidth
                                                        placeholder='One context item per line'
                                                        helperText='Each line → one context string'
                                                    />
                                                </StyledTableCell>
                                                <StyledTableCell
                                                    align='right'
                                                    sx={{ verticalAlign: 'top', pt: 1 }}
                                                >
                                                    <Stack
                                                        direction='row'
                                                        justifyContent='flex-end'
                                                        spacing={0.5}
                                                    >
                                                        <Tooltip title='Save'>
                                                            <span>
                                                                <IconButton
                                                                    size='small'
                                                                    color='primary'
                                                                    onClick={handleSaveRow}
                                                                    disabled={savingRow}
                                                                >
                                                                    {savingRow ? (
                                                                        <CircularProgress size={16} />
                                                                    ) : (
                                                                        <IconCheck size={16} />
                                                                    )}
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                        <Tooltip title='Cancel'>
                                                            <IconButton
                                                                size='small'
                                                                onClick={handleCancelEdit}
                                                                disabled={savingRow}
                                                            >
                                                                <IconX size={16} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Stack>
                                                </StyledTableCell>
                                            </StyledTableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            {entries.length > ROWS_PER_PAGE && (
                                <TablePagination
                                    component='div'
                                    count={entries.length}
                                    page={page}
                                    rowsPerPage={ROWS_PER_PAGE}
                                    rowsPerPageOptions={[ROWS_PER_PAGE]}
                                    onPageChange={(_, newPage) => {
                                        setEditingRow(null)
                                        setConfirmDeleteId(null)
                                        setPage(newPage)
                                    }}
                                />
                            )}
                        </Box>
                    </Stack>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>

            <Drawer
                anchor='right'
                open={drawerOpen}
                onClose={handleCloseDrawer}
                sx={{ zIndex: (theme) => theme.zIndex.modal + 10 }}
                PaperProps={{
                    sx: {
                        width: { xs: '100%', sm: 520, md: 680 },
                        p: 3,
                        bgcolor: 'background.paper'
                    }
                }}
            >
                {selectedEntry && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Box>
                                <Typography variant='h6'>Entry #{selectedEntry._entryNumber} Details</Typography>
                                <Typography variant='body2' color='text.secondary'>
                                    Entry ID: {selectedEntry.id}
                                </Typography>
                            </Box>
                            <IconButton onClick={handleCloseDrawer} size='small'>
                                <IconX size={20} />
                            </IconButton>
                        </Box>

                        <Divider sx={{ mb: 2 }} />

                        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                            <Tabs
                                variant='scrollable'
                                scrollButtons='auto'
                                value={detailTabValue}
                                onChange={handleDetailTabChange}
                                aria-label='dataset entry detail tabs'
                            >
                                <Tab label='Input' id='dataset-detail-tab-0' aria-controls='dataset-detail-tabpanel-0' />
                                <Tab
                                    label='Expected Output'
                                    id='dataset-detail-tab-1'
                                    aria-controls='dataset-detail-tabpanel-1'
                                    disabled={!selectedEntry.expected_output}
                                />
                                <Tab
                                    label='Context'
                                    id='dataset-detail-tab-2'
                                    aria-controls='dataset-detail-tabpanel-2'
                                    disabled={!selectedEntry.context || selectedEntry.context.length === 0}
                                />
                            </Tabs>
                        </Box>

                        <Box sx={{ flexGrow: 1, overflowY: 'auto', pt: 2 }}>
                            <TabPanel value={detailTabValue} index={0}>
                                <Paper variant='outlined' sx={{ p: 2 }}>
                                    <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {selectedEntry.input || '—'}
                                    </Typography>
                                </Paper>
                            </TabPanel>

                            <TabPanel value={detailTabValue} index={1}>
                                <Paper variant='outlined' sx={{ p: 2 }}>
                                    <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {selectedEntry.expected_output || '—'}
                                    </Typography>
                                </Paper>
                            </TabPanel>

                            <TabPanel value={detailTabValue} index={2}>
                                <Paper variant='outlined' sx={{ p: 2 }}>
                                    {selectedEntry.context && selectedEntry.context.length > 0 ? (
                                        selectedEntry.context.map((contextItem, index) => (
                                            <Typography
                                                key={`${selectedEntry.id}-${index}`}
                                                variant='body2'
                                                sx={{
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                    mb: index < selectedEntry.context.length - 1 ? 2 : 0
                                                }}
                                            >
                                                {contextItem}
                                            </Typography>
                                        ))
                                    ) : (
                                        <Typography variant='body2'>—</Typography>
                                    )}
                                </Paper>
                            </TabPanel>
                        </Box>
                    </Box>
                )}
            </Drawer>
        </Dialog>
    )
}

DatasetDetailDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    datasetId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    onClose: PropTypes.func.isRequired,
    onDatasetChanged: PropTypes.func
}

export default DatasetDetailDialog
