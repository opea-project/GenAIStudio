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

    // Delete an evaluation run
    deleteRun: (runId) => client.delete(`/evaluation/runs/${runId}`),

    // Delete a dataset
    deleteDataset: (datasetId) => client.delete(`/evaluation/datasets/${datasetId}`),
}

export default evaluationApi
