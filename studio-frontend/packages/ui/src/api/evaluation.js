import client from './client'

const evaluationApi = {
    // ── Runs ──────────────────────────────────────────────────────────────────

    // List all evaluation runs
    getRuns: () => client.get('/evaluation/runs'),

    // Get a single evaluation run (used for polling)
    getRun: (runId) => client.get(`/evaluation/runs/${runId}`),

    // Create a new evaluation run
    createRun: (payload) => client.post('/evaluation/runs', payload),

    // ── Datasets ──────────────────────────────────────────────────────────────

    // List all golden datasets
    getDatasets: () => client.get('/evaluation/datasets'),

    // Get a single dataset
    getDataset: (datasetId) => client.get(`/evaluation/datasets/${datasetId}`),

    // Create a new dataset (manual entries)
    createDataset: (payload) => client.post('/evaluation/datasets', payload),

    // Synthesize a dataset from a sandbox
    synthesizeDataset: (payload) => client.post('/evaluation/datasets/synthesize', payload),

    // ── Lookup helpers (for modal dropdowns) ─────────────────────────────────

    // List sandboxes available for evaluation
    getSandboxes: () => client.get('/evaluation/sandboxes'),

    // List judge models available
    getModels: () => client.get('/evaluation/models'),

    // Pull/register a new judge model
    pullModel: (payload) => client.post('/evaluation/models/pull', payload),

    // Check files in sandbox Data Management (dataprep)
    getSandboxDataManagementFiles: (payload) => client.post('/evaluation/sandbox-files', payload),

    // Delete an evaluation run
    deleteRun: (runId) => client.delete(`/evaluation/runs/${runId}`),

    // Stop a running/pending evaluation run
    stopRun: (runId) => client.post(`/evaluation/runs/${runId}/stop`),

    // Delete a dataset
    deleteDataset: (datasetId) => client.delete(`/evaluation/datasets/${datasetId}`),

    // Stop a pending/synthesizing dataset job
    stopDataset: (datasetId) => client.post(`/evaluation/datasets/${datasetId}/stop`),

    // Update dataset metadata (name / description)
    updateDataset: (datasetId, payload) => client.put(`/evaluation/datasets/${datasetId}`, payload),

    // Update a single entry inside a dataset
    updateEntry: (datasetId, entryId, payload) =>
        client.put(`/evaluation/datasets/${datasetId}/entries/${entryId}`, payload),

    // Add one or more entries to an existing dataset
    addEntries: (datasetId, payload) => client.post(`/evaluation/datasets/${datasetId}/entries`, payload),

    // Delete a single entry from a dataset
    deleteEntry: (datasetId, entryId) =>
        client.delete(`/evaluation/datasets/${datasetId}/entries/${entryId}`),
}

export default evaluationApi
