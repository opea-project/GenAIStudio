import client from './client'

const finetuningApi = {
    // Get all fine-tuning jobs
    getAllJobs: () => client.get('/finetuning/jobs'),

    // Create new fine-tuning job with OpenAI API format
    createJob: (jobData) => {
        const payload = {
            model: jobData.model,
            training_file: jobData.training_file_id,
            validation_file: jobData.validation_file_id,
            hyperparameters: {
                n_epochs: jobData.hyperparameters.n_epochs,
                batch_size: jobData.hyperparameters.batch_size,
                learning_rate_multiplier: jobData.hyperparameters.learning_rate_multiplier,
                prompt_loss_weight: jobData.hyperparameters.prompt_loss_weight
            },
            suffix: jobData.suffix
        }
        
        return client.post('/finetuning/jobs', payload)
    },

    // Get specific fine-tuning job
    getJob: (jobId) => client.get(`/finetuning/jobs/${jobId}`),

    // Delete fine-tuning job
    deleteJob: (jobId) => client.delete(`/finetuning/jobs/${jobId}`),

    // Upload dataset file with suffix
    uploadFile: (file, suffix, onUploadProgress) => {
        const formData = new FormData()
        
        // Generate suffixed filename
        const fileExtension = '.' + file.name.split('.').pop()
        const baseFileName = file.name.replace(fileExtension, '')
        const suffixedFileName = `${baseFileName}-${suffix}${fileExtension}`
        
        // Append file with suffixed name
        formData.append('file', file, suffixedFileName)
        formData.append('purpose', 'fine-tune') // OpenAI API requirement
        formData.append('suffix', suffix)
        
        return client.post('/files/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            },
            onUploadProgress
        })
    },

    // Get available base models
    getBaseModels: () => client.get('/finetuning/models'),

    // Download fine-tuned model
    downloadModel: (jobId) => client.get(`/finetuning/jobs/${jobId}/download`, {
        responseType: 'blob'
    })
}

export default finetuningApi