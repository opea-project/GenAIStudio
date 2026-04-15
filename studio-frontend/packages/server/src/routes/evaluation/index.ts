import express from 'express'
import axios from 'axios'
import { Request, Response, NextFunction } from 'express'

const router: express.Router = express.Router()

const STUDIO_SERVER_URL = process.env.STUDIO_SERVER_URL || 'http://studio-backend.studio.svc.cluster.local:5000'

/**
 * Generic proxy helper – forwards a request to studio-backend and pipes the response back.
 */
const proxy = async (
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    targetPath: string,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const url = `${STUDIO_SERVER_URL}/${targetPath}`
        const response = await axios({
            method,
            url,
            data: ['post', 'put', 'patch'].includes(method) ? req.body : undefined,
            params: req.query,
            headers: { 'Content-Type': 'application/json' },
            timeout: 60_000
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

// POST /api/v1/evaluation/models/pull → studio-backend/evaluation/models/pull
router.post('/models/pull', (req: Request, res: Response, next: NextFunction) =>
    proxy('post', 'studio-backend/evaluation/models/pull', req, res, next)
)

// ── Datasets ──────────────────────────────────────────────────────────────────
router.get('/datasets', (req: Request, res: Response, next: NextFunction) =>
    proxy('get', 'studio-backend/evaluation/datasets', req, res, next)
)

router.get('/datasets/:id', (req: Request, res: Response, next: NextFunction) =>
    proxy('get', `studio-backend/evaluation/datasets/${req.params.id}`, req, res, next)
)

router.post('/datasets', (req: Request, res: Response, next: NextFunction) =>
    proxy('post', 'studio-backend/evaluation/datasets', req, res, next)
)

router.post('/datasets/synthesize', (req: Request, res: Response, next: NextFunction) =>
    proxy('post', 'studio-backend/evaluation/datasets/synthesize', req, res, next)
)

router.delete('/datasets/:id', (req: Request, res: Response, next: NextFunction) =>
    proxy('delete', `studio-backend/evaluation/datasets/${req.params.id}`, req, res, next)
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

router.delete('/runs/:id', (req: Request, res: Response, next: NextFunction) =>
    proxy('delete', `studio-backend/evaluation/runs/${req.params.id}`, req, res, next)
)

export default router
