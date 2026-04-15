import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

// material-ui
import {
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormGroup,
    FormLabel,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Typography
} from '@mui/material'
import { useTheme } from '@mui/material/styles'

// icons
import { IconX } from '@tabler/icons-react'

// API
import evaluationApi from '@/api/evaluation'

const METRICS = [
    'AnswerRelevancy',
    'Faithfulness',
    'ContextualPrecision',
    'ContextualRecall',
    'ContextualRelevancy',
    'Hallucination'
]

const CreateRunModal = ({ open, onClose, onRunCreated }) => {
    const theme = useTheme()

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
                setSandboxes(sbRes.data || [])
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
            const res = await evaluationApi.createRun({
                sandbox_id: sandboxId,
                dataset_id: datasetId,
                judge_model: judgeModel,
                metrics: selectedMetrics
            })
            onRunCreated && onRunCreated(res.data)
            handleClose()
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to create run.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleClose = () => {
        setSandboxId('')
        setDatasetId('')
        setJudgeModel('')
        setSelectedMetrics(['AnswerRelevancy', 'Faithfulness'])
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
