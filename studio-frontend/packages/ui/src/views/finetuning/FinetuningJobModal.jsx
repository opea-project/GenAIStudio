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
    IconButton,
    Grid
} from '@mui/material'
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

    const baseModels = [
        'gpt-3.5-turbo',
        'gpt-4',
        'llama-2-7b',
        'llama-2-13b',
        'mistral-7b',
        'codellama-7b',
        'falcon-7b'
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

    const handleFileUpload = (fileType, file) => {
        setFormData(prev => ({
            ...prev,
            [fileType]: file
        }))
        
        // Clear error for this field
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

        // OpenAI parameters validation
        if (formData.openai_params.learning_rate_multiplier <= 0) {
            newErrors.learning_rate_multiplier = 'Learning rate multiplier must be greater than 0'
        }

        if (formData.openai_params.batch_size <= 0) {
            newErrors.batch_size = 'Batch size must be greater than 0'
        }

        if (formData.openai_params.n_epochs <= 0) {
            newErrors.n_epochs = 'Number of epochs must be greater than 0'
        }

        // Training parameters validation
        if (formData.training.learning_rate <= 0) {
            newErrors.learning_rate = 'Learning rate must be greater than 0'
        }

        if (formData.training.epochs <= 0) {
            newErrors.epochs = 'Epochs must be greater than 0'
        }

        if (formData.training.logging_steps <= 0) {
            newErrors.logging_steps = 'Logging steps must be greater than 0'
        }

        // LoRA parameters validation
        if (formData.lora.r <= 0) {
            newErrors.lora_r = 'LoRA rank must be greater than 0'
        }

        if (formData.lora.lora_alpha <= 0) {
            newErrors.lora_alpha = 'LoRA alpha must be greater than 0'
        }

        if (formData.lora.lora_dropout < 0 || formData.lora.lora_dropout > 1) {
            newErrors.lora_dropout = 'LoRA dropout must be between 0 and 1'
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
            // TODO: Replace with actual API call
            // const response = await finetuningApi.createJob({
            //     model: formData.baseModel,
            //     training_file_id: formData.trainingDataset?.id,
            //     General: formData.general,
            //     Dataset: formData.dataset,
            //     Training: formData.training,
            //     openai_params: formData.openai_params,
            //     lora_config: formData.lora
            // })

            // Generate job name automatically based on model and timestamp for simulation
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
            const jobId = `ft-${formData.baseModel}-${timestamp}`
            
            const newJob = {
                id: jobId,
                name: jobId,
                status: 'pending',
                model: formData.baseModel,
                dataset: formData.trainingDataset?.suffixedName || formData.trainingDataset?.name || 'Unknown',
                progress: '0%',
                createdDate: new Date().toISOString(),
                // Include all configuration sections
                openai_params: formData.openai_params,
                general: formData.general,
                dataset_config: formData.dataset,
                training: formData.training,
                lora: formData.lora,
                training_file_id: formData.trainingDataset?.id
            }

            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1000))

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
            },
            lora: {
                r: 8,
                lora_alpha: 32,
                lora_dropout: 0.1,
                task_type: 'CAUSAL_LM'
            }
        })
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

            <DialogContent dividers sx={{ p: 3, overflow: 'auto', minHeight: 600 }}>
                <Grid container spacing={3} sx={{ height: '100%', alignItems: 'stretch' }}>
                    {/* Top Left Quadrant: Model Configuration and Dataset Configuration */}
                    <Grid item xs={12} md={6}>
                        <Stack spacing={3} sx={{ height: '100%' }}>
                            {/* Model Configuration */}
                            <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, backgroundColor: 'background.paper' }}>
                                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                                    Model Configuration
                                </Typography>
                                <FormControl fullWidth required error={!!errors.baseModel} size="medium" sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
                                    <InputLabel>Base Model</InputLabel>
                                    <Select
                                        value={formData.baseModel}
                                        onChange={(e) => handleInputChange('baseModel', e.target.value)}
                                        label="Base Model"
                                    >
                                        {baseModels.map((model) => (
                                            <MenuItem key={model} value={model}>
                                                {model}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    {errors.baseModel && (
                                        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1 }}>
                                            {errors.baseModel}
                                        </Typography>
                                    )}
                                </FormControl>
                            </Box>

                            {/* Dataset Configuration */}
                            <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, backgroundColor: 'background.paper' }}>
                                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                                    Dataset Configuration
                                </Typography>
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
                                            />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <FormControl fullWidth size="medium" sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
                                                <InputLabel>Preprocess Type</InputLabel>
                                                <Select
                                                    value={formData.dataset.data_preprocess_type}
                                                    onChange={(e) => handleConfigChange('dataset', 'data_preprocess_type', e.target.value)}
                                                    label="Preprocess Type"
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
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                                General Configuration
                            </Typography>
                            <Stack spacing={2.5}>
                                    <FormControl fullWidth size="medium" sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
                                        <InputLabel>Task Type</InputLabel>
                                        <Select
                                            value={formData.general.task}
                                            onChange={(e) => handleConfigChange('general', 'task', e.target.value)}
                                            label="Task Type"
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
                                    />
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
                                                sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}
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
                                                sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}
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
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                                Training Configuration
                            </Typography>
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
                                />
                                <FormControl fullWidth size="medium" sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
                                        <InputLabel>Optimizer</InputLabel>
                                        <Select
                                            value={formData.training.optimizer}
                                            onChange={(e) => handleConfigChange('training', 'optimizer', e.target.value)}
                                            label="Optimizer"
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
                    {isSubmitting ? 'Creating...' : 'Create Job'}
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