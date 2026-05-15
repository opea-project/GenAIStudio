import express from 'express'
import axios from 'axios'
import multer from 'multer'
import { Request, Response, NextFunction } from 'express'
import { parseDatasetUpload } from '../../services/evaluationUploads'

const router: express.Router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

const getStudioServerUrl = () => process.env.STUDIO_SERVER_URL || 'http://studio-backend.studio.svc.cluster.local:5000'

// URL template for fetching dataprep file list from a sandbox.
// Builds the dataprep GET URL for a given sandboxId.
// Uses PREPARE_DOC_REDIS_PREP_DNS env var (also used by studio-nginx for K8s proxying).
const getDataprepUrl = (sandboxId: string): string => {
    const dns =
        process.env.PREPARE_DOC_REDIS_PREP_DNS ||
        'opea-prepare-doc-redis-prep-0.$namespace.svc.cluster.local:6007'
    if (dns.includes('$namespace')) {
        // K8s direct: replace $namespace placeholder, prepend scheme, append path
        return `http://${dns.replace('$namespace', sandboxId)}/v1/dataprep/get`
    }
    // Proxy mode (local-nginx): DNS is a host only — pass sandbox via ?ns= query param
    return `http://${dns}/v1/dataprep/get?ns=${sandboxId}`
}

/**
 * Generic proxy helper – forwards a request to studio-backend and pipes the response back.
 */
const proxy = async (
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    targetPath: string,
    req: Request,
    res: Response,
    next: NextFunction,
    options?: {
        data?: unknown
        headers?: Record<string, string>
        timeout?: number
    }
) => {
    try {
        const url = `${getStudioServerUrl()}/${targetPath}`
        const hasOverrideData = Boolean(options && Object.prototype.hasOwnProperty.call(options, 'data'))
        const response = await axios({
            method,
            url,
            data: hasOverrideData ? options?.data : ['post', 'put', 'patch'].includes(method) ? req.body : undefined,
            params: req.query,
            headers: options?.headers || { 'Content-Type': 'application/json' },
            timeout: options?.timeout ?? 60_000
        })
        return res.status(response.status).json(response.data)
    } catch (error: unknown) {
        const err = error as any
        if (err?.response?.status) {
            return res.status(err.response.status).json(err.response.data)
        }
        next(error)
    }
}

// ── Sandboxes ─────────────────────────────────────────────────────────────────
// GET /api/v1/evaluation/sandboxes → studio-backend/sandbox/list
router.get('/sandboxes', (req: Request, res: Response, next: NextFunction) =>
    proxy('get', 'studio-backend/sandbox/list', req, res, next)
)

// ── Models ────────────────────────────────────────────────────────────────────
// GET /api/v1/evaluation/models → studio-backend/evaluation/models
router.get('/models', (req: Request, res: Response, next: NextFunction) =>
    proxy('get', 'studio-backend/evaluation/models', req, res, next)
)

// GET /api/v1/evaluation/models/pull/status → studio-backend/evaluation/models/pull/status
router.get('/models/pull/status', (req: Request, res: Response, next: NextFunction) =>
    proxy('get', 'studio-backend/evaluation/models/pull/status', req, res, next)
)

// POST /api/v1/evaluation/models/pull → studio-backend/evaluation/models/pull
router.post('/models/pull', (req: Request, res: Response, next: NextFunction) =>
    proxy('post', 'studio-backend/evaluation/models/pull', req, res, next)
)

// POST /api/v1/evaluation/sandbox-files
// Body: { sandbox_id: string }
// Uses the same path as sandbox app-frontend: app-nginx -> /v1/dataprep/get
router.post('/sandbox-files', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sandboxId = String(req.body?.sandbox_id || '')

        if (!sandboxId) {
            return res.status(400).json({ message: 'sandbox_id is required' })
        }

        const isValidNamespace = /^[a-z0-9-]+$/.test(sandboxId)
        if (!isValidNamespace) {
            return res.status(400).json({ message: 'Invalid sandbox_id' })
        }

        const url = getDataprepUrl(sandboxId)
        console.log(`[sandbox-files] Calling: POST ${url}`)
        let response: any
        try {
            response = await axios.post(
                url,
                {},
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 15_000,
                    proxy: false  // bypass corporate proxy; Docker bridge DNS resolves service names
                }
            )
        } catch (axiosErr: any) {
            const status = axiosErr?.response?.status
            const msg = axiosErr?.message
            const body = axiosErr?.response?.data
            console.error(`[sandbox-files] Request failed: status=${status} msg=${msg}`, body ?? '')
            if (status) {
                return res.status(status).json({ message: `Dataprep service returned ${status}`, detail: body })
            }
            return res.status(502).json({ message: `Cannot reach dataprep service: ${msg}`, url })
        }

        const data = response.data
        console.log(`[sandbox-files] Response:`, JSON.stringify(data).slice(0, 200))
        const files = Array.isArray(data) ? data : Array.isArray(data?.files) ? data.files : []

        return res.status(200).json({ files })
    } catch (error: unknown) {
        next(error)
    }
})

// ── Datasets ──────────────────────────────────────────────────────────────────
router.get('/datasets', (req: Request, res: Response, next: NextFunction) =>
    proxy('get', 'studio-backend/evaluation/datasets', req, res, next)
)

router.get('/datasets/:id', (req: Request, res: Response, next: NextFunction) =>
    proxy('get', `studio-backend/evaluation/datasets/${req.params.id}`, req, res, next)
)

router.post('/datasets', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payload = req.file ? parseDatasetUpload(req.file, req.body as Record<string, unknown>) : req.body
        return proxy('post', 'studio-backend/evaluation/datasets', req, res, next, { data: payload })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to process dataset upload.'
        return res.status(400).json({ message })
    }
})

router.post('/datasets/synthesize', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'A source file is required for synthesis.' })
        }
        const FormDataLib = require('form-data')
        const fd = new FormDataLib()
        fd.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype || 'application/octet-stream',
        })
        // Forward all text fields unchanged
        for (const [key, value] of Object.entries(req.body as Record<string, unknown>)) {
            if (value !== undefined && value !== null) {
                fd.append(key, String(value))
            }
        }
        return proxy('post', 'studio-backend/evaluation/datasets/synthesize', req, res, next, {
            data: fd,
            headers: fd.getHeaders(),
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to process synthesis upload.'
        return res.status(400).json({ message })
    }
})

router.put('/datasets/:id', (req: Request, res: Response, next: NextFunction) =>
    proxy('put', `studio-backend/evaluation/datasets/${req.params.id}`, req, res, next)
)

router.delete('/datasets/:id', (req: Request, res: Response, next: NextFunction) =>
    proxy('delete', `studio-backend/evaluation/datasets/${req.params.id}`, req, res, next)
)

router.post('/datasets/:id/stop', (req: Request, res: Response, next: NextFunction) =>
    proxy('post', `studio-backend/evaluation/datasets/${req.params.id}/stop`, req, res, next)
)

router.post('/datasets/:id/entries', (req: Request, res: Response, next: NextFunction) =>
    proxy('post', `studio-backend/evaluation/datasets/${req.params.id}/entries`, req, res, next)
)

router.put('/datasets/:id/entries/:entryId', (req: Request, res: Response, next: NextFunction) =>
    proxy('put', `studio-backend/evaluation/datasets/${req.params.id}/entries/${req.params.entryId}`, req, res, next)
)

router.delete('/datasets/:id/entries/:entryId', (req: Request, res: Response, next: NextFunction) =>
    proxy('delete', `studio-backend/evaluation/datasets/${req.params.id}/entries/${req.params.entryId}`, req, res, next)
)

// ── Runs ──────────────────────────────────────────────────────────────────────
router.get('/runs', (req: Request, res: Response, next: NextFunction) =>
    proxy('get', 'studio-backend/evaluation/runs', req, res, next)
)

router.get('/runs/:id', (req: Request, res: Response, next: NextFunction) =>
    proxy('get', `studio-backend/evaluation/runs/${req.params.id}`, req, res, next)
)

router.post('/runs', (req: Request, res: Response, next: NextFunction) =>
    proxy('post', 'studio-backend/evaluation/runs', req, res, next)
)

router.post('/runs/:id/stop', (req: Request, res: Response, next: NextFunction) =>
    proxy('post', `studio-backend/evaluation/runs/${req.params.id}/stop`, req, res, next)
)

router.delete('/runs/:id', (req: Request, res: Response, next: NextFunction) =>
    proxy('delete', `studio-backend/evaluation/runs/${req.params.id}`, req, res, next)
)

export default router
