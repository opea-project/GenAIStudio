import { useState, useRef, useCallback, useEffect } from 'react'
import PropTypes from 'prop-types'
import {
    Box,
    CircularProgress,
    ClickAwayListener,
    Divider,
    InputAdornment,
    List,
    ListItemButton,
    Paper,
    TextField,
    Tooltip,
    Typography
} from '@mui/material'
import { IconSearch, IconDownload, IconAlertCircle, IconCheck } from '@tabler/icons-react'
import evaluationApi from '@/api/evaluation'

// Hide embedding models from judge/synthesize dropdowns
const HIDDEN_MODEL_PATTERN = /nomic.embed/i

// How often to poll for pull completion (ms)
const POLL_INTERVAL_MS = 1200

const EMPTY_PULL_STATE = {
    modelName: '',
    status: '',
    detail: '',
    error: '',
    completed: null,
    total: null
}

const deriveProgressValue = (completed, total) => {
    if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) {
        return null
    }

    return Math.min(100, Math.max(0, (completed / total) * 100))
}

/**
 * Searchable judge model selector with an inline "Pull New Model" action
 * and real-time pull-progress polling.
 *
 * Props:
 *  - models          {Array}    – list of model objects with `name` (or `id`) field
 *  - value           {string}   – currently selected model name
 *  - onChange        {function} – called with the new model name string
 *  - onModelsRefresh {function} – called after a successful pull so parent can re-fetch
 *  - disabled        {boolean}  – disables the control
 */
