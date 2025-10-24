import client from './client'

const finetuningApi = {
    // Upload training file
    uploadFile: (file, purpose = 'fine-tune', onUploadProgress) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('purpose', purpose)
        
        return client.post('/finetuning/files', formData, {
            // DO NOT set Content-Type here; letting axios set it ensures the multipart boundary is included
            onUploadProgress
        })
    },

    // Create new fine-tuning job
    createJob: (jobData) => {
        const payload = {
            training_file: jobData.training_file,
            model: jobData.model
        }

        // Add optional General configuration
        if (jobData.General) {
            payload.General = jobData.General
        }

        // Add optional Dataset configuration
        if (jobData.Dataset) {
            payload.Dataset = jobData.Dataset
        }

        // Add optional Training configuration
        if (jobData.Training) {
            payload.Training = jobData.Training
        }
        
        return client.post('/finetuning/jobs', payload)
    },

    // List all fine-tuning jobs
    getAllJobs: () => client.get('/finetuning/jobs'),

    // Retrieve specific fine-tuning job
    getJob: (fineTuningJobId) => {
        return client.post('/finetuning/jobs/retrieve', {
            fine_tuning_job_id: fineTuningJobId
        })
    },

    // Cancel a fine-tuning job
    cancelJob: (fineTuningJobId) => {
        return client.post('/finetuning/jobs/cancel', {
            fine_tuning_job_id: fineTuningJobId
        })
    },

    // List checkpoints of a fine-tuning job
    listCheckpoints: (fineTuningJobId) => {
        return client.post('/finetuning/jobs/checkpoints', {
            fine_tuning_job_id: fineTuningJobId
        })
    },

    // Get logs for a fine-tuning job
    getJobLogs: (fineTuningJobId, opts = {}) => {
        return client.post('/finetuning/jobs/logs', {
            fine_tuning_job_id: fineTuningJobId,
            ray_job_id: opts.ray_job_id
        })
    },

    // Legacy compatibility methods
    deleteJob: (jobId) => {
        // Call the backend delete endpoint which will cancel remote job (best-effort) and remove local DB records
        return client.post('/finetuning/jobs/delete', { fine_tuning_job_id: jobId })
    },

    // Get available base models (to be implemented on backend)
    getBaseModels: () => {
        // Return common models for now
        return Promise.resolve({
            data: [
                'meta-llama/Llama-2-7b-chat-hf',
                'meta-llama/Llama-2-7b-hf',
                'meta-llama/Llama-2-13b-hf',
                'BAAI/bge-reranker-large',
                'BAAI/bge-base-en-v1.5',
                'Qwen/Qwen2.5-3B',
                'Qwen/Qwen2.5-7B'
            ]
        })
    }
}

export default finetuningApi