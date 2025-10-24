import { useState } from 'react'
import PropTypes from 'prop-types'

// material-ui
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Stack,
    Checkbox,
    FormControlLabel,
    IconButton,
    CircularProgress,
    Grid
} from '@mui/material'
import Autocomplete from '@mui/material/Autocomplete'
import { useTheme } from '@mui/material/styles'

// icons
import { IconX } from '@tabler/icons-react'

// components
import FileUploadArea from './FileUploadArea'

// API
import finetuningApi from '@/api/finetuning'

const FinetuningJobModal = ({ open, onClose, onJobCreated }) => {
    const theme = useTheme()
    
    const [formData, setFormData] = useState({
        baseModel: '',
        trainingDataset: null,
        hf_token: '',
        // OpenAI standard parameters
        openai_params: {
            n_epochs: 3,
            batch_size: 16,
            learning_rate_multiplier: 1.0,
            prompt_loss_weight: 0.01
        },
        // Extended configuration
        general: {
            task: 'instruction_tuning',
            output_dir: './tmp',
            report_to: 'none',
            save_strategy: 'no',
            enable_gradient_checkpointing: false,
            trust_remote_code: false
        },
        dataset: {
            max_length: 512,
            validation_split_percentage: 5,
            padding_side: 'right',
            truncation_side: 'right',
            max_source_length: 384,
            max_prompt_length: 512,
            data_preprocess_type: 'neural_chat',
            mask_input: true,
            mask_response: true
        },
        training: {
            optimizer: 'adamw_torch',
            epochs: 3,
            learning_rate: 5.0e-5,
            lr_scheduler: 'linear',
            weight_decay: 0.0,
            device: 'cpu',
            mixed_precision: 'no',
            gradient_accumulation_steps: 1,
            logging_steps: 10,
            accelerate_mode: 'DDP',
            hpu_execution_mode: 'lazy',
            num_training_workers: 1
        },
        lora: {
            r: 8,
            lora_alpha: 32,
            lora_dropout: 0.1,
            task_type: 'CAUSAL_LM'
        }
    })

    const [errors, setErrors] = useState({})
    const [isSubmitting, setIsSubmitting] = useState(false)

    const [loraEnabled, setLoraEnabled] = useState(false)
    const [datasetEnabled, setDatasetEnabled] = useState(true)
    const [generalEnabled, setGeneralEnabled] = useState(true)
    const [trainingEnabled, setTrainingEnabled] = useState(true)


    const baseModels = [
        'meta-llama/Llama-2-7b-chat-hf',
        'meta-llama/Llama-2-7b-hf',
        'meta-llama/Llama-2-13b-hf',
        'BAAI/bge-reranker-large',
        'BAAI/bge-base-en-v1.5',
        'Qwen/Qwen2.5-3B',
        'Qwen/Qwen2.5-7B'
    ]
    
    const taskTypes = [
        { value: 'instruction_tuning', label: 'Instruction Tuning' },
        { value: 'rerank', label: 'Reranking' },
        { value: 'embedding', label: 'Embedding' },
        { value: 'pretraining', label: 'Pretraining' },
        { value: 'dpo', label: 'Direct Preference Optimization (DPO)' },
        { value: 'reasoning', label: 'Reasoning' }
    ]

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }))
        
        // Clear error for this field
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: null
            }))
        }
    }

    const handleOpenAIParamChange = (param, value) => {
        setFormData(prev => ({
            ...prev,
            openai_params: {
                ...prev.openai_params,
                [param]: value
            }
        }))
    }

    const handleConfigChange = (section, param, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [param]: value
            }
        }))
    }

    // When a file is selected in FileUploadArea, just store the File object locally.
    // The actual upload to the server will happen when the user clicks Create Job.
    const handleFileUpload = (fileType, file) => {
        if (!file) {
            setFormData(prev => ({
                ...prev,
                [fileType]: null
            }))
            return
        }

        // Store the raw File object and its name; do not upload now
        const fileEntry = {
            file,
            name: file.name
        }

        setFormData(prev => ({
            ...prev,
            [fileType]: fileEntry
        }))

        // Clear any previous error for this field
        if (errors[fileType]) {
            setErrors(prev => ({
                ...prev,
                [fileType]: null
            }))
        }
    }

    const validateForm = () => {
        const newErrors = {}

        // Base validation
        if (!formData.baseModel) {
            newErrors.baseModel = 'Base model is required'
        }

        if (!formData.trainingDataset) {
            newErrors.trainingDataset = 'Training dataset is required'
        }

        // OpenAI parameters validation (only when training enabled)
        if (trainingEnabled) {
            if (formData.openai_params.learning_rate_multiplier <= 0) {
                newErrors.learning_rate_multiplier = 'Learning rate multiplier must be greater than 0'
            }

            if (formData.openai_params.batch_size <= 0) {
                newErrors.batch_size = 'Batch size must be greater than 0'
            }

            if (formData.openai_params.n_epochs <= 0) {
                newErrors.n_epochs = 'Number of epochs must be greater than 0'
            }
        }

        // Training parameters validation (only when enabled)
        if (trainingEnabled) {
            if (formData.training.learning_rate <= 0) {
                newErrors.learning_rate = 'Learning rate must be greater than 0'
            }

            if (formData.training.epochs <= 0) {
                newErrors.epochs = 'Epochs must be greater than 0'
            }

            if (formData.training.logging_steps <= 0) {
                newErrors.logging_steps = 'Logging steps must be greater than 0'
            }
        }

        // General validation (only when enabled)
        if (generalEnabled) {
            if (!formData.general.output_dir) {
                newErrors.output_dir = 'Output directory is required'
            }
        }

        // Dataset validation (only when enabled)
        if (datasetEnabled) {
            if (!formData.dataset) {
                newErrors.dataset = 'Dataset configuration is required'
            } else {
                if (formData.dataset.max_length <= 0) {
                    newErrors.dataset_max_length = 'Max length must be greater than 0'
                }
            }
        }

        // LoRA parameters validation (only when enabled)
        if (loraEnabled) {
            if (formData.lora.r <= 0) {
                newErrors.lora_r = 'LoRA rank must be greater than 0'
            }

            if (formData.lora.lora_alpha <= 0) {
                newErrors.lora_alpha = 'LoRA alpha must be greater than 0'
            }

            if (formData.lora.lora_dropout < 0 || formData.lora.lora_dropout > 1) {
                newErrors.lora_dropout = 'LoRA dropout must be between 0 and 1'
            }
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async () => {
        if (!validateForm()) {
            return
        }

        setIsSubmitting(true)
        
        try {
            // Create the job configuration payload
            // Build General object and set lora_config based on the LoRA checkbox
            const generalPayload = { ...formData.general }
            // If user enabled LoRA, include the object; otherwise send explicit null
            generalPayload.lora_config = loraEnabled ? formData.lora : null

            // If the user selected a file but hasn't uploaded it yet, upload it now
            let trainingFileName = formData.trainingDataset?.uploadedName || null
            if (formData.trainingDataset && formData.trainingDataset.file) {
                try {
                    setIsSubmitting(true)
                    const uploadResp = await finetuningApi.uploadFile(formData.trainingDataset.file, 'fine-tune', () => {})
                    trainingFileName = uploadResp.data?.filename || null
                } catch (err) {
                    console.error('Error uploading training file before job creation:', err)
                    setErrors(prev => ({ ...prev, trainingDataset: 'Failed to upload training file: ' + (err.message || 'Unknown') }))
                    setIsSubmitting(false)
                    return
                }
            }

            // Build payload and only include sections that are enabled
            const jobPayload = {
                model: formData.baseModel,
                training_file: trainingFileName
            }

            if (generalEnabled) {
                // If user enabled LoRA, include the object; otherwise send explicit null inside General
                const gen = { ...formData.general }
                gen.lora_config = loraEnabled ? formData.lora : null
                // Ensure config exists and place hf_token if provided
                gen.config = gen.config || {}
                if (formData.hf_token) {
                    gen.config.token = formData.hf_token
                }
                jobPayload.General = gen
                jobPayload.task = gen.task || 'instruction_tuning'
            } else {
                jobPayload.task = 'instruction_tuning'
                // If HF token was provided while General is disabled, create minimal General with config.token
                if (formData.hf_token) {
                    jobPayload.General = { config: { token: formData.hf_token } }
                }
            }

            if (datasetEnabled) {
                jobPayload.Dataset = {
                    max_length: formData.dataset.max_length,
                    // fallback keys if some are undefined
                    query_max_len: formData.dataset.query_max_len,
                    passage_max_len: formData.dataset.passage_max_len,
                    padding: formData.dataset.padding_side
                }
            }

            if (trainingEnabled) {
                jobPayload.Training = {
                    epochs: formData.training.epochs,
                    batch_size: formData.openai_params.batch_size,
                    gradient_accumulation_steps: formData.training.gradient_accumulation_steps
                }
            }

            // Call the actual API
            const response = await finetuningApi.createJob(jobPayload)
            
            // Create job object from response
            const newJob = {
                id: response.data?.id || response.data?.fine_tuning_job_id || Date.now().toString(),
                status: response.data?.status || 'pending',
                model: formData.baseModel,
                task: jobPayload.task || (loraEnabled ? formData.lora?.task_type : 'instruction_tuning'),
                dataset: formData.trainingDataset?.suffixedName || formData.trainingDataset?.name || 'Unknown',
                progress: '0%',
                createdDate: response.data?.created_at || new Date().toISOString(),
                training_file: jobPayload.training_file
            }

            // Mirror payload sections in the newJob object for UI
            if (trainingEnabled) {
                newJob.openai_params = formData.openai_params
                newJob.training = formData.training
            }

            if (generalEnabled) {
                newJob.general = formData.general
                if (formData.hf_token) {
                    newJob.general = { ...newJob.general, config: { ...(newJob.general.config || {}), token: formData.hf_token } }
                }
            }

            if (datasetEnabled) {
                newJob.dataset_config = formData.dataset
            }

            onJobCreated(newJob)
            handleClose()
        } catch (error) {
            console.error('Error creating fine-tuning job:', error)
            // TODO: Show error notification
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        setFormData({
            baseModel: '',
            trainingDataset: null,
            // OpenAI standard parameters
            openai_params: {
                n_epochs: 3,
                batch_size: 16,
                learning_rate_multiplier: 1.0,
                prompt_loss_weight: 0.01
            },
            // Extended configuration
            general: {
                task: 'instruction_tuning',
                output_dir: './tmp',
                report_to: 'none',
                save_strategy: 'no',
                enable_gradient_checkpointing: false,
                trust_remote_code: false
            },
            dataset: {
                max_length: 512,
                validation_split_percentage: 5,
                padding_side: 'right',
                truncation_side: 'right',
                max_source_length: 384,
                max_prompt_length: 512,
                data_preprocess_type: 'neural_chat',
                mask_input: true,
                mask_response: true
            },
            training: {
                optimizer: 'adamw_torch',
                epochs: 3,
                learning_rate: 5.0e-5,
                lr_scheduler: 'linear',
                weight_decay: 0.0,
                device: 'cpu',
                mixed_precision: 'no',
                gradient_accumulation_steps: 1,
                logging_steps: 10,
                accelerate_mode: 'DDP',
                hpu_execution_mode: 'lazy',
                num_training_workers: 1
            }
        })
    // reset token as well
    setFormData(prev => ({ ...prev, hf_token: '' }))
        setLoraEnabled(false)
        setFormData(prev => ({ ...prev, lora: { r: 8, lora_alpha: 32, lora_dropout: 0.1, task_type: 'CAUSAL_LM' } }))
        setErrors({})
        setIsSubmitting(false)
        onClose()
    }

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    maxHeight: '90vh',
                    height: '90vh'
                }
            }}
        >
            <DialogTitle sx={{ pb: 1 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="h5" fontWeight={600}>
                        Create New Fine-tuning Job
                    </Typography>
                    <IconButton onClick={handleClose} size="medium">
                        <IconX />
                    </IconButton>
                </Stack>
            </DialogTitle>

            <DialogContent dividers sx={{ p: 3, overflow: 'auto', minHeight: 0 }}>
                <Grid container spacing={3} sx={{ height: '100%', alignItems: 'stretch' }}>
                    {/* Top Left Quadrant: Model Configuration and Dataset Configuration */}
                    <Grid item xs={12} md={6}>
                        <Stack spacing={3} sx={{ height: '100%' }}>
                            {/* Model Configuration */}
                            <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, backgroundColor: 'background.paper' }}>
                                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                                    Model Configuration*
                                </Typography>
                                <Autocomplete
                                    freeSolo
                                    fullWidth
                                    options={baseModels}
                                    value={formData.baseModel}
                                    onChange={(event, newValue) => handleInputChange('baseModel', newValue || '')}
                                    onInputChange={(event, newInputValue) => handleInputChange('baseModel', newInputValue)}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Base Model"
                                            required
                                            error={!!errors.baseModel}
                                            size="medium"
                                            sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}
                                        />
                                    )}
                                />
                                {errors.baseModel && (
                                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1 }}>
                                        {errors.baseModel}
                                    </Typography>
                                )}
                                <TextField
                                    label="HF Token (optional)"
                                    type="password"
                                    value={formData.hf_token}
                                    onChange={(e) => handleInputChange('hf_token', e.target.value)}
                                    fullWidth
                                    size="medium"
                                    sx={{ mt: 2 }}
                                />
                            </Box>

                            {/* Dataset Configuration */}
                            <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, backgroundColor: 'background.paper' }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                        Dataset Configuration
                                    </Typography>
                                    <FormControlLabel control={<Checkbox checked={datasetEnabled} onChange={(e) => setDatasetEnabled(e.target.checked)} />} label="Enable" />
                                </Stack>
                                <Stack alignItems="center">
                                    <Grid container spacing={2} justifyContent="center">
                                        <Grid item xs={6}>
                                            <TextField
                                                label="Max Length"
                                                type="number"
                                                value={formData.dataset.max_length}
                                                onChange={(e) => handleConfigChange('dataset', 'max_length', parseInt(e.target.value))}
                                                inputProps={{ min: 128, max: 4096, step: 1 }}
                                                size="medium"
                                                fullWidth
                                                sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}
                                                disabled={!datasetEnabled}
                                            />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="Max Source Length"
                                                type="number"
                                                value={formData.dataset.max_source_length}
                                                onChange={(e) => handleConfigChange('dataset', 'max_source_length', parseInt(e.target.value))}
                                                inputProps={{ min: 128, max: 2048, step: 1 }}
                                                size="medium"
                                                fullWidth
                                                sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}
                                                disabled={!datasetEnabled}
                                            />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <FormControl fullWidth size="medium" sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
                                                <InputLabel>Preprocess Type</InputLabel>
                                                <Select
                                                    value={formData.dataset.data_preprocess_type}
                                                    onChange={(e) => handleConfigChange('dataset', 'data_preprocess_type', e.target.value)}
                                                    label="Preprocess Type"
                                                    disabled={!datasetEnabled}
                                                >
                                                    <MenuItem value="neural_chat">Neural Chat</MenuItem>
                                                    <MenuItem value="general">General</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="Validation Split %"
                                                type="number"
                                                value={formData.dataset.validation_split_percentage}
                                                onChange={(e) => handleConfigChange('dataset', 'validation_split_percentage', parseInt(e.target.value))}
                                                inputProps={{ min: 1, max: 50, step: 1 }}
                                                size="medium"
                                                fullWidth
                                                sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}
                                                disabled={!datasetEnabled}
                                            />
                                        </Grid>
                                    </Grid>
                                </Stack>
                            </Box>
                        </Stack>
                    </Grid>

                    {/* Top Right Quadrant: Training Dataset Upload */}
                    <Grid item xs={12} md={6}>
                        <Box sx={{ height: '100%', p: 2, border: 1, borderColor: 'divider', borderRadius: 1, backgroundColor: 'background.paper' }}>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                                Training Dataset *
                            </Typography>
                            <Box sx={{ height: 'calc(100% - 48px)' }}>
                                <FileUploadArea
                                    onFileUpload={(file) => handleFileUpload('trainingDataset', file)}
                                    acceptedTypes={['.json', '.jsonl', '.csv']}
                                    maxSizeMB={100}
                                    error={errors.trainingDataset}
                                />
                            </Box>
                        </Box>
                    </Grid>

                    {/* Bottom Left Quadrant: General Configuration + LoRA */}
                    <Grid item xs={12} md={6}>
                        <Box sx={{ height: '100%', p: 3, border: 1, borderColor: 'divider', borderRadius: 1, backgroundColor: 'background.paper' }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                    General Configuration
                                </Typography>
                                <FormControlLabel control={<Checkbox checked={generalEnabled} onChange={(e) => setGeneralEnabled(e.target.checked)} />} label="Enable" />
                            </Stack>
                            <Stack spacing={2.5}>
                                    <FormControl fullWidth size="medium" sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
                                        <InputLabel>Task Type</InputLabel>
                                        <Select
                                            value={formData.general.task}
                                            onChange={(e) => handleConfigChange('general', 'task', e.target.value)}
                                            label="Task Type"
                                            disabled={!generalEnabled}
                                        >
                                            <MenuItem value="instruction_tuning">Instruction Tuning</MenuItem>
                                            <MenuItem value="pretraining">Pretraining</MenuItem>
                                            <MenuItem value="dpo">DPO</MenuItem>
                                            <MenuItem value="rerank">Rerank</MenuItem>
                                            <MenuItem value="embedding">Embedding</MenuItem>
                                            <MenuItem value="reasoning">Reasoning</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <FormControl fullWidth size="medium" sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
                                        <InputLabel>Report To</InputLabel>
                                        <Select
                                            value={formData.general.report_to}
                                            onChange={(e) => handleConfigChange('general', 'report_to', e.target.value)}
                                            label="Report To"
                                            disabled={!generalEnabled}
                                        >
                                            <MenuItem value="none">None</MenuItem>
                                            <MenuItem value="tensorboard">TensorBoard</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <TextField
                                        label="Output Directory"
                                        value={formData.general.output_dir}
                                        onChange={(e) => handleConfigChange('general', 'output_dir', e.target.value)}
                                        fullWidth
                                        size="medium"
                                        disabled={!generalEnabled}
                                    />
                                    
                                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                    <Typography variant="subtitle1">LoRA Configuration</Typography>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={loraEnabled}
                                                onChange={(e) => setLoraEnabled(e.target.checked)}
                                            />
                                        }
                                        label="Enable LoRA"
                                    />
                                </Stack>
                                <Stack alignItems="center">
                                    <Grid container spacing={2} justifyContent="center">
                                        <Grid item xs={4}>
                                            <TextField
                                                label="LoRA Rank (r)"
                                                type="number"
                                                value={formData.lora.r}
                                                onChange={(e) => handleConfigChange('lora', 'r', parseInt(e.target.value))}
                                                error={!!errors.lora_r}
                                                inputProps={{ min: 1, max: 128, step: 1 }}
                                                size="medium"
                                                fullWidth
                                                disabled={!loraEnabled}
                                            />
                                        </Grid>
                                        <Grid item xs={4}>
                                            <TextField
                                                label="LoRA Alpha"
                                                type="number"
                                                value={formData.lora.lora_alpha}
                                                onChange={(e) => handleConfigChange('lora', 'lora_alpha', parseInt(e.target.value))}
                                                error={!!errors.lora_alpha}
                                                inputProps={{ min: 1, max: 256, step: 1 }}
                                                size="medium"
                                                fullWidth
                                                disabled={!loraEnabled}
                                            />
                                        </Grid>
                                        <Grid item xs={4}>
                                            <TextField
                                                label="LoRA Dropout"
                                                type="number"
                                                value={formData.lora.lora_dropout}
                                                onChange={(e) => handleConfigChange('lora', 'lora_dropout', parseFloat(e.target.value))}
                                                error={!!errors.lora_dropout}
                                                inputProps={{ min: 0, max: 1, step: 0.01 }}
                                                size="medium"
                                                fullWidth
                                                disabled={!loraEnabled}
                                            />
                                        </Grid>
                                    </Grid>
                                </Stack>
                            </Stack>
                        </Box>
                    </Grid>

                    {/* Bottom Right Quadrant: Training Configuration + OpenAI */}
                    <Grid item xs={12} md={6}>
                            <Box sx={{ height: '100%', p: 3, border: 1, borderColor: 'divider', borderRadius: 1, backgroundColor: 'background.paper' }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                        Training Configuration
                                    </Typography>
                                    <FormControlLabel control={<Checkbox checked={trainingEnabled} onChange={(e) => setTrainingEnabled(e.target.checked)} />} label="Enable" />
                                </Stack>
                            <Stack spacing={2.5}>
                                <Stack alignItems="center">
                                    <Grid container spacing={2} justifyContent="center">
                                        <Grid item xs={6}>
                                            <TextField
                                                label="Epochs"
                                                    type="number"
                                                    value={formData.training.epochs}
                                                    onChange={(e) => handleConfigChange('training', 'epochs', parseInt(e.target.value))}
                                                    error={!!errors.epochs}
                                                    inputProps={{ min: 1, max: 50, step: 1 }}
                                                    size="medium"
                                                fullWidth
                                                sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}
                                                    disabled={!trainingEnabled}
                                            />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="Batch Size"
                                                    type="number"
                                                    value={formData.openai_params.batch_size}
                                                    onChange={(e) => handleOpenAIParamChange('batch_size', parseInt(e.target.value))}
                                                    error={!!errors.batch_size}
                                                    inputProps={{ min: 1, max: 256, step: 1 }}
                                                    size="medium"
                                                fullWidth
                                                sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}
                                                disabled={!trainingEnabled}
                                            />
                                        </Grid>
                                    </Grid>
                                </Stack>
                                <TextField
                                    label="Learning Rate"
                                    type="number"
                                    value={formData.training.learning_rate}
                                    onChange={(e) => handleConfigChange('training', 'learning_rate', parseFloat(e.target.value))}
                                    error={!!errors.learning_rate}
                                    inputProps={{ min: 0.00001, max: 0.01, step: 0.00001 }}
                                    size="medium"
                                    fullWidth
                                    sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}
                                    disabled={!trainingEnabled}
                                />
                                <FormControl fullWidth size="medium" sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
                                        <InputLabel>Optimizer</InputLabel>
                                        <Select
                                                value={formData.training.optimizer}
                                                onChange={(e) => handleConfigChange('training', 'optimizer', e.target.value)}
                                            label="Optimizer"
                                                disabled={!trainingEnabled}
                                        >
                                            <MenuItem value="adamw_torch">AdamW Torch</MenuItem>
                                            <MenuItem value="adam">Adam</MenuItem>
                                            <MenuItem value="sgd">SGD</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <Stack alignItems="center">
                                        <Grid container spacing={2} justifyContent="center">
                                            <Grid item xs={6}>
                                                <FormControl fullWidth size="medium" sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
                                                    <InputLabel>Device</InputLabel>
                                                    <Select
                                                        value={formData.training.device}
                                                        onChange={(e) => handleConfigChange('training', 'device', e.target.value)}
                                                        label="Device"
                                                        disabled={!trainingEnabled}
                                                    >
                                                        <MenuItem value="cpu">CPU</MenuItem>
                                                        <MenuItem value="gpu">GPU</MenuItem>
                                                        <MenuItem value="hpu">HPU</MenuItem>
                                                        <MenuItem value="cuda">CUDA</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <FormControl fullWidth size="medium" sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
                                                    <InputLabel>Mixed Precision</InputLabel>
                                                    <Select
                                                        value={formData.training.mixed_precision}
                                                        onChange={(e) => handleConfigChange('training', 'mixed_precision', e.target.value)}
                                                        label="Mixed Precision"
                                                        disabled={!trainingEnabled}
                                                    >
                                                        <MenuItem value="no">No</MenuItem>
                                                        <MenuItem value="fp16">FP16</MenuItem>
                                                        <MenuItem value="bf16">BF16</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                        </Grid>
                                    </Stack>
                                    <TextField
                                        label="Gradient Accumulation Steps"
                                        type="number"
                                        value={formData.training.gradient_accumulation_steps}
                                        onChange={(e) => handleConfigChange('training', 'gradient_accumulation_steps', parseInt(e.target.value))}
                                        inputProps={{ min: 1, step: 1 }}
                                        size="medium"
                                        fullWidth
                                        disabled={!trainingEnabled}
                                    />
                                    <Stack alignItems="center">
                                        <Grid container spacing={2} justifyContent="center">
                                            <Grid item xs={6}>
                                                <TextField
                                                    label="Learning Rate Multiplier"
                                                    type="number"
                                                    value={formData.openai_params.learning_rate_multiplier}
                                                    onChange={(e) => handleOpenAIParamChange('learning_rate_multiplier', parseFloat(e.target.value))}
                                                    error={!!errors.learning_rate_multiplier}
                                                    inputProps={{ min: 0.02, max: 2, step: 0.01 }}
                                                    size="medium"
                                                    fullWidth
                                                    disabled={!trainingEnabled}
                                                />
                                            </Grid>
                                            <Grid item xs={6}>
                                                <TextField
                                                    label="Prompt Loss Weight"
                                                    type="number"
                                                    value={formData.openai_params.prompt_loss_weight}
                                                    onChange={(e) => handleOpenAIParamChange('prompt_loss_weight', parseFloat(e.target.value))}
                                                    inputProps={{ min: 0, max: 1, step: 0.01 }}
                                                    size="medium"
                                                    fullWidth
                                                    disabled={!trainingEnabled}
                                                />
                                            </Grid>
                                        </Grid>
                                    </Stack>
                            </Stack>
                        </Box>
                    </Grid>
                </Grid>
            </DialogContent>

            <DialogActions sx={{ p: 3, pt: 2, gap: 2, justifyContent: 'flex-end' }}>
                <Button 
                    onClick={handleClose} 
                    variant="outlined"
                    size="large"
                    sx={{ minWidth: 120 }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={isSubmitting}
                    size="large"
                    sx={{ minWidth: 140 }}
                >
                    {isSubmitting ? (
                        <>
                            <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
                            Creating...
                        </>
                    ) : (
                        'Create Job'
                    )}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

FinetuningJobModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onJobCreated: PropTypes.func.isRequired
}

export default FinetuningJobModal