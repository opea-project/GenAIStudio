import logging
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.eval_models import (
    EvalDatasetCreate,
    EvalDatasetResponse,
    EvalDatasetSummaryResponse,
    EvalRunCreate,
    EvalRunResponse,
    EvalRunSummaryResponse,
    ModelPullRequest,
    OllamaModelInfo,
    SynthesizeRequest,
)
from app.services import dataset_service, eval_service
from app.services.ollama_service import ensure_model, list_models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/eval", tags=["eval"])


# ---------------------------------------------------------------------------
# Eval runs
# ---------------------------------------------------------------------------


@router.post("/runs", response_model=EvalRunSummaryResponse, status_code=202)
async def create_eval_run(
    payload: EvalRunCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Kick off an eval run in the background and return immediately."""
    run = eval_service.create_eval_run(db, payload)
    background_tasks.add_task(eval_service._run_eval_job, run.id)
    return run


@router.get("/runs", response_model=List[EvalRunSummaryResponse])
def list_eval_runs(db: Session = Depends(get_db)):
    return eval_service.list_runs(db)


@router.get("/runs/{run_id}", response_model=EvalRunResponse)
def get_eval_run(run_id: str, db: Session = Depends(get_db)):
    run = eval_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Eval run {run_id} not found")
    return run


@router.delete("/runs/{run_id}", status_code=204)
def delete_eval_run(run_id: str, db: Session = Depends(get_db)):
    if not eval_service.delete_run(db, run_id):
        raise HTTPException(status_code=404, detail=f"Eval run {run_id} not found")


# ---------------------------------------------------------------------------
# Datasets
# Note: /datasets/synthesize MUST be registered before /datasets/{dataset_id}
# so FastAPI does not treat "synthesize" as an integer dataset_id.
# ---------------------------------------------------------------------------


@router.post("/datasets", response_model=EvalDatasetResponse, status_code=201)
def create_dataset(payload: EvalDatasetCreate, db: Session = Depends(get_db)):
    return dataset_service.create_dataset(db, payload)


@router.post("/datasets/synthesize", response_model=EvalDatasetResponse, status_code=201)
async def synthesize_dataset(
    payload: SynthesizeRequest,
    db: Session = Depends(get_db),
):
    """Generate a golden dataset with the DeepEval Synthesizer (blocking)."""
    try:
        return await dataset_service.synthesize_dataset(db, payload)
    except Exception as exc:
        logger.error("Dataset synthesis failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/datasets", response_model=List[EvalDatasetSummaryResponse])
def list_datasets(db: Session = Depends(get_db)):
    datasets = dataset_service.list_datasets(db)
    return [
        EvalDatasetSummaryResponse(
            id=ds.id,
            name=ds.name,
            description=ds.description,
            created_at=ds.created_at,
            updated_at=ds.updated_at,
            entry_count=len(ds.entries),
        )
        for ds in datasets
    ]


@router.get("/datasets/{dataset_id}", response_model=EvalDatasetResponse)
def get_dataset(dataset_id: int, db: Session = Depends(get_db)):
    dataset = dataset_service.get_dataset(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return dataset


@router.delete("/datasets/{dataset_id}", status_code=204)
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)):
    if not dataset_service.delete_dataset(db, dataset_id):
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")


# ---------------------------------------------------------------------------
# Ollama model management
# ---------------------------------------------------------------------------


@router.get("/models", response_model=List[OllamaModelInfo])
async def list_ollama_models():
    """List all models currently available in Ollama."""
    try:
        models = await list_models()
        return [
            OllamaModelInfo(
                name=m.get("name", ""),
                size=m.get("size"),
                digest=m.get("digest"),
            )
            for m in models
        ]
    except Exception as exc:
        logger.error("Failed to reach Ollama: %s", exc)
        raise HTTPException(status_code=502, detail=f"Failed to reach Ollama: {exc}")


@router.post("/models/pull", status_code=202)
async def pull_model(payload: ModelPullRequest, background_tasks: BackgroundTasks):
    """Trigger an async pull of an Ollama model."""
    background_tasks.add_task(ensure_model, payload.model_name)
    return {"message": f"Pulling model '{payload.model_name}' in the background"}