const ModelSelect = ({ models, value, onChange, onModelsRefresh, disabled, label }) => {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')

    // Pull-progress state — persists even after dropdown closes
    const [pullState, setPullState] = useState(EMPTY_PULL_STATE)
    const [statusOffset, setStatusOffset] = useState(null)
    const [isReadyFading, setIsReadyFading] = useState(false)

    const pollTimerRef = useRef(null)
    const clearBannerTimerRef = useRef(null)
    const fadeReadyTimerRef = useRef(null)
    const anchorRef = useRef(null)
    const inputRef = useRef(null)

    const visibleModels = models.filter((m) => !HIDDEN_MODEL_PATTERN.test(m.name || m.id || ''))

    const filteredModels = visibleModels.filter((m) => {
        if (!search.trim()) return true
        return (m.name || m.id || '').toLowerCase().includes(search.trim().toLowerCase())
    })

    const searchTag = search.trim()
    const showPull = Boolean(searchTag)
    const alreadyInList = visibleModels.some(
        (m) => (m.name || m.id || '').toLowerCase() === searchTag.toLowerCase()
    )
    const progressValue = deriveProgressValue(pullState.completed, pullState.total)
    const isPulling = pullState.status === 'pulling'

    // ── Polling ──────────────────────────────────────────────────────────────

    const stopPolling = useCallback(() => {
        if (pollTimerRef.current) {
            clearTimeout(pollTimerRef.current)
            pollTimerRef.current = null
        }
    }, [])

    const stopClearBannerTimer = useCallback(() => {
        if (clearBannerTimerRef.current) {
            clearTimeout(clearBannerTimerRef.current)
            clearBannerTimerRef.current = null
        }
    }, [])

    const stopFadeReadyTimer = useCallback(() => {
        if (fadeReadyTimerRef.current) {
            clearTimeout(fadeReadyTimerRef.current)
            fadeReadyTimerRef.current = null
        }
    }, [])

    const clearPullStateSoon = useCallback(() => {
        setIsReadyFading(false)
        stopFadeReadyTimer()
        stopClearBannerTimer()
        fadeReadyTimerRef.current = setTimeout(() => {
            setIsReadyFading(true)
        }, 2200)
        clearBannerTimerRef.current = setTimeout(() => {
            setIsReadyFading(false)
            setPullState(EMPTY_PULL_STATE)
        }, 3000)
    }, [stopClearBannerTimer, stopFadeReadyTimer])

    const applyPullEntry = useCallback(
        (modelName, entry) => {
            if (!entry) return false

            stopClearBannerTimer()

            setPullState({
                modelName,
                status: entry.status || '',
                detail: entry.detail || '',
                error: entry.error || '',
                completed: Number.isFinite(entry.completed) ? entry.completed : null,
                total: Number.isFinite(entry.total) ? entry.total : null
            })

            if (entry.status === 'ready') {
                stopPolling()
                onModelsRefresh && onModelsRefresh()
                clearPullStateSoon()
                return true
            }

            if (entry.status === 'error') {
                stopPolling()
                return true
            }

            return false
        },
        [clearPullStateSoon, onModelsRefresh, stopClearBannerTimer, stopPolling]
    )

    const pollPullStatus = useCallback(
        async (modelName) => {
            try {
                const res = await evaluationApi.getPullStatus()
                const statusMap = res.data || {}
                const entry = statusMap[modelName]

                if (!entry) {
                    pollTimerRef.current = setTimeout(() => pollPullStatus(modelName), POLL_INTERVAL_MS)
                    return
                }

                const done = applyPullEntry(modelName, entry)
                if (!done) {
                    pollTimerRef.current = setTimeout(() => pollPullStatus(modelName), POLL_INTERVAL_MS)
                }
            } catch {
                pollTimerRef.current = setTimeout(() => pollPullStatus(modelName), POLL_INTERVAL_MS)
            }
        },
        [applyPullEntry]
    )

    const startPolling = useCallback(
        (modelName) => {
            stopPolling()
            pollPullStatus(modelName)
        },
        [pollPullStatus, stopPolling]
    )

    // Clean up on unmount
    useEffect(
        () => () => {
            stopPolling()
            stopClearBannerTimer()
            stopFadeReadyTimer()
        },
        [stopClearBannerTimer, stopFadeReadyTimer, stopPolling]
    )

    // ── Dropdown helpers ──────────────────────────────────────────────────────

    const handleOpen = useCallback(() => {
        if (disabled) return
        setSearch('')
        setOpen(true)
    }, [disabled])

    const handleClickAway = useCallback(() => {
        setOpen(false)
        setSearch('')
    }, [])

    const handleSelect = useCallback(
        (modelName) => {
            onChange(modelName)
            setOpen(false)
            setSearch('')
        },
        [onChange]
    )

    // ── Pull action ───────────────────────────────────────────────────────────

    const handlePull = useCallback(async () => {
        if (!searchTag || isPulling) return

        setIsReadyFading(false)
        stopFadeReadyTimer()
        stopClearBannerTimer()
        setPullState({
            modelName: searchTag,
            status: 'pulling',
            detail: 'Submitting pull request',
            error: '',
            completed: null,
            total: null
        })
        setOpen(false)
        setSearch('')
        // Pre-select so the field shows the model name immediately
        onChange(searchTag)

        try {
            await evaluationApi.pullModel({ model_name: searchTag })
            setPullState((current) => ({
                ...current,
                detail: 'Waiting for Ollama progress…'
            }))
            startPolling(searchTag)
        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                'Failed to initiate model pull.'
            setPullState({
                modelName: searchTag,
                status: 'error',
                detail: 'Pull failed',
                error: msg,
                completed: null,
                total: null
            })
        }
    }, [isPulling, onChange, searchTag, startPolling, stopClearBannerTimer, stopFadeReadyTimer])

    useEffect(() => {
        if (!value) return
        if (pullState.modelName) return

        let active = true

        const hydratePullState = async () => {
            try {
                const res = await evaluationApi.getPullStatus()
                const entry = res.data?.[value]
                if (!active || !entry) return
                if (entry.status !== 'pulling') return
                applyPullEntry(value, entry)
                startPolling(value)
            } catch {
                // Ignore hydration failures; explicit pulls still start polling.
            }
        }

        hydratePullState()

        return () => {
            active = false
        }
    }, [applyPullEntry, pullState.modelName, startPolling, value])

    // Display: when open show search query; when closed show selected value
    const inputValue = open ? search : value
    const statusAnchorText = inputValue || pullState.modelName
    const hasInlineStatus = isPulling || pullState.status === 'ready' || pullState.status === 'error'

    const updateStatusOffset = useCallback(() => {
        if (!hasInlineStatus || !statusAnchorText || !anchorRef.current || !inputRef.current || typeof window === 'undefined') {
            setStatusOffset(null)
            return
        }

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) {
            setStatusOffset(null)
            return
        }

        const wrapperRect = anchorRef.current.getBoundingClientRect()
        const inputRect = inputRef.current.getBoundingClientRect()
        const computedStyle = window.getComputedStyle(inputRef.current)
        const indicatorSize = 22
        const gap = 8

        context.font = computedStyle.font
        const textWidth = context.measureText(statusAnchorText).width
        const baseLeft = inputRect.left - wrapperRect.left
        const minLeft = baseLeft + 2
        const maxLeft = wrapperRect.width - indicatorSize - 18
        const nextOffset = Math.min(Math.max(minLeft + textWidth + gap, minLeft), maxLeft)

        setStatusOffset(nextOffset)
    }, [hasInlineStatus, statusAnchorText])

    useEffect(() => {
        updateStatusOffset()
    }, [updateStatusOffset])

    useEffect(() => {
        if (!hasInlineStatus || typeof window === 'undefined') return undefined

        const handleResize = () => updateStatusOffset()

        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
        }
    }, [hasInlineStatus, updateStatusOffset])

    const renderInlineStatus = () => {
        if (!hasInlineStatus || statusOffset === null) return null

        const indicatorSx = {
            position: 'absolute',
            left: statusOffset,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            zIndex: 2
        }

        if (isPulling) {
            return (
                <Box sx={indicatorSx}>
                    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                        <CircularProgress
                            variant={progressValue !== null ? 'determinate' : 'indeterminate'}
                            value={progressValue ?? undefined}
                            size={22}
                            color='primary'
                        />
                        {progressValue !== null && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <Typography
                                    sx={{ fontSize: 7, lineHeight: 1, fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'primary.main' }}
                                >
                                    {`${Math.round(progressValue)}%`}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Box>
            )
        }

        if (pullState.status === 'ready') {
            return (
                <Box
                    sx={{
                        ...indicatorSx,
                        opacity: isReadyFading ? 0 : 1,
                        transition: 'opacity 0.5s ease'
                    }}
                >
                    <Box
                        sx={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'success.light',
                            color: 'success.main'
                        }}
                    >
                        <IconCheck size={13} />
                    </Box>
                </Box>
            )
        }

        if (pullState.status === 'error') {
            return (
                <Tooltip title={pullState.error || 'Pull failed.'} placement='top' arrow>
                    <Box sx={{ ...indicatorSx, cursor: 'help' }}>
                        <Box
                            sx={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: 'error.light',
                                color: 'error.main'
                            }}
                        >
                            <IconAlertCircle size={13} />
                        </Box>
                    </Box>
                </Tooltip>
            )
        }

        return null
    }

    return (
        <ClickAwayListener onClickAway={handleClickAway}>
            <Box ref={anchorRef} sx={{ position: 'relative' }}>
                <TextField
                    size='small'
                    fullWidth
                    label={label}
                    value={inputValue}
                    placeholder={open ? 'Search or enter model name…' : ''}
                    onFocus={handleOpen}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={disabled}
                    inputRef={inputRef}
                    InputProps={{
                        sx: hasInlineStatus
                            ? {
                                  '& input': {
                                      pr: 5
                                  }
                              }
                            : undefined,
                        startAdornment: (
                            <InputAdornment position='start'>
                                <IconSearch size={15} style={{ opacity: 0.5 }} />
                            </InputAdornment>
                        )
                    }}
                />
                {renderInlineStatus()}

                {open && (
                    <Paper
                        elevation={8}
                        sx={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            mt: 0.5,
                            zIndex: 1400,
                            maxHeight: 300,
                            overflow: 'auto',
                            border: '1px solid',
                            borderColor: 'divider'
                        }}
                    >
                        <List dense disablePadding>
                            {filteredModels.length === 0 && !showPull && (
                                <Box sx={{ px: 2, py: 1.5 }}>
                                    <Typography variant='body2' color='text.secondary'>
                                        No models available.
                                    </Typography>
                                </Box>
                            )}

                            {filteredModels.map((m) => {
                                const name = m.name || m.id || ''
                                return (
                                    <ListItemButton
                                        key={name}
                                        selected={value === name}
                                        onClick={() => handleSelect(name)}
                                        sx={{ py: 1, px: 2 }}
                                    >
                                        <Typography
                                            variant='body2'
                                            sx={{ fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}
                                        >
                                            {name}
                                        </Typography>
                                    </ListItemButton>
                                )
                            })}
                        </List>

                        {/* Pull new model action */}
                        {showPull && (
                            <>
                                <Divider />
                                <ListItemButton
                                    onClick={handlePull}
                                    disabled={isPulling}
                                    sx={{
                                        py: 1.5,
                                        px: 2,
                                        gap: 1.5,
                                        color: 'primary.main',
                                        '&.Mui-disabled': { opacity: 0.6 }
                                    }}
                                >
                                    {isPulling ? (
                                        <CircularProgress size={16} color='inherit' />
                                    ) : (
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: 28,
                                                height: 28,
                                                borderRadius: 1,
                                                bgcolor: 'primary.main',
                                                color: 'primary.contrastText',
                                                flexShrink: 0
                                            }}
                                        >
                                            <IconDownload size={15} />
                                        </Box>
                                    )}
                                    <Box>
                                        <Typography variant='body2' fontWeight={600}>
                                            {alreadyInList ? 'Re-pull Model' : 'Pull New Model'}
                                        </Typography>
                                        <Typography
                                            variant='caption'
                                            sx={{
                                                fontFamily: 'monospace',
                                                fontStyle: 'italic',
                                                color: 'text.secondary'
                                            }}
                                        >
                                            {searchTag}
                                        </Typography>
                                    </Box>
                                </ListItemButton>
                            </>
                        )}
                    </Paper>
                )}
            </Box>
        </ClickAwayListener>
    )
}

ModelSelect.propTypes = {
    models: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string,
            id: PropTypes.string
        })
    ).isRequired,
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    onModelsRefresh: PropTypes.func,
    disabled: PropTypes.bool,
    label: PropTypes.string
}

ModelSelect.defaultProps = {
    onModelsRefresh: null,
    disabled: false,
    label: 'Model'
}

export default ModelSelect
