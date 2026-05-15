import asyncio
import logging
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.eval_models import (
    AddEntriesRequest,
    AddEntriesResponse,
    EvalDatasetCreate,
    EvalDatasetEntryResponse,
    EvalDatasetEntryUpdate,
    EvalDatasetResponse,
    EvalDatasetSummaryResponse,
    EvalDatasetUpdate,
    EvalRunCreate,
    EvalRunResponse,
    EvalRunSummaryResponse,
    ModelPullRequest,
    OllamaModelInfo,
    SynthesizeFromDocRequest,
)
from app.services import dataset_service, eval_service
from app.services.ollama_service import ensure_model, get_pull_status, list_models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/eval", tags=["eval"])

ALLOWED_SYNTHESIS_FILE_EXTENSIONS = {".pdf", ".docx"}

def _resolve_synthesis_file_ext(filename: Optional[str]) -> str:
    file_ext = Path(filename).suffix.lower() if filename else ".pdf"
    if file_ext not in ALLOWED_SYNTHESIS_FILE_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_SYNTHESIS_FILE_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{file_ext}'. Supported types: {allowed}",
        )
    return file_ext

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


@router.post("/runs/{run_id}/stop", status_code=200)
def stop_eval_run(run_id: str, db: Session = Depends(get_db)):
    """Request cancellation of a pending or running eval job."""
    result = eval_service.stop_run(db, run_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Eval run {run_id} not found")
    return {"status": result}


# ---------------------------------------------------------------------------
# Datasets
# Note: /datasets/synthesize MUST be registered before /datasets/{dataset_id}
# so FastAPI does not treat "synthesize" as a dataset_id string that happens to match.
# ---------------------------------------------------------------------------


@router.post("/datasets", response_model=EvalDatasetResponse, status_code=201)
def create_dataset(payload: EvalDatasetCreate, db: Session = Depends(get_db)):
    return dataset_service.create_dataset(db, payload)


@router.post("/datasets/synthesize", response_model=EvalDatasetSummaryResponse, status_code=202)
async def synthesize_dataset(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    name: str = Form(...),
    model_name: str = Form(...),
    embed_model_name: str = Form("nomic-embed-text"),
    description: Optional[str] = Form(None),
    num_goldens: Optional[int] = Form(None),
    max_goldens_per_document: int = Form(2),
    max_contexts: int = Form(5),
    min_contexts: int = Form(1),
    average_chunks_per_context: int = Form(3),
    chunk_size: int = Form(1024),
    chunk_overlap: int = Form(0),
    num_evolutions: int = Form(1),
    input_quality: float = Form(0.4),
    llm_timeout: float = Form(0),
    async_mode: str = Form("false"),
    max_concurrent: int = Form(1),
):
    """Receive an uploaded document, build contexts via OllamaEmbeddingModel,
    and synthesize golden Q/A pairs with DeepEval in the background."""
    try:
        file_bytes = await file.read()
        file_ext = _resolve_synthesis_file_ext(file.filename)

        payload = SynthesizeFromDocRequest(
            name=name,
            description=description or None,
            model_name=model_name,
            embed_model_name=embed_model_name,
            target_goldens=num_goldens,
            max_goldens_per_context=max_goldens_per_document,
            max_contexts=max_contexts,
            max_context_length=average_chunks_per_context,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            num_evolutions=num_evolutions,
            input_quality_threshold=input_quality,
            llm_timeout=llm_timeout,
            async_mode=str(async_mode).lower() in ("true", "1", "yes"),
            max_concurrent=max_concurrent,
        )

        dataset = dataset_service.create_pending_dataset(db, payload)
        task = asyncio.create_task(
            dataset_service.run_synthesis_background(dataset.id, payload, file_bytes, file_ext)
        )
        dataset_service.register_synthesis_task(dataset.id, task)
        return EvalDatasetSummaryResponse(
            id=dataset.id,
            name=dataset.name,
            description=dataset.description,
            status="pending",
            error=None,
            completed_contexts=0,
            total_contexts=0,
            completed_goldens=0,
            target_goldens=(
                payload.target_goldens
                if payload.target_goldens is not None
                else payload.max_contexts * payload.max_goldens_per_context
            ),
            created_at=dataset.created_at,
            updated_at=dataset.updated_at,
            entry_count=0,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to create synthesis job: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/datasets", response_model=List[EvalDatasetSummaryResponse])
def list_datasets(db: Session = Depends(get_db)):
    datasets = dataset_service.list_datasets(db)
    return [
        EvalDatasetSummaryResponse(
            id=ds.id,
            name=ds.name,
            description=ds.description,
            status=ds.status,
            error=ds.error,
            completed_contexts=ds.completed_contexts,
            total_contexts=ds.total_contexts,
            completed_goldens=ds.completed_goldens,
            target_goldens=ds.target_goldens,
            created_at=ds.created_at,
            updated_at=ds.updated_at,
            entry_count=len(ds.entries),
        )
        for ds in datasets
    ]


@router.get("/datasets/{dataset_id}", response_model=EvalDatasetResponse)
def get_dataset(dataset_id: str, db: Session = Depends(get_db)):
    dataset = dataset_service.get_dataset(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return dataset


@router.delete("/datasets/{dataset_id}", status_code=204)
def delete_dataset(dataset_id: str, db: Session = Depends(get_db)):
    if not dataset_service.delete_dataset(db, dataset_id):
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")


@router.post("/datasets/{dataset_id}/stop", status_code=200)
def stop_dataset_synthesis(dataset_id: str, db: Session = Depends(get_db)):
    """Request cancellation of a pending or synthesizing dataset job."""
    result = dataset_service.stop_dataset(db, dataset_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return {"status": result}


@router.put("/datasets/{dataset_id}", response_model=EvalDatasetResponse)
def update_dataset(dataset_id: str, payload: EvalDatasetUpdate, db: Session = Depends(get_db)):
    dataset = dataset_service.update_dataset(db, dataset_id, payload)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return dataset


@router.post("/datasets/{dataset_id}/entries", response_model=AddEntriesResponse, status_code=201)
def add_entries(
    dataset_id: str,
    payload: AddEntriesRequest,
    db: Session = Depends(get_db),
):
    dataset = dataset_service.get_dataset(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    if dataset.status == "synthesizing":
        raise HTTPException(status_code=409, detail="Cannot add entries while dataset is synthesizing")
    new_entries = dataset_service.add_entries(db, dataset_id, payload)
    return AddEntriesResponse(added=len(new_entries), entries=new_entries)


@router.put("/datasets/{dataset_id}/entries/{entry_id}", response_model=EvalDatasetEntryResponse)
def update_entry(
    dataset_id: str,
    entry_id: int,
    payload: EvalDatasetEntryUpdate,
    db: Session = Depends(get_db),
):
    dataset = dataset_service.get_dataset(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    entry = dataset_service.update_entry(db, dataset_id, entry_id, payload)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Entry {entry_id} not found in dataset {dataset_id}")
    return entry


@router.delete("/datasets/{dataset_id}/entries/{entry_id}", status_code=204)
def delete_entry(
    dataset_id: str,
    entry_id: int,
    db: Session = Depends(get_db),
):
    dataset = dataset_service.get_dataset(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    if dataset.status == "synthesizing":
        raise HTTPException(status_code=409, detail="Cannot delete entries while dataset is synthesizing")
    if not dataset_service.delete_entry(db, dataset_id, entry_id):
        raise HTTPException(status_code=404, detail=f"Entry {entry_id} not found in dataset {dataset_id}")


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


@router.get("/models/pull/status")
async def get_model_pull_status():
    """Return current pull status for all models that have been requested."""
    return get_pull_status()


@router.post("/models/pull", status_code=202)
async def pull_model(payload: ModelPullRequest, background_tasks: BackgroundTasks):
    """Trigger an async pull of an Ollama model."""
    background_tasks.add_task(ensure_model, payload.model_name)
    return {"message": f"Pulling model '{payload.model_name}' in the background"}
