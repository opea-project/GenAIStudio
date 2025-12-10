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
    Checkbox,
    FormControlLabel,
    Typography,
    Stack,
    IconButton,
    CircularProgress,
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
            block_size: 512,
            validation_split_percentage: 5,
            padding_side: 'right',
            truncation_side: 'right',
            max_source_length: 384,
            pad_to_max: false,
            query_max_len: 128,
            passage_max_len: 128,
            train_group_size: 8,
            query_instruction_for_retrieval: '',
            passage_instruction_for_retrieval: '',
            reasoning_dataset_keys: ['Question', 'Complex_CoT', 'Response'],
            // raw input string to preserve trailing commas/spaces while editing
            reasoning_dataset_keys_input: 'Question, Complex_CoT, Response',
            max_prompt_length: 512,
            data_preprocess_type: 'neural_chat',
            data_preprocess_neural_chat: true,
            padding: 'true',
            truncation: true,
            mask_input: true,
            mask_response: true
        },
        training: {
            optimizer: 'adamw_torch',
            device: 'cpu',
            batch_size: 2,
            epochs: 1,
            max_train_steps: null,
            learning_rate: 5.0e-5,
            lr_scheduler: 'linear',
            weight_decay: 0.0,
            num_training_workers: 1,
            accelerate_mode: 'DDP',
            mixed_precision: 'no',
            gradient_accumulation_steps: 1,
            logging_steps: 10,
            dpo_beta: 0.1
            ,
            // Embedding-specific training config (only used when task === 'embedding')
            embedding_training_config: {
                
                temperature: 0.02,
                sentence_pooling_method: 'cls',
                normalized: true,
                use_inbatch_neg: true
            }
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

        // General validation
        if (!formData.general.output_dir) {
            newErrors.output_dir = 'Output directory is required'
        }

        // Dataset validation
        if (formData.dataset.max_length <= 0) {
            newErrors.dataset_max_length = 'Max length must be greater than 0'
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

            // Build payload
            const jobPayload = {
                model: formData.baseModel,
                training_file: trainingFileName
            }

            // General configuration with LoRA config
            const gen = { ...formData.general }
            gen.lora_config = loraEnabled ? formData.lora : null
            gen.config = gen.config || {}
            if (formData.hf_token) {
                gen.config.token = formData.hf_token
            }
            jobPayload.General = gen
            jobPayload.task = gen.task || 'instruction_tuning'

            // Dataset configuration
            jobPayload.Dataset = {
                max_length: formData.dataset.max_length,
                block_size: formData.dataset.block_size,
                max_source_length: formData.dataset.max_source_length,
                padding_side: formData.dataset.padding_side,
                truncation_side: formData.dataset.truncation_side,
                padding: formData.dataset.padding,
                truncation: formData.dataset.truncation,
                mask_input: formData.dataset.mask_input,
                mask_response: formData.dataset.mask_response,
                query_max_len: formData.dataset.query_max_len,
                passage_max_len: formData.dataset.passage_max_len,
                train_group_size: formData.dataset.train_group_size,
                query_instruction_for_retrieval: formData.dataset.query_instruction_for_retrieval,
                passage_instruction_for_retrieval: formData.dataset.passage_instruction_for_retrieval,
                pad_to_max: formData.dataset.pad_to_max,
                data_preprocess_type: formData.dataset.data_preprocess_neural_chat ? 'neural_chat' : null
            }

            // Training configuration
            jobPayload.Training = {
                optimizer: formData.training.optimizer,
                device: formData.training.device,
                batch_size: formData.training.batch_size,
                epochs: formData.training.epochs,
                max_train_steps: formData.training.max_train_steps,
                learning_rate: formData.training.learning_rate,
                lr_scheduler: formData.training.lr_scheduler,
                weight_decay: formData.training.weight_decay,
                num_training_workers: formData.training.num_training_workers,
                accelerate_mode: formData.training.accelerate_mode,
                mixed_precision: formData.training.mixed_precision,
                gradient_accumulation_steps: formData.training.gradient_accumulation_steps,
                logging_steps: formData.training.logging_steps,
                // embedding_training_config will be attached below only for embedding task
                dpo_beta: formData.training.dpo_beta
            }

            // If embedding task, attach embedding_training_config
            if (jobPayload.task === 'embedding') {
                jobPayload.Training.embedding_training_config = formData.training.embedding_training_config
            }

            // Call the actual API
            const response = await finetuningApi.createJob(jobPayload)
            
            // Create job object from response
            const newJob = {
                id: response.data?.id || response.data?.fine_tuning_job_id || Date.now().toString(),
                status: response.data?.status || 'pending',
                model: formData.baseModel,
                task: jobPayload.task || 'instruction_tuning',
                dataset: formData.trainingDataset?.suffixedName || formData.trainingDataset?.name || 'Unknown',
                progress: '0%',
                createdDate: response.data?.created_at || new Date().toISOString(),
                training_file: jobPayload.training_file,
                openai_params: formData.openai_params,
                training: formData.training,
                general: formData.general,
                dataset_config: formData.dataset
            }

            if (formData.hf_token) {
                newJob.general = { ...newJob.general, config: { ...(newJob.general.config || {}), token: formData.hf_token } }
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
                block_size: 512,
                validation_split_percentage: 5,
                padding_side: 'right',
                truncation_side: 'right',
                max_source_length: 384,
                pad_to_max: false,
                query_max_len: 128,
                passage_max_len: 128,
                train_group_size: 8,
                query_instruction_for_retrieval: '',
                passage_instruction_for_retrieval: '',
                reasoning_dataset_keys: ['Question', 'Complex_CoT', 'Response'],
                reasoning_dataset_keys_input: 'Question, Complex_CoT, Response',
                max_prompt_length: 512,
                data_preprocess_type: 'neural_chat',
                data_preprocess_neural_chat: true,
                padding: 'true',
                truncation: true,
                mask_input: true,
                mask_response: true
            },
            training: {
                optimizer: 'adamw_torch',
                device: 'cpu',
                batch_size: 2,
                epochs: 1,
                max_train_steps: null,
                learning_rate: 5.0e-5,
                lr_scheduler: 'linear',
                weight_decay: 0.0,
                num_training_workers: 1,
                accelerate_mode: 'DDP',
                mixed_precision: 'no',
                gradient_accumulation_steps: 1,
                logging_steps: 10,
                dpo_beta: 0.1
            ,
            embedding_training_config: {
                temperature: 0.02,
                sentence_pooling_method: 'cls',
                normalized: true,
                use_inbatch_neg: true
            }
            },
            lora: {
                r: 8,
                lora_alpha: 32,
                lora_dropout: 0.1,
                task_type: 'CAUSAL_LM'
            }
        })
        setLoraEnabled(false)
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
                    position: 'relative',
                    borderRadius: 2,
                    maxHeight: '95vh',
                    height: '95vh'
                }
            }}
        >
            <DialogTitle sx={{ pb: 2, overflow: 'visible', textOverflow: 'unset' }}>
                <Typography variant="h5" fontWeight={600} sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    Create New Fine-tuning Job
                </Typography>
            </DialogTitle>

            {/* Close button moved out of title: absolutely positioned within the dialog Paper */}
            <IconButton
                onClick={handleClose}
                size="medium"
                aria-label="Close dialog"
                sx={{ position: 'absolute', right: 12, top: 12, zIndex: 10 }}
            >
                <IconX />
            </IconButton>

            <DialogContent dividers sx={{ p: 3, overflow: 'auto', minHeight: 0 }}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, height: '100%' }}>
                    {/* Left Column: Model & Task Setup */}
                    <Box sx={{ width: { xs: '100%', md: '50%' } }}>
                        <Stack spacing={2.5} sx={{ height: '100%' }}>
                            {/* Base Model */}
                            <Box>
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
                                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1, display: 'block' }}>
                                        {errors.baseModel}
                                    </Typography>
                                )}
                            </Box>
                            
                            {/* HF Token */}
                            <TextField
                                label="HF Token (optional)"
                                type="password"
                                value={formData.hf_token}
                                onChange={(e) => handleInputChange('hf_token', e.target.value)}
                                fullWidth
                                size="medium"
                                sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}
                            />

                            {/* Task Type */}
                            <FormControl fullWidth size="medium" sx={{ '& .MuiInputBase-root': { minHeight: 48 } }}>
                                <InputLabel>Task Type</InputLabel>
                                <Select
                                    value={formData.general.task}
                                    onChange={(e) => {
                                        const newTask = e.target.value
                                        handleConfigChange('general', 'task', newTask)
                                        if (newTask === 'reasoning') {
                                            // Prefill reasoning keys if not already set
                                            const existing = formData.dataset.reasoning_dataset_keys
                                            if (!existing || existing.length === 0) {
                                                handleConfigChange('dataset', 'reasoning_dataset_keys', ['Question', 'Complex_CoT', 'Response'])
                                                handleConfigChange('dataset', 'reasoning_dataset_keys_input', 'Question, Complex_CoT, Response')
                                            }
                                        }
                                    }}
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

                            {/* Inline Instruction Tuning config shown right under Task Type */}
                            {formData.general.task === 'instruction_tuning' && (
                                <Box sx={{ mt: 1 }}>
                                    <Stack spacing={2}>
                                        {/* 2-column responsive CSS grid for short-value fields */}
                                        <Box sx={{ mt: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(160px, 1fr))' }, gap: 2 }}>
                                            <Box>
                                                <TextField
                                                    label="Max Length"
                                                    type="number"
                                                    value={formData.dataset.max_length}
                                                    onChange={(e) => handleConfigChange('dataset', 'max_length', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                    fullWidth
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Block Size"
                                                    type="number"
                                                    value={formData.dataset.block_size}
                                                    onChange={(e) => handleConfigChange('dataset', 'block_size', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                    fullWidth
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Max Source Length"
                                                    type="number"
                                                    value={formData.dataset.max_source_length}
                                                    onChange={(e) => handleConfigChange('dataset', 'max_source_length', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                    fullWidth
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Max Prompt Length"
                                                    type="number"
                                                    value={formData.dataset.max_prompt_length}
                                                    onChange={(e) => handleConfigChange('dataset', 'max_prompt_length', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                    fullWidth
                                                />
                                            </Box>


                                            <Box>
                                                <TextField
                                                    label="Padding Side"
                                                    value={formData.dataset.padding_side}
                                                    onChange={(e) => handleConfigChange('dataset', 'padding_side', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Truncation Side"
                                                    value={formData.dataset.truncation_side}
                                                    onChange={(e) => handleConfigChange('dataset', 'truncation_side', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Padding"
                                                    value={String(formData.dataset.padding)}
                                                    onChange={(e) => handleConfigChange('dataset', 'padding', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Truncation"
                                                    value={String(formData.dataset.truncation)}
                                                    onChange={(e) => handleConfigChange('dataset', 'truncation', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Mask Input"
                                                    value={String(formData.dataset.mask_input)}
                                                    onChange={(e) => handleConfigChange('dataset', 'mask_input', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Mask Response"
                                                    value={String(formData.dataset.mask_response)}
                                                    onChange={(e) => handleConfigChange('dataset', 'mask_response', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                />
                                            </Box>
                                        </Box>

                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={!!formData.dataset.data_preprocess_neural_chat}
                                                    onChange={(e) => handleConfigChange('dataset', 'data_preprocess_neural_chat', e.target.checked)}
                                                />
                                            }
                                            label="Use neural_chat for data preprocess type"
                                            size="small"
                                            sx={{ mt: 0 }}
                                        />
                                    </Stack>
                                </Box>
                            )}

                            {/* Reasoning task dataset config (mirrors instruction tuning controls) */}
                            {formData.general.task === 'reasoning' && (
                                <Box sx={{ mt: 1 }}>
                                    <Stack spacing={2}>
                                        {/* Comma-separated keys field that maps to array */}
                                        <TextField
                                            label="Reasoning Dataset Keys (comma or space-separated)"
                                            value={formData.dataset.reasoning_dataset_keys_input || ''}
                                            onChange={(e) => {
                                                const raw = e.target.value
                                                // update raw input so trailing separators are preserved while typing
                                                handleConfigChange('dataset', 'reasoning_dataset_keys_input', raw)
                                                // allow comma or whitespace as separators to derive the array
                                                const arr = raw.split(/[,\s]+/).map(s => s.trim()).filter(Boolean)
                                                handleConfigChange('dataset', 'reasoning_dataset_keys', arr)
                                            }}
                                            size="small"
                                            fullWidth
                                        />

                                        {/* Numeric fields: inline+scroll on small screens, 3-column fluid layout on md+ (no scrollbar) */}
                                        <Box sx={{
                                            display: 'grid',
                                            gridAutoFlow: { xs: 'column', md: 'row' },
                                            gridAutoColumns: { xs: 'minmax(100px, 1fr)', sm: 'minmax(120px, 1fr)' },
                                            gridTemplateColumns: { md: 'repeat(3, minmax(140px, 1fr))' },
                                            gap: 2,
                                        }}>
                                            <Box>
                                                <TextField
                                                    label="Max Length"
                                                    type="number"
                                                    value={formData.dataset.max_length}
                                                    onChange={(e) => handleConfigChange('dataset', 'max_length', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                    fullWidth
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Max Source Length"
                                                    type="number"
                                                    value={formData.dataset.max_source_length}
                                                    onChange={(e) => handleConfigChange('dataset', 'max_source_length', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                    fullWidth
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Max Prompt Length"
                                                    type="number"
                                                    value={formData.dataset.max_prompt_length}
                                                    onChange={(e) => handleConfigChange('dataset', 'max_prompt_length', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                    fullWidth
                                                />
                                            </Box>
                                        </Box>

                                        {/* 2-column responsive CSS grid for short-value fields */}
                                        <Box sx={{ mt: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                            <Box>
                                                <TextField
                                                    label="Padding Side"
                                                    value={formData.dataset.padding_side}
                                                    onChange={(e) => handleConfigChange('dataset', 'padding_side', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Truncation Side"
                                                    value={formData.dataset.truncation_side}
                                                    onChange={(e) => handleConfigChange('dataset', 'truncation_side', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Padding"
                                                    value={String(formData.dataset.padding)}
                                                    onChange={(e) => handleConfigChange('dataset', 'padding', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Truncation"
                                                    value={String(formData.dataset.truncation)}
                                                    onChange={(e) => handleConfigChange('dataset', 'truncation', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Mask Input"
                                                    value={String(formData.dataset.mask_input)}
                                                    onChange={(e) => handleConfigChange('dataset', 'mask_input', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Mask Response"
                                                    value={String(formData.dataset.mask_response)}
                                                    onChange={(e) => handleConfigChange('dataset', 'mask_response', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                />
                                            </Box>
                                        </Box>
                                    </Stack>
                                </Box>
                            )}

                            {/* Pretraining task dataset config: minimal fields (max_length, truncation, padding) */}
                            {formData.general.task === 'pretraining' && (
                                <Box sx={{ mt: 1 }}>
                                    <Stack spacing={2}>
                                        <Box sx={{ mt: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(160px, 1fr))' }, gap: 2 }}>
                                            <Box>
                                                <TextField
                                                    label="Max Length"
                                                    type="number"
                                                    value={formData.dataset.max_length}
                                                    onChange={(e) => handleConfigChange('dataset', 'max_length', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                    fullWidth
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Block Size"
                                                    type="number"
                                                    value={formData.dataset.block_size}
                                                    onChange={(e) => handleConfigChange('dataset', 'block_size', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Padding"
                                                    value={String(formData.dataset.padding)}
                                                    onChange={(e) => handleConfigChange('dataset', 'padding', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Truncation"
                                                    value={String(formData.dataset.truncation)}
                                                    onChange={(e) => handleConfigChange('dataset', 'truncation', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                />
                                            </Box>

                                        </Box>
                                    </Stack>
                                </Box>
                            )}

                            {/* Rerank task dataset config */}
                            {formData.general.task === 'rerank' && (
                                <Box sx={{ mt: 1 }}>
                                    <Stack spacing={2}>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                            <Box>
                                                <TextField
                                                    label="Max Length"
                                                    type="number"
                                                    value={formData.dataset.max_length}
                                                    onChange={(e) => handleConfigChange('dataset', 'max_length', e.target.value)}
                                                    size="small"
                                                    fullWidth
                                                />
                                            </Box>
                                            <Box>
                                                <TextField
                                                    label="Train Group Size"
                                                    type="number"
                                                    value={formData.dataset.train_group_size}
                                                    onChange={(e) => handleConfigChange('dataset', 'train_group_size', e.target.value)}
                                                    size="small"
                                                    fullWidth
                                                />
                                            </Box>
                                        </Box>
                                    </Stack>
                                </Box>
                            )}

                            {/* Embedding task dataset config */}
                            {formData.general.task === 'embedding' && (
                                <Box sx={{ mt: 1 }}>
                                    <Stack spacing={2}>
                                        <TextField
                                            label="Query Instruction For Retrieval"
                                            value={formData.dataset.query_instruction_for_retrieval || ''}
                                            onChange={(e) => handleConfigChange('dataset', 'query_instruction_for_retrieval', e.target.value)}
                                            size="small"
                                            fullWidth
                                        />

                                        <TextField
                                            label="Passage Instruction For Retrieval"
                                            value={formData.dataset.passage_instruction_for_retrieval || ''}
                                            onChange={(e) => handleConfigChange('dataset', 'passage_instruction_for_retrieval', e.target.value)}
                                            size="small"
                                            fullWidth
                                        />

                                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                            <Box>
                                                <TextField
                                                    label="Query Max Len"
                                                    type="number"
                                                    value={formData.dataset.query_max_len}
                                                    onChange={(e) => handleConfigChange('dataset', 'query_max_len', e.target.value)}
                                                    size="small"
                                                    fullWidth
                                                />
                                            </Box>
                                            <Box>
                                                <TextField
                                                    label="Passage Max Len"
                                                    type="number"
                                                    value={formData.dataset.passage_max_len}
                                                    onChange={(e) => handleConfigChange('dataset', 'passage_max_len', e.target.value)}
                                                    size="small"
                                                    fullWidth
                                                />
                                            </Box>
                                        </Box>

                                        <TextField
                                            label="Padding"
                                            value={String(formData.dataset.padding)}
                                            onChange={(e) => handleConfigChange('dataset', 'padding', e.target.value)}
                                            size="small"
                                            fullWidth
                                        />

                                        <TextField
                                            label="Train Group Size"
                                            type="number"
                                            value={formData.dataset.train_group_size}
                                            onChange={(e) => handleConfigChange('dataset', 'train_group_size', e.target.value)}
                                            size="small"
                                            fullWidth
                                        />
                                    </Stack>
                                </Box>
                            )}

                            {/* DPO task dataset config: max_length, max_prompt_length, pad_to_max */}
                            {formData.general.task === 'dpo' && (
                                <Box sx={{ mt: 1 }}>
                                    <Stack spacing={2}>
                                        <Box sx={{
                                            display: 'grid',
                                            gridAutoFlow: { xs: 'column', md: 'row' },
                                            gridAutoColumns: { xs: 'minmax(100px, 1fr)', sm: 'minmax(120px, 1fr)' },
                                            gridTemplateColumns: { md: 'repeat(3, minmax(140px, 1fr))' },
                                            gap: 2,
                                        }}>
                                            <Box>
                                                <TextField
                                                    label="Max Length"
                                                    type="number"
                                                    value={formData.dataset.max_length}
                                                    onChange={(e) => handleConfigChange('dataset', 'max_length', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                    fullWidth
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Max Prompt Length"
                                                    type="number"
                                                    value={formData.dataset.max_prompt_length}
                                                    onChange={(e) => handleConfigChange('dataset', 'max_prompt_length', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                    fullWidth
                                                />
                                            </Box>

                                            <Box>
                                                <TextField
                                                    label="Pad To Max"
                                                    value={String(formData.dataset.pad_to_max)}
                                                    onChange={(e) => handleConfigChange('dataset', 'pad_to_max', e.target.value)}
                                                    size="small"
                                                    sx={{ width: '100%' }}
                                                />
                                            </Box>
                                        </Box>
                                    </Stack>
                                </Box>
                            )}
                        </Stack>
                    </Box>

                    {/* Right Column: Training Dataset & Training Parameters */}
                    <Box sx={{ width: { xs: '100%', md: '50%' } }}>
                        <Stack spacing={2.5} sx={{ height: '100%' }}>
                            {/* Training Dataset Upload */}
                            <Box>
                                <FileUploadArea
                                    onFileUpload={(file) => handleFileUpload('trainingDataset', file)}
                                    acceptedTypes={['.json', '.jsonl', '.csv']}
                                    maxSizeMB={100}
                                    error={errors.trainingDataset}
                                />
                            </Box>

                            {/* Training Parameters */}
                            <Box sx={{ p: 0, mt: 1 }}>
                                <Stack spacing={2}>
                                    {/* compact grid similar to task-type configs */}
                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(140px, 1fr))' }, gap: 2 }}>
                                        <Box>
                                            <TextField
                                                label="Epochs"
                                                type="number"
                                                value={formData.training.epochs}
                                                onChange={(e) => handleConfigChange('training', 'epochs', parseInt(e.target.value))}
                                                error={!!errors.epochs}
                                                inputProps={{ min: 1, step: 1 }}
                                                size="small"
                                                fullWidth
                                                sx={{ '& .MuiInputBase-root': { minHeight: 40 } }}
                                            />
                                        </Box>
                                        <Box>
                                            <TextField
                                                label="Batch Size"
                                                type="number"
                                                value={formData.training.batch_size}
                                                onChange={(e) => handleConfigChange('training', 'batch_size', parseInt(e.target.value))}
                                                error={!!errors.batch_size}
                                                inputProps={{ min: 1, max: 256, step: 1 }}
                                                size="small"
                                                fullWidth
                                                sx={{ '& .MuiInputBase-root': { minHeight: 40 } }}
                                            />
                                        </Box>
                                    </Box>

                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(140px, 1fr))' }, gap: 2 }}>
                                        <Box>
                                            <TextField
                                                label="Learning Rate"
                                                type="number"
                                                value={formData.training.learning_rate}
                                                onChange={(e) => handleConfigChange('training', 'learning_rate', parseFloat(e.target.value))}
                                                error={!!errors.learning_rate}
                                                inputProps={{ min: 0.00001, max: 0.01, step: 0.00001 }}
                                                size="small"
                                                fullWidth
                                                sx={{ '& .MuiInputBase-root': { minHeight: 40 } }}
                                            />
                                        </Box>
                                        <Box>
                                            <TextField
                                                label="Max Train Steps (optional)"
                                                type="number"
                                                value={formData.training.max_train_steps || ''}
                                                onChange={(e) => handleConfigChange('training', 'max_train_steps', e.target.value ? parseInt(e.target.value) : null)}
                                                inputProps={{ min: 1, step: 1 }}
                                                size="small"
                                                fullWidth
                                                sx={{ '& .MuiInputBase-root': { minHeight: 40 } }}
                                            />
                                        </Box>
                                    </Box>

                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                        <Box>
                                            <TextField
                                                label="Optimizer"
                                                value={formData.training.optimizer}
                                                onChange={(e) => handleConfigChange('training', 'optimizer', e.target.value)}
                                                size="small"
                                                fullWidth
                                                sx={{ '& .MuiInputBase-root': { minHeight: 40 } }}
                                            />
                                        </Box>
                                        <Box>
                                            <TextField
                                                label="Gradient Accumulation Steps"
                                                type="number"
                                                value={formData.training.gradient_accumulation_steps}
                                                onChange={(e) => handleConfigChange('training', 'gradient_accumulation_steps', parseInt(e.target.value))}
                                                inputProps={{ min: 1, step: 1 }}
                                                size="small"
                                                fullWidth
                                                sx={{ '& .MuiInputBase-root': { minHeight: 40 } }}
                                            />
                                        </Box>
                                    </Box>

                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(120px, 1fr))' }, gap: 2 }}>
                                        <Box>
                                            <FormControl fullWidth size="small" sx={{ '& .MuiInputBase-root': { minHeight: 40 } }}>
                                                <InputLabel>Device</InputLabel>
                                                <Select
                                                    value={formData.training.device}
                                                    onChange={(e) => handleConfigChange('training', 'device', e.target.value)}
                                                    label="Device"
                                                >
                                                    <MenuItem value="cpu">CPU</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Box>
                                        <Box>
                                            <FormControl fullWidth size="small" sx={{ '& .MuiInputBase-root': { minHeight: 40 } }}>
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
                                        </Box>
                                        <Box>
                                            <FormControl fullWidth size="small" sx={{ '& .MuiInputBase-root': { minHeight: 40 } }}>
                                                <InputLabel>Accelerate Mode</InputLabel>
                                                <Select
                                                    value={formData.training.accelerate_mode}
                                                    onChange={(e) => handleConfigChange('training', 'accelerate_mode', e.target.value)}
                                                    label="Accelerate Mode"
                                                >
                                                    <MenuItem value="DDP">DDP</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Box>
                                    </Box>

                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(120px, 1fr))' }, gap: 2 }}>
                                        <Box>
                                            <TextField
                                                label="Weight Decay"
                                                type="number"
                                                value={formData.training.weight_decay}
                                                onChange={(e) => handleConfigChange('training', 'weight_decay', parseFloat(e.target.value))}
                                                inputProps={{ min: 0, step: 0.01 }}
                                                size="small"
                                                fullWidth
                                                sx={{ '& .MuiInputBase-root': { minHeight: 40 } }}
                                            />
                                        </Box>
                                        <Box>
                                            <TextField
                                                label="Logging Steps"
                                                type="number"
                                                value={formData.training.logging_steps}
                                                onChange={(e) => handleConfigChange('training', 'logging_steps', parseInt(e.target.value))}
                                                error={!!errors.logging_steps}
                                                inputProps={{ min: 1, step: 1 }}
                                                size="small"
                                                fullWidth
                                                sx={{ '& .MuiInputBase-root': { minHeight: 40 } }}
                                            />
                                        </Box>
                                        <Box>
                                            <TextField
                                                label="LR Scheduler"
                                                value={formData.training.lr_scheduler}
                                                onChange={(e) => handleConfigChange('training', 'lr_scheduler', e.target.value)}
                                                size="small"
                                                fullWidth
                                                sx={{ '& .MuiInputBase-root': { minHeight: 40 } }}
                                            />
                                        </Box>
                                    </Box>

                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(140px, 1fr))' }, gap: 2 }}>
                                        <Box>
                                            <TextField
                                                label="Number of Training Workers"
                                                type="number"
                                                value={formData.training.num_training_workers}
                                                onChange={() => {}}
                                                InputProps={{ readOnly: true }}
                                                inputProps={{ min: 1, step: 1, 'aria-readonly': true }}
                                                disabled
                                                size="small"
                                                fullWidth
                                                sx={{ '& .MuiInputBase-root': { minHeight: 40 } }}
                                            />
                                        </Box>
                                        <Box>
                                            <TextField
                                                label="DPO Beta"
                                                type="number"
                                                value={formData.training.dpo_beta}
                                                onChange={(e) => handleConfigChange('training', 'dpo_beta', parseFloat(e.target.value))}
                                                inputProps={{ min: 0, step: 0.01 }}
                                                size="small"
                                                fullWidth
                                                sx={{ '& .MuiInputBase-root': { minHeight: 40 } }}
                                            />
                                        </Box>
                                    </Box>

                                    {formData.general.task === 'embedding' ? (
                                        <Box sx={{ mt: 1, display: 'grid', gap: 2 }}>
                                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                                <Box>
                                                    <TextField
                                                        label="Temperature"
                                                        type="number"
                                                        value={formData.training.embedding_training_config?.temperature}
                                                        onChange={(e) => handleConfigChange('training', 'embedding_training_config', {
                                                            ...formData.training.embedding_training_config,
                                                            temperature: e.target.value === '' ? null : parseFloat(e.target.value)
                                                        })}
                                                        inputProps={{ step: 0.01 }}
                                                        size="small"
                                                        fullWidth
                                                    />
                                                </Box>
                                                <Box>
                                                    <TextField
                                                        label="Sentence Pooling Method"
                                                        value={formData.training.embedding_training_config?.sentence_pooling_method}
                                                        onChange={(e) => handleConfigChange('training', 'embedding_training_config', {
                                                            ...formData.training.embedding_training_config,
                                                            sentence_pooling_method: e.target.value
                                                        })}
                                                        size="small"
                                                        fullWidth
                                                    />
                                                </Box>
                                            </Box>

                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={!!formData.training.embedding_training_config?.normalized}
                                                        onChange={(e) => handleConfigChange('training', 'embedding_training_config', {
                                                            ...formData.training.embedding_training_config,
                                                            normalized: e.target.checked
                                                        })}
                                                    />
                                                }
                                                label="Normalized embeddings"
                                            />

                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={!!formData.training.embedding_training_config?.use_inbatch_neg}
                                                        onChange={(e) => handleConfigChange('training', 'embedding_training_config', {
                                                            ...formData.training.embedding_training_config,
                                                            use_inbatch_neg: e.target.checked
                                                        })}
                                                    />
                                                }
                                                label="Use in-batch negatives"
                                            />
                                        </Box>
                                    ) : null }
                                </Stack>
                            </Box>
                        </Stack>
                    </Box>
                </Box>
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