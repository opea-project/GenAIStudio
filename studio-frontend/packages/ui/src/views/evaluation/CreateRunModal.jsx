import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

// material-ui
import {
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    FormGroup,
    FormLabel,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography
} from '@mui/material'

// icons
import { IconX, IconChevronDown, IconChevronUp } from '@tabler/icons-react'

// API
import evaluationApi from '@/api/evaluation'
import chatflowsApi from '@/api/chatflows'

const METRICS = [
    'AnswerRelevancy',
    'Faithfulness',
    'Hallucination'
]

const sanitizeWorkflowNodes = (nodes = []) =>
    nodes
        .map((node) => {
            const inputs = Object.fromEntries(
                Object.entries(node?.data?.inputs || {}).filter(
                    ([, value]) =>
                        value !== '' &&
                        value !== null &&
                        value !== undefined &&
                        !String(value).startsWith('{{')
                )
            )

            return {
                id: node?.id,
                data: {
                    label: node?.data?.label,
                    inputs,
                    inputParams: (node?.data?.inputParams || []).map((param) => ({
                        name: param?.name,
                        label: param?.label
                    }))
                }
            }
        })
        .filter((node) => Object.keys(node?.data?.inputs || {}).length > 0)

const hasDataprepNode = (nodes = []) =>
    nodes.some((node) => String(node?.data?.name || '').startsWith('opea_service@prepare_doc_redis_prep'))

const buildRunName = ({ sandboxId, datasetId, modelName }) => {
    const sandboxLabel = sandboxId || 'sandbox'
    const datasetLabel = datasetId || 'dataset'
    const modelLabel = modelName || 'model'

    return `${sandboxLabel} · dataset ${datasetLabel} · ${modelLabel}`
}

const createConfigurationSnapshot = async ({ sandboxId, systemPrompt, temperature, maxTokens }) => {
    const snapshot = {
        captured_at: new Date().toISOString(),
        request: {
            system_prompt: systemPrompt,
            temperature,
            max_tokens: maxTokens,
            request_model: 'NA'
        },
        workflow_nodes: [],
        data_management: {
            status: 'idle',
            files: [],
            error: null
        }
    }

    const chatflowId = String(sandboxId || '').replace(/^sandbox-/, '')

    if (!chatflowId) {
        snapshot.data_management.status = 'not-applicable'
        return snapshot
    }

    try {
        const cfRes = await chatflowsApi.getSpecificChatflow(chatflowId)
        const flowData = cfRes.data?.flowData
        const parsed = typeof flowData === 'string' ? JSON.parse(flowData) : flowData
        const nodes = parsed?.nodes || []

        snapshot.workflow_nodes = sanitizeWorkflowNodes(nodes)

        if (!hasDataprepNode(nodes)) {
            snapshot.data_management.status = 'not-applicable'
            return snapshot
        }

        try {
            const filesRes = await evaluationApi.getSandboxDataManagementFiles({
                sandbox_id: sandboxId
            })
            snapshot.data_management.status = 'done'
            snapshot.data_management.files = Array.isArray(filesRes.data?.files) ? filesRes.data.files : []
        } catch (filesErr) {
            snapshot.data_management.status = 'error'
            snapshot.data_management.error =
                filesErr?.response?.data?.message ||
                filesErr?.response?.data?.detail ||
                filesErr?.message ||
                'Unknown error'
        }
    } catch (chatflowErr) {
        snapshot.data_management.status = 'error'
        snapshot.data_management.error =
            chatflowErr?.response?.data?.message ||
            chatflowErr?.response?.data?.detail ||
            chatflowErr?.message ||
            'Failed to load workflow configuration'
    }

    return snapshot
}

const CreateRunModal = ({ open, onClose, onRunCreated }) => {
    const [sandboxes, setSandboxes] = useState([])
    const [datasets, setDatasets] = useState([])
    const [models, setModels] = useState([])
    const [loadingOptions, setLoadingOptions] = useState(false)

    const [sandboxId, setSandboxId] = useState('')
    const [datasetId, setDatasetId] = useState('')
    const [judgeModel, setJudgeModel] = useState('')
    const [selectedMetrics, setSelectedMetrics] = useState(['AnswerRelevancy', 'Faithfulness'])
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant')
    const [temperature, setTemperature] = useState(0.4)
    const [maxTokens, setMaxTokens] = useState(100)

    useEffect(() => {
        if (!open) return
        setLoadingOptions(true)
        setError('')
        Promise.all([
            evaluationApi.getSandboxes(),
            evaluationApi.getDatasets(),
            evaluationApi.getModels()
        ])
            .then(([sbRes, dsRes, mdRes]) => {
                setSandboxes(sbRes.data?.sandboxes || [])
                setDatasets(dsRes.data || [])
                setModels(mdRes.data || [])
            })
            .catch(() => setError('Failed to load options.'))
            .finally(() => setLoadingOptions(false))
    }, [open])

    const handleMetricToggle = (metric) => {
        setSelectedMetrics((prev) =>
            prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]
        )
    }

    const handleSubmit = async () => {
        if (!sandboxId || !datasetId || !judgeModel || selectedMetrics.length === 0) {
            setError('Please fill in all fields and select at least one metric.')
            return
        }
        setSubmitting(true)
        setError('')
        try {
            const parsedTemperature = parseFloat(temperature)
            const parsedMaxTokens = parseInt(maxTokens, 10)
            const configurationSnapshot = await createConfigurationSnapshot({
                sandboxId,
                systemPrompt,
                temperature: parsedTemperature,
                maxTokens: parsedMaxTokens
            })

            const res = await evaluationApi.createRun({
                name: buildRunName({
                    sandboxId,
                    datasetId,
                    modelName: judgeModel
                }),
                sandbox_id: sandboxId,
                dataset_id: datasetId,
                model_name: judgeModel,
                metrics: selectedMetrics,
                system_prompt: systemPrompt,
                temperature: parsedTemperature,
                max_tokens: parsedMaxTokens,
                configuration_snapshot: configurationSnapshot
            })
            onRunCreated && onRunCreated(res.data)
            handleClose()
        } catch (err) {
            const detail = err?.response?.data?.detail

            if (Array.isArray(detail) && detail.length > 0) {
                setError(detail.map((item) => item.msg).join(' '))
            } else {
                setError(err?.response?.data?.message || err?.response?.data?.detail || 'Failed to create run.')
            }
        } finally {
            setSubmitting(false)
        }
    }

    const handleClose = () => {
        setSandboxId('')
        setDatasetId('')
        setJudgeModel('')
        setSelectedMetrics(['AnswerRelevancy', 'Faithfulness'])
        setShowAdvanced(false)
        setSystemPrompt('You are a helpful assistant')
        setTemperature(0.4)
        setMaxTokens(100)
        setError('')
        onClose()
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant='h4'>New Evaluation Run</Typography>
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
                    <Stack spacing={3} sx={{ pt: 1 }}>
                        {/* Sandbox */}
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

                        {/* Dataset */}
                        <FormControl fullWidth size='small'>
                            <InputLabel>Dataset</InputLabel>
                            <Select
                                label='Dataset'
                                value={datasetId}
                                onChange={(e) => setDatasetId(e.target.value)}
                            >
                                {datasets.map((ds) => (
                                    <MenuItem key={ds.id} value={ds.id}>
                                        {ds.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Judge Model */}
                        <FormControl fullWidth size='small'>
                            <InputLabel>Judge Model</InputLabel>
                            <Select
                                label='Judge Model'
                                value={judgeModel}
                                onChange={(e) => setJudgeModel(e.target.value)}
                            >
                                {models.map((m) => (
                                    <MenuItem key={m.id || m.name} value={m.id || m.name}>
                                        {m.name || m.id}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Metrics */}
                        <FormControl component='fieldset'>
                            <FormLabel component='legend' sx={{ mb: 1, fontSize: '0.875rem' }}>
                                Metrics
                            </FormLabel>
                            <FormGroup row>
                                {METRICS.map((metric) => (
                                    <FormControlLabel
                                        key={metric}
                                        control={
                                            <Checkbox
                                                size='small'
                                                checked={selectedMetrics.includes(metric)}
                                                onChange={() => handleMetricToggle(metric)}
                                            />
                                        }
                                        label={<Typography variant='body2'>{metric}</Typography>}
                                        sx={{ width: '50%' }}
                                    />
                                ))}
                            </FormGroup>
                        </FormControl>

                        {/* Advanced settings toggle */}
                        <Box>
                            <Button
                                size='small'
                                variant='text'
                                onClick={() => setShowAdvanced((v) => !v)}
                                endIcon={showAdvanced ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                                sx={{ px: 0, color: 'text.secondary', textTransform: 'none' }}
                            >
                                Advanced settings
                            </Button>
                            <Collapse in={showAdvanced}>
                                <Stack spacing={2} sx={{ mt: 2 }}>
                                    <Divider />
                                    <TextField
                                        label='System Prompt'
                                        size='small'
                                        fullWidth
                                        multiline
                                        minRows={2}
                                        value={systemPrompt}
                                        onChange={(e) => setSystemPrompt(e.target.value)}
                                        helperText='System message sent to the app-backend for every question.'
                                    />
                                    <Stack direction='row' spacing={2}>
                                        <TextField
                                            label='Temperature'
                                            size='small'
                                            type='number'
                                            value={temperature}
                                            onChange={(e) => setTemperature(e.target.value)}
                                            inputProps={{ min: 0, max: 2, step: 0.05 }}
                                            sx={{ flex: 1 }}
                                        />
                                        <TextField
                                            label='Max Tokens'
                                            size='small'
                                            type='number'
                                            value={maxTokens}
                                            onChange={(e) => setMaxTokens(e.target.value)}
                                            inputProps={{ min: 1, step: 1 }}
                                            InputProps={{
                                                endAdornment: <InputAdornment position='end'>tok</InputAdornment>
                                            }}
                                            sx={{ flex: 1 }}
                                        />
                                    </Stack>
                                </Stack>
                            </Collapse>
                        </Box>

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
                    {submitting ? 'Submitting…' : 'Start Run'}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

CreateRunModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onRunCreated: PropTypes.func
}

export default CreateRunModal
