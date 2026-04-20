import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import {
    Box,
    Chip,
    CircularProgress,
    Divider,
    Drawer,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Tooltip,
    Typography
} from '@mui/material'
import { styled, useTheme } from '@mui/material/styles'
import { tableCellClasses } from '@mui/material/TableCell'

import { IconEye, IconRefresh, IconX } from '@tabler/icons-react'

import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import { StyledButton } from '@/ui-component/button/StyledButton'
import chatflowsApi from '@/api/chatflows'
import useApi from '@/hooks/useApi'
import config from '@/config'

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: theme.palette.grey[900] + 25,
    verticalAlign: 'top',
    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.grey[900],
        fontWeight: 600
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14,
        padding: '10px 12px'
    }
}))

const StyledTableRow = styled(TableRow)(() => ({
    '&:last-child td, &:last-child th': {
        border: 0
    }
}))

const OverflowTypography = styled(Typography)(() => ({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block'
}))

const formatDate = (dateStr) => {
    if (!dateStr) return '—'

    try {
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return dateStr
        return date.toLocaleString()
    } catch {
        return dateStr
    }
}

const truncateText = (text, maxLength = 100) => {
    if (!text) return '—'
    if (text.length <= maxLength) return text
    return `${text.substring(0, maxLength)}...`
}

const formatDuration = (durationNs) => {
    if (durationNs === null || durationNs === undefined || durationNs === '') return '—'

    const numericDuration = Number(durationNs)
    if (Number.isNaN(numericDuration)) return String(durationNs)

    const durationMs = numericDuration / 1000000

    if (durationMs < 1) return `${(numericDuration / 1000).toFixed(2)} μs`
    if (durationMs < 1000) return `${durationMs.toFixed(durationMs < 10 ? 2 : 1)} ms`
    return `${(durationMs / 1000).toFixed(2)} s`
}

const formatPayload = (payload) => {
    if (!payload) return '—'

    if (typeof payload === 'object') {
        return JSON.stringify(payload, null, 2)
    }

    if (typeof payload !== 'string') {
        return String(payload)
    }

    try {
        return JSON.stringify(JSON.parse(payload), null, 2)
    } catch {
        return payload
    }
}

const getStatusPresentation = (statusCode) => {
    const normalizedStatus = String(statusCode || '').toLowerCase()

    if (normalizedStatus.includes('error') || normalizedStatus.includes('fail')) {
        return { label: statusCode || 'Error', color: 'error' }
    }

    if (normalizedStatus === 'ok' || normalizedStatus === 'success') {
        return { label: statusCode, color: 'success' }
    }

    return { label: statusCode || 'Unset', color: 'default' }
}

const flattenSpans = (spans, depth = 0) => {
    if (!Array.isArray(spans)) return []

    return spans.flatMap((span) => [{ ...span, depth }, ...flattenSpans(span.children, depth + 1)])
}

const buildTraceSummary = (traceTree) => {
    const rootSpans = Array.isArray(traceTree?.spans) ? traceTree.spans : []
    const flatSpans = flattenSpans(rootSpans)
    const services = [...new Set(flatSpans.map((span) => span.service_name).filter(Boolean))]
    const llmCalls = flatSpans.filter((span) => span.llm_input || span.llm_output).length
    const durationNs = flatSpans.reduce((maxDuration, span) => Math.max(maxDuration, Number(span.duration) || 0), 0)

    let statusLabel = 'Captured'
    let statusColor = 'info'
    if (flatSpans.some((span) => {
        const normalizedStatus = String(span.status_code || '').toLowerCase()
        return normalizedStatus.includes('error') || normalizedStatus.includes('fail')
    })) {
        statusLabel = 'Issues'
        statusColor = 'error'
    } else if (flatSpans.some((span) => {
        const normalizedStatus = String(span.status_code || '').toLowerCase()
        return normalizedStatus === 'ok' || normalizedStatus === 'success'
    })) {
        statusLabel = 'OK'
        statusColor = 'success'
    }

    return {
        rootSpanCount: rootSpans.length,
        rootSpanName: rootSpans[0]?.span_name || '—',
        totalSpans: flatSpans.length,
        llmCalls,
        durationNs,
        services,
        statusLabel,
        statusColor
    }
}

const MetadataField = ({ label, value, monospace = false }) => (
    <Box>
        <Typography variant='caption' color='text.secondary'>
            {label}
        </Typography>
        <Typography
            variant='body2'
            sx={{
                mt: 0.5,
                fontFamily: monospace ? 'monospace' : 'inherit',
                fontSize: monospace ? '0.8rem' : '0.9rem',
                wordBreak: 'break-word'
            }}
        >
            {value || '—'}
        </Typography>
    </Box>
)

const DetailSection = ({ title, value, theme }) => (
    <Box>
        <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {title}
        </Typography>
        <Paper variant='outlined' sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50' }}>
            <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {value || '—'}
            </Typography>
        </Paper>
    </Box>
)

export default function LLMTraces() {
    const theme = useTheme()
    const { ns } = useParams()

    const [traceList, setTraceList] = useState([])
    const [traceSummaryMap, setTraceSummaryMap] = useState({})
    const [traceTreeCache, setTraceTreeCache] = useState({})
    const [traceData, setTraceData] = useState(null)
    const [selectedTraceId, setSelectedTraceId] = useState(null)
    const [selectedSpan, setSelectedSpan] = useState(null)
    const [searchValue, setSearchValue] = useState('')
    const [page, setPage] = useState(0)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const [workflowName, setWorkflowName] = useState('')
    const [isLoadingTraces, setIsLoadingTraces] = useState(true)
    const [isLoadingTraceDetails, setIsLoadingTraceDetails] = useState(false)
    const [traceError, setTraceError] = useState(null)
    const [traceDetailsError, setTraceDetailsError] = useState(null)

    const pendingSummaryIdsRef = useRef(new Set())

    const studioServerUrl = config.studio_server_url
    const sandboxTracerListEndpoint = config.sandbox_tracer_list_endpoint
    const sandboxTracerTreeEndpoint = config.sandbox_tracer_tree_endpoint

    const getAllOpeaflowsApi = useApi(chatflowsApi.getAllOpeaflows)

    const filteredTraceList = traceList.filter((trace) => {
        if (!searchValue.trim()) return true
        return String(trace.trace_id || '').toLowerCase().includes(searchValue.trim().toLowerCase())
    })

    const paginatedTraceList = filteredTraceList.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    const selectedTrace = traceList.find((trace) => trace.trace_id === selectedTraceId) || null
    const selectedTraceSummary = selectedTraceId ? traceSummaryMap[selectedTraceId] || buildTraceSummary(traceData) : null
    const selectedTraceSpans = flattenSpans(traceData?.spans || [])

    const fetchTraceTreeData = async (traceId) => {
        const response = await fetch(`${studioServerUrl}/${sandboxTracerTreeEndpoint}/${traceId}`, {
            headers: { 'Content-Type': 'application/json' }
        })

        if (!response.ok) {
            const errorPayload = await response.json().catch(() => null)
            throw new Error(errorPayload?.detail || 'Failed to load trace details.')
        }

        return response.json()
    }

    const loadTraces = async () => {
        try {
            setIsLoadingTraces(true)
            setTraceError(null)

            const response = await fetch(`${studioServerUrl}/${sandboxTracerListEndpoint}/${ns}`, {
                headers: { 'Content-Type': 'application/json' }
            })

            if (response.status === 404) {
                setTraceList([])
                return
            }

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => null)
                throw new Error(errorPayload?.detail || 'Failed to load traces.')
            }

            const responseData = await response.json()
            const nextTraceList = Array.isArray(responseData?.trace_ids) ? responseData.trace_ids : []

            setTraceList(nextTraceList)
            setPage(0)

            if (selectedTraceId && !nextTraceList.some((trace) => trace.trace_id === selectedTraceId)) {
                setSelectedTraceId(null)
            }
        } catch (error) {
            setTraceError(error.message || 'Failed to load traces.')
            setTraceList([])
        } finally {
            setIsLoadingTraces(false)
        }
    }

    useEffect(() => {
        setSelectedTraceId(null)
        setTraceData(null)
        setSelectedSpan(null)
        loadTraces()
    }, [ns, studioServerUrl, sandboxTracerListEndpoint])

    useEffect(() => {
        getAllOpeaflowsApi.request()
    }, [])

    useEffect(() => {
        if (!getAllOpeaflowsApi.data || !ns) return

        const matchingFlow = getAllOpeaflowsApi.data.find((flow) => `sandbox-${flow.id}` === ns)
        setWorkflowName(matchingFlow ? matchingFlow.name : '')
    }, [getAllOpeaflowsApi.data, ns])

    useEffect(() => {
        const missingTraceIds = paginatedTraceList
            .map((trace) => trace.trace_id)
            .filter((traceId) => traceId && !traceSummaryMap[traceId] && !pendingSummaryIdsRef.current.has(traceId))

        if (!missingTraceIds.length) return

        let isActive = true
        missingTraceIds.forEach((traceId) => pendingSummaryIdsRef.current.add(traceId))

        Promise.all(
            missingTraceIds.map(async (traceId) => {
                try {
                    const traceTree = await fetchTraceTreeData(traceId)
                    return { traceId, traceTree }
                } catch {
                    return null
                }
            })
        ).then((results) => {
            if (!isActive) return

            const nextSummaryMap = {}
            const nextTraceTreeCache = {}

            results.forEach((result) => {
                if (!result?.traceTree) return

                nextSummaryMap[result.traceId] = buildTraceSummary(result.traceTree)
                nextTraceTreeCache[result.traceId] = result.traceTree
            })

            if (Object.keys(nextSummaryMap).length > 0) {
                setTraceSummaryMap((prev) => ({ ...prev, ...nextSummaryMap }))
            }

            if (Object.keys(nextTraceTreeCache).length > 0) {
                setTraceTreeCache((prev) => ({ ...prev, ...nextTraceTreeCache }))
            }
        }).finally(() => {
            missingTraceIds.forEach((traceId) => pendingSummaryIdsRef.current.delete(traceId))
        })

        return () => {
            isActive = false
        }
    }, [paginatedTraceList, traceSummaryMap])

    useEffect(() => {
        if (!selectedTraceId) {
            setTraceData(null)
            setSelectedSpan(null)
            setTraceDetailsError(null)
            return
        }

        const cachedTrace = traceTreeCache[selectedTraceId]
        if (cachedTrace) {
            const flatSpans = flattenSpans(cachedTrace.spans || [])
            setTraceData(cachedTrace)
            setSelectedSpan((currentSelectedSpan) => {
                if (currentSelectedSpan && flatSpans.some((span) => span.span_id === currentSelectedSpan.span_id)) {
                    return currentSelectedSpan
                }

                return flatSpans[0] || null
            })
            setTraceDetailsError(null)
            setIsLoadingTraceDetails(false)
            return
        }

        let isActive = true

        setIsLoadingTraceDetails(true)
        setTraceDetailsError(null)
        setTraceData(null)
        setSelectedSpan(null)

        fetchTraceTreeData(selectedTraceId)
            .then((traceTree) => {
                if (!isActive) return

                const flatSpans = flattenSpans(traceTree.spans || [])
                setTraceTreeCache((prev) => ({ ...prev, [selectedTraceId]: traceTree }))
                setTraceSummaryMap((prev) => ({
                    ...prev,
                    [selectedTraceId]: prev[selectedTraceId] || buildTraceSummary(traceTree)
                }))
                setTraceData(traceTree)
                setSelectedSpan(flatSpans[0] || null)
            })
            .catch((error) => {
                if (!isActive) return
                setTraceDetailsError(error.message || 'Failed to load trace details.')
            })
            .finally(() => {
                if (!isActive) return
                setIsLoadingTraceDetails(false)
            })

        return () => {
            isActive = false
        }
    }, [selectedTraceId, traceTreeCache, sandboxTracerTreeEndpoint, studioServerUrl])

    const handleChangePage = (_event, newPage) => {
        setPage(newPage)
    }

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10))
        setPage(0)
    }

    const handleSearchChange = (event) => {
        setSearchValue(event.target.value)
        setPage(0)
    }

    return (
        <MainCard sx={{ background: theme.palette.background.default }}>
            <Stack spacing={3}>
                <ViewHeader
                    title='LLM Call Traces'
                    description={workflowName ? `Workflow: ${workflowName}` : undefined}
                    search={true}
                    searchPlaceholder='Search Trace ID'
                    onSearchChange={handleSearchChange}
                >
                    <StyledButton
                        size='small'
                        variant='outlined'
                        onClick={loadTraces}
                        disabled={isLoadingTraces}
                        startIcon={isLoadingTraces ? <CircularProgress size={14} /> : <IconRefresh size={16} />}
                        sx={{ borderRadius: 2, height: 40 }}
                    >
                        Refresh
                    </StyledButton>
                </ViewHeader>

                <Paper sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
                        <MetadataField label='Workflow' value={workflowName || '—'} />
                        <MetadataField label='Namespace' value={ns || '—'} monospace />
                        <MetadataField label='Total Traces' value={String(traceList.length)} />
                        <MetadataField label='Selected Trace' value={selectedTraceId || '—'} monospace />
                    </Box>
                </Paper>

                {traceError && <Typography color='error'>{traceError}</Typography>}

                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <StyledTableCell sx={{ width: '24%' }}>Trace ID</StyledTableCell>
                                <StyledTableCell sx={{ width: '24%' }}>Root Span</StyledTableCell>
                                <StyledTableCell sx={{ width: '22%' }}>Span Summary</StyledTableCell>
                                <StyledTableCell sx={{ width: '18%' }}>Recorded At</StyledTableCell>
                                <StyledTableCell sx={{ width: '8%' }}>Status</StyledTableCell>
                                <StyledTableCell sx={{ width: '4%' }}>Actions</StyledTableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoadingTraces ? (
                                <StyledTableRow>
                                    <StyledTableCell colSpan={6} align='center' sx={{ py: 4 }}>
                                        <CircularProgress size={24} />
                                    </StyledTableCell>
                                </StyledTableRow>
                            ) : paginatedTraceList.length === 0 ? (
                                <StyledTableRow>
                                    <StyledTableCell colSpan={6} align='center' sx={{ py: 4 }}>
                                        <Typography variant='body2' color='text.secondary'>
                                            {searchValue.trim() ? 'No traces match the current search.' : 'No traces found for this sandbox.'}
                                        </Typography>
                                    </StyledTableCell>
                                </StyledTableRow>
                            ) : (
                                paginatedTraceList.map((trace) => {
                                    const traceSummary = traceSummaryMap[trace.trace_id]

                                    return (
                                        <StyledTableRow
                                            key={trace.trace_id}
                                            hover
                                            onClick={() => setSelectedTraceId(trace.trace_id)}
                                            sx={{
                                                cursor: 'pointer',
                                                bgcolor:
                                                    selectedTraceId === trace.trace_id
                                                        ? theme.palette.mode === 'dark'
                                                            ? 'grey.800'
                                                            : 'grey.100'
                                                        : 'inherit'
                                            }}
                                        >
                                            <StyledTableCell sx={{ maxWidth: 260 }}>
                                                <Typography variant='body2' sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                                                    {trace.trace_id}
                                                </Typography>
                                            </StyledTableCell>
                                            <StyledTableCell sx={{ maxWidth: 260 }}>
                                                {traceSummary ? (
                                                    <Stack spacing={0.5}>
                                                        <Typography variant='body2' sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                                                            {traceSummary.rootSpanCount > 1
                                                                ? `${traceSummary.rootSpanName} +${traceSummary.rootSpanCount - 1} more`
                                                                : traceSummary.rootSpanName}
                                                        </Typography>
                                                        <Typography variant='caption' color='text.secondary'>
                                                            {traceSummary.services.length > 0 ? truncateText(traceSummary.services.join(', '), 50) : 'Service data unavailable'}
                                                        </Typography>
                                                    </Stack>
                                                ) : (
                                                    <Typography variant='body2' color='text.secondary'>
                                                        Loading summary...
                                                    </Typography>
                                                )}
                                            </StyledTableCell>
                                            <StyledTableCell>
                                                {traceSummary ? (
                                                    <Stack spacing={0.5}>
                                                        <Typography variant='caption' component='div'>
                                                            <strong>{traceSummary.totalSpans}</strong> spans · <strong>{traceSummary.rootSpanCount}</strong> root spans
                                                        </Typography>
                                                        <Typography variant='caption' component='div'>
                                                            <strong>{traceSummary.llmCalls}</strong> LLM payloads · {formatDuration(traceSummary.durationNs)}
                                                        </Typography>
                                                    </Stack>
                                                ) : (
                                                    <CircularProgress size={14} />
                                                )}
                                            </StyledTableCell>
                                            <StyledTableCell>
                                                <Tooltip title={`Started: ${formatDate(trace.start)}${trace.end ? `\nEnded: ${formatDate(trace.end)}` : ''}`} placement='top'>
                                                    <Stack spacing={0.25}>
                                                        <OverflowTypography variant='body2'>{formatDate(trace.start)}</OverflowTypography>
                                                        <Typography variant='caption' color='text.secondary'>
                                                            Ended: {formatDate(trace.end)}
                                                        </Typography>
                                                    </Stack>
                                                </Tooltip>
                                            </StyledTableCell>
                                            <StyledTableCell>
                                                <Chip label={traceSummary?.statusLabel || 'Loading'} color={traceSummary?.statusColor || 'default'} size='small' />
                                            </StyledTableCell>
                                            <StyledTableCell onClick={(event) => event.stopPropagation()}>
                                                <Tooltip title='View Details'>
                                                    <IconButton size='small' color='primary' onClick={() => setSelectedTraceId(trace.trace_id)}>
                                                        <IconEye size={16} />
                                                    </IconButton>
                                                </Tooltip>
                                            </StyledTableCell>
                                        </StyledTableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                {filteredTraceList.length > 0 && (
                    <TablePagination
                        rowsPerPageOptions={[5, 10, 20, 50]}
                        component='div'
                        count={filteredTraceList.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                    />
                )}
            </Stack>

            <Drawer
                anchor='right'
                open={Boolean(selectedTraceId)}
                onClose={() => setSelectedTraceId(null)}
                sx={{ zIndex: (currentTheme) => currentTheme.zIndex.modal + 10 }}
                PaperProps={{
                    sx: {
                        width: { xs: '100%', sm: 680, md: 860 },
                        p: 3,
                        bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'background.paper'
                    }
                }}
            >
                {selectedTraceId && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant='h5'>Trace Details</Typography>
                            <IconButton size='small' onClick={() => setSelectedTraceId(null)}>
                                <IconX size={18} />
                            </IconButton>
                        </Box>

                        <Divider sx={{ mb: 3 }} />

                        <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 1 }}>
                            {isLoadingTraceDetails ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                                    <CircularProgress />
                                </Box>
                            ) : traceDetailsError ? (
                                <Typography color='error'>{traceDetailsError}</Typography>
                            ) : (
                                <Stack spacing={3}>
                                    <Box>
                                        <Typography variant='h6' sx={{ mb: 2 }}>
                                            Trace Information
                                        </Typography>
                                        <Paper sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50' }}>
                                            <Stack spacing={2}>
                                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                                    <MetadataField label='Trace ID' value={selectedTraceId} monospace />
                                                    <MetadataField label='Workflow' value={workflowName || '—'} />
                                                    <MetadataField label='Namespace' value={ns || '—'} monospace />
                                                    <MetadataField label='Status' value={selectedTraceSummary?.statusLabel || 'Captured'} />
                                                    <MetadataField label='Started At' value={formatDate(selectedTrace?.start)} />
                                                    <MetadataField label='Ended At' value={formatDate(selectedTrace?.end)} />
                                                    <MetadataField label='Root Spans' value={String(selectedTraceSummary?.rootSpanCount || 0)} />
                                                    <MetadataField label='Total Spans' value={String(selectedTraceSummary?.totalSpans || 0)} />
                                                    <MetadataField label='LLM Payloads' value={String(selectedTraceSummary?.llmCalls || 0)} />
                                                    <MetadataField label='Trace Duration' value={formatDuration(selectedTraceSummary?.durationNs)} />
                                                </Box>

                                                {selectedTraceSummary?.services?.length > 0 && (
                                                    <>
                                                        <Divider />
                                                        <Box>
                                                            <Typography variant='caption' color='text.secondary'>
                                                                Services
                                                            </Typography>
                                                            <Stack direction='row' spacing={0.5} sx={{ mt: 0.75, flexWrap: 'wrap' }}>
                                                                {selectedTraceSummary.services.map((serviceName) => (
                                                                    <Chip key={serviceName} label={serviceName} size='small' variant='outlined' />
                                                                ))}
                                                            </Stack>
                                                        </Box>
                                                    </>
                                                )}
                                            </Stack>
                                        </Paper>
                                    </Box>

                                    <Box>
                                        <Typography variant='h6' sx={{ mb: 2 }}>
                                            Span Execution Details ({selectedTraceSpans.length} spans)
                                        </Typography>
                                        {selectedTraceSpans.length > 0 ? (
                                            <TableContainer component={Paper}>
                                                <Table size='small' sx={{ tableLayout: 'fixed' }}>
                                                    <TableHead>
                                                        <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100' }}>
                                                            <StyledTableCell sx={{ width: '34%' }}>Span</StyledTableCell>
                                                            <StyledTableCell sx={{ width: '18%' }}>Service</StyledTableCell>
                                                            <StyledTableCell sx={{ width: '12%' }}>Kind</StyledTableCell>
                                                            <StyledTableCell sx={{ width: '12%' }}>Duration</StyledTableCell>
                                                            <StyledTableCell sx={{ width: '12%' }}>Status</StyledTableCell>
                                                            <StyledTableCell sx={{ width: '12%' }}>Payloads</StyledTableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {selectedTraceSpans.map((span) => {
                                                            const spanStatus = getStatusPresentation(span.status_code)
                                                            const isSelected = selectedSpan?.span_id === span.span_id

                                                            return (
                                                                <StyledTableRow
                                                                    key={span.span_id}
                                                                    hover
                                                                    onClick={() => setSelectedSpan(span)}
                                                                    sx={{
                                                                        cursor: 'pointer',
                                                                        bgcolor: isSelected
                                                                            ? theme.palette.mode === 'dark'
                                                                                ? 'grey.800'
                                                                                : 'grey.100'
                                                                            : 'inherit'
                                                                    }}
                                                                >
                                                                    <StyledTableCell>
                                                                        <Box sx={{ pl: span.depth * 2 }}>
                                                                            <Typography variant='caption' sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                                                                #{span.span_id.slice(0, 8)}
                                                                            </Typography>
                                                                            <Typography variant='body2' sx={{ fontWeight: span.depth === 0 ? 600 : 500, wordBreak: 'break-word' }}>
                                                                                {span.span_name}
                                                                            </Typography>
                                                                        </Box>
                                                                    </StyledTableCell>
                                                                    <StyledTableCell>
                                                                        <Typography variant='body2' sx={{ wordBreak: 'break-word' }}>
                                                                            {span.service_name || '—'}
                                                                        </Typography>
                                                                    </StyledTableCell>
                                                                    <StyledTableCell>{span.span_kind || '—'}</StyledTableCell>
                                                                    <StyledTableCell>{formatDuration(span.duration)}</StyledTableCell>
                                                                    <StyledTableCell>
                                                                        <Chip label={spanStatus.label} color={spanStatus.color} size='small' />
                                                                    </StyledTableCell>
                                                                    <StyledTableCell>
                                                                        {span.llm_input || span.llm_output ? <Chip label='Available' size='small' variant='outlined' /> : '—'}
                                                                    </StyledTableCell>
                                                                </StyledTableRow>
                                                            )
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        ) : (
                                            <Typography color='text.secondary'>No spans available for this trace.</Typography>
                                        )}
                                    </Box>

                                    <Box>
                                        <Typography variant='h6' sx={{ mb: 2 }}>
                                            Span Details
                                        </Typography>

                                        {selectedSpan ? (
                                            <Stack spacing={3}>
                                                <Paper sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50' }}>
                                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                                        <MetadataField label='Span Name' value={selectedSpan.span_name} />
                                                        <MetadataField label='Span ID' value={selectedSpan.span_id} monospace />
                                                        <MetadataField label='Parent Span ID' value={selectedSpan.parent_span_id || '—'} monospace />
                                                        <MetadataField label='Timestamp' value={formatDate(selectedSpan.timestamp)} />
                                                        <MetadataField label='Duration' value={formatDuration(selectedSpan.duration)} />
                                                        <MetadataField label='Service' value={selectedSpan.service_name || '—'} />
                                                        <MetadataField label='Scope' value={selectedSpan.scope_name || '—'} />
                                                        <MetadataField label='Status Message' value={selectedSpan.status_message || '—'} />
                                                    </Box>
                                                </Paper>

                                                <DetailSection title='LLM Input' value={formatPayload(selectedSpan.llm_input)} theme={theme} />
                                                <DetailSection title='LLM Output' value={formatPayload(selectedSpan.llm_output)} theme={theme} />
                                                <DetailSection title='Resource Attributes' value={formatPayload(selectedSpan.resource_attributes)} theme={theme} />
                                            </Stack>
                                        ) : (
                                            <Typography color='text.secondary'>Select a span to inspect its details.</Typography>
                                        )}
                                    </Box>
                                </Stack>
                            )}
                        </Box>
                    </Box>
                )}
            </Drawer>
        </MainCard>
    )
}
