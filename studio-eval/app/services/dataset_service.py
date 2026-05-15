import asyncio
import json
import logging
import math
import multiprocessing
import os
import tempfile
from queue import Empty
from typing import Any, Dict, List, Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.compat import ensure_pydantic_v2_apis
from app.db.database import SessionLocal
from app.db.schema import EvalDataset, EvalDatasetEntry
from app.models.eval_models import (
    AddEntriesRequest,
    EvalDatasetCreate,
    EvalDatasetEntryUpdate,
    EvalDatasetUpdate,
    SynthesizeFromDocRequest,
    SynthesizeRequest,
)
from app.services.ollama_service import OllamaEmbeddingModel, OllamaJudge, ensure_model

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-process cancellation registry
# ---------------------------------------------------------------------------
_cancelled_datasets: set = set()
_synthesis_tasks: Dict[str, asyncio.Task] = {}
_synthesis_processes: Dict[str, multiprocessing.Process] = {}

def request_dataset_cancellation(dataset_id: str) -> None:
    """Signal the background synthesis job for *dataset_id* to exit at its next checkpoint."""
    _cancelled_datasets.add(dataset_id)
    process = _synthesis_processes.get(dataset_id)
    if process and process.is_alive():
        process.terminate()
    task = _synthesis_tasks.get(dataset_id)
    if task and not task.done():
        task.cancel()


def register_synthesis_task(dataset_id: str, task: asyncio.Task) -> None:
    """Register the asyncio Task running synthesis so it can be cancelled."""
    _synthesis_tasks[dataset_id] = task


def stop_dataset(db: Session, dataset_id: str) -> Optional[str]:
    """Mark a dataset synthesis as stopped and register its cancellation.

    Returns the resulting status string, or None if the dataset was not found.
    """
    dataset = db.query(EvalDataset).filter(EvalDataset.id == dataset_id).first()
    if not dataset:
        return None
    if dataset.status not in ("pending", "synthesizing"):
        return dataset.status  # already finished — nothing to do
    request_dataset_cancellation(dataset_id)
    dataset.status = "stopped"
    db.commit()
    return "stopped"


def _normalize_context(context) -> Optional[List[str]]:
    if context is None:
        return None

    if isinstance(context, str):
        stripped = context.strip()
        if not stripped:
            return None
        try:
            loaded = json.loads(stripped)
        except json.JSONDecodeError:
            return [stripped]
        return _normalize_context(loaded)

    if isinstance(context, (list, tuple, set)):
        normalized = []
        for item in context:
            if item is None:
                continue
            if isinstance(item, str):
                stripped = item.strip()
                if stripped:
                    normalized.append(stripped)
            else:
                normalized.append(str(item))
        return normalized or None

    return [str(context)]


def _goldens_to_records(goldens: list) -> List[Dict[str, Any]]:
    return [
        {
            "input": getattr(golden, "input", None),
            "expected_output": getattr(golden, "expected_output", None),
            "context": getattr(golden, "context", None),
        }
        for golden in goldens
    ]


def _update_golden_progress(db: Session, dataset_id: str, completed_goldens: int) -> None:
    """Persist the current golden count so the UI can poll progress."""
    try:
        dataset = db.query(EvalDataset).filter(EvalDataset.id == dataset_id).first()
        if dataset and dataset.status == "synthesizing":
            dataset.completed_goldens = completed_goldens
            db.commit()
    except Exception:
        logger.debug("Failed to update golden progress for %s", dataset_id, exc_info=True)
        try:
            db.rollback()
        except Exception:
            pass


def _start_synthesis_process(
    dataset_id: str,
    tmp_path: str,
    payload: SynthesizeFromDocRequest,
):
    ctx = multiprocessing.get_context("spawn")
    result_queue = ctx.Queue()
    process = ctx.Process(
        target=_run_synthesizer_from_docs_worker,
        args=(tmp_path, payload.dict(), result_queue),
        daemon=True,
    )
    process.start()
    _synthesis_processes[dataset_id] = process
    return process, result_queue


def _stop_synthesis_process(dataset_id: str, process: Optional[multiprocessing.Process]) -> None:
    if process is None:
        return
    try:
        if process.is_alive():
            process.terminate()
            process.join(timeout=1)
        elif process.exitcode is None:
            process.join(timeout=1)
        if process.is_alive():
            process.kill()
            process.join(timeout=1)
    except Exception:
        logger.warning("Failed to stop synthesis process for dataset %s", dataset_id, exc_info=True)
    finally:
        _synthesis_processes.pop(dataset_id, None)


async def _wait_for_synthesis_process_result(
    dataset_id: str,
    process: multiprocessing.Process,
    result_queue,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Consume messages from the synthesis child process.

    The child sends:
    * ``{"type": "progress", "completed_goldens": N, "batch": [...]}``
      after each context's goldens are generated.
    * ``{"type": "done"}`` when generation finishes successfully.
    * ``{"type": "error", "message": "..."}`` on failure.

    Legacy callers that send a single ``{"records": [...]}`` or
    ``{"error": "..."}`` dict are still supported.
    """
    all_records: List[Dict[str, Any]] = []

    while True:
        if dataset_id in _cancelled_datasets:
            raise asyncio.CancelledError()

        try:
            msg = await asyncio.to_thread(result_queue.get, True, 0.25)
        except Empty:
            if process.is_alive():
                continue
            # Process exited without a message — fall through to drain.
            break

        msg_type = msg.get("type")

        if msg_type == "progress":
            batch = msg.get("batch") or []
            all_records.extend(batch)
            completed = msg.get("completed_goldens", len(all_records))
            if db is not None:
                _update_golden_progress(db, dataset_id, completed)
            continue

        if msg_type == "done":
            await asyncio.to_thread(process.join, 1)
            return {"records": all_records}

        if msg_type == "error":
            await asyncio.to_thread(process.join, 1)
            return {"error": msg.get("message", "Unknown error")}

        # Legacy single-shot protocol (no "type" key).
        await asyncio.to_thread(process.join, 1)
        return msg

    # Process died — try to drain one last message.
    await asyncio.to_thread(process.join, 1)

    try:
        msg = await asyncio.to_thread(result_queue.get, True, 1)
        if msg.get("type") == "error":
            return {"error": msg.get("message", "Unknown error")}
        if msg.get("type") == "progress":
            all_records.extend(msg.get("batch") or [])
        elif "records" in msg or "error" in msg:
            return msg
    except Empty:
        pass

    if all_records:
        return {"records": all_records}

    if process.exitcode in (0, None):
        raise RuntimeError("Synthesis process exited without returning results")
    raise RuntimeError(f"Synthesis process exited with code {process.exitcode}")


# ---------------------------------------------------------------------------
# CRUD helpers
# ---------------------------------------------------------------------------


def create_dataset(db: Session, payload: EvalDatasetCreate) -> EvalDataset:
    dataset = EvalDataset(name=payload.name, description=payload.description)
    db.add(dataset)
    db.flush()  # obtain the generated id before inserting entries

    for entry_data in payload.entries or []:
        db.add(
            EvalDatasetEntry(
                dataset_id=dataset.id,
                input=entry_data.input,
                expected_output=entry_data.expected_output,
                context=_normalize_context(entry_data.context),
            )
        )

    db.commit()
    db.refresh(dataset)
    return dataset


def get_dataset(db: Session, dataset_id: str) -> Optional[EvalDataset]:
    return db.query(EvalDataset).filter(EvalDataset.id == dataset_id).first()


def list_datasets(db: Session) -> List[EvalDataset]:
    return db.query(EvalDataset).all()


def delete_dataset(db: Session, dataset_id: str) -> bool:
    dataset = get_dataset(db, dataset_id)
    if not dataset:
        return False
    # Signal background job to stop if active so it exits before the FK is gone.
    if dataset.status in ("pending", "synthesizing"):
        request_dataset_cancellation(dataset_id)
    db.delete(dataset)
    db.commit()
    return True


def update_dataset(db: Session, dataset_id: str, payload: EvalDatasetUpdate) -> Optional[EvalDataset]:
    dataset = get_dataset(db, dataset_id)
    if not dataset:
        return None
    updates = payload.dict(exclude_none=True)
    for field, value in updates.items():
        setattr(dataset, field, value)
    db.commit()
    db.refresh(dataset)
    return dataset


def get_entry(db: Session, dataset_id: str, entry_id: int) -> Optional[EvalDatasetEntry]:
    return (
        db.query(EvalDatasetEntry)
        .filter(EvalDatasetEntry.id == entry_id, EvalDatasetEntry.dataset_id == dataset_id)
        .first()
    )


def update_entry(
    db: Session, dataset_id: str, entry_id: int, payload: EvalDatasetEntryUpdate
) -> Optional[EvalDatasetEntry]:
    entry = get_entry(db, dataset_id, entry_id)
    if not entry:
        return None
    if payload.input is not None:
        entry.input = payload.input
    if payload.expected_output is not None:
        entry.expected_output = payload.expected_output
    if payload.context is not None:
        entry.context = _normalize_context(payload.context)
    db.commit()
    db.refresh(entry)
    return entry


def add_entries(db: Session, dataset_id: str, payload: AddEntriesRequest) -> List[EvalDatasetEntry]:
    dataset = get_dataset(db, dataset_id)
    if not dataset:
        return []
    new_entries = []
    for entry_data in payload.entries:
        entry = EvalDatasetEntry(
            dataset_id=dataset_id,
            input=entry_data.input,
            expected_output=entry_data.expected_output,
            context=_normalize_context(entry_data.context),
        )
        db.add(entry)
        new_entries.append(entry)
    db.commit()
    for entry in new_entries:
        db.refresh(entry)
    return new_entries


def delete_entry(db: Session, dataset_id: str, entry_id: int) -> bool:
    entry = get_entry(db, dataset_id, entry_id)
    if not entry:
        return False
    db.delete(entry)
    db.commit()
    return True


# ---------------------------------------------------------------------------
# DeepEval Synthesizer → pandas → MySQL
# ---------------------------------------------------------------------------


def _run_synthesizer(payload: SynthesizeRequest, judge: OllamaJudge, contexts: List[List[str]], max_per_context: int):
    """Blocking call to DeepEval Synthesizer — run via asyncio.to_thread."""
    ensure_pydantic_v2_apis()
    from deepeval.synthesizer import Synthesizer  # noqa: PLC0415
    from deepeval.synthesizer.config import EvolutionConfig, FiltrationConfig  # noqa: PLC0415

    synthesizer = Synthesizer(
        model=judge,
        async_mode=payload.async_mode,
        max_concurrent=payload.max_concurrent,
        filtration_config=FiltrationConfig(
            synthetic_input_quality_threshold=payload.input_quality_threshold,
            critic_model=judge,
        ),
        evolution_config=EvolutionConfig(num_evolutions=payload.num_evolutions),
    )
    return synthesizer.generate_goldens_from_contexts(
        contexts=contexts,
        max_goldens_per_context=max_per_context,
    )


def _resolve_doc_generation_limits(payload: SynthesizeFromDocRequest) -> tuple[int, int]:
    max_contexts = max(payload.max_contexts, 1)
    max_goldens_per_context = max(payload.max_goldens_per_context, 1)

    if payload.target_goldens is None:
        return max_contexts, max_goldens_per_context

    target_goldens = max(payload.target_goldens, 1)
    best_plan: Optional[tuple[int, int]] = None
    best_total: Optional[int] = None

    for contexts in range(1, max_contexts + 1):
        goldens_per_context = math.ceil(target_goldens / contexts)
        if goldens_per_context > max_goldens_per_context:
            continue
        total_goldens = contexts * goldens_per_context
        if (
            best_plan is None
            or total_goldens < best_total
            or (total_goldens == best_total and contexts > best_plan[0])
        ):
            best_plan = (contexts, goldens_per_context)
            best_total = total_goldens

    if best_plan is not None:
        return best_plan

    return max_contexts, math.ceil(target_goldens / max_contexts)


def _run_synthesizer_from_docs(
    tmp_path: str,
    payload: SynthesizeFromDocRequest,
    judge: OllamaJudge,
    embedder: OllamaEmbeddingModel,
    progress_queue=None,
) -> list:
    """Blocking call to DeepEval Synthesizer.generate_goldens_from_docs.

    When *progress_queue* is provided the synthesizer processes one context
    at a time and pushes a progress message after each context so the parent
    process can update the DB (and therefore the UI) incrementally.
    """
    ensure_pydantic_v2_apis()
    from app.compat import patch_deepeval_document_chunker  # noqa: PLC0415
    patch_deepeval_document_chunker()
    from deepeval.synthesizer import Synthesizer  # noqa: PLC0415
    from deepeval.synthesizer.config import (  # noqa: PLC0415
        ContextConstructionConfig,
        EvolutionConfig,
        FiltrationConfig,
    )

    # When a progress queue is available, subclass the synthesizer so that
    # ``generate_goldens_from_contexts`` runs one context at a time and
    # sends each batch through the queue as a small message (avoiding the
    # pipe-buffer deadlock that occurs when the full result set is sent in
    # a single ``queue.put``).
    if progress_queue is not None:
        class _ProgressSynthesizer(Synthesizer):  # noqa: N801
            def generate_goldens_from_contexts(self, contexts, *args, **kwargs):
                all_goldens = []
                for context in contexts:
                    batch = super().generate_goldens_from_contexts(
                        [context], *args, **kwargs
                    )
                    all_goldens.extend(batch)
                    try:
                        progress_queue.put({
                            "type": "progress",
                            "completed_goldens": len(all_goldens),
                            "batch": _goldens_to_records(batch),
                        })
                    except Exception:
                        pass
                return all_goldens

        SynthesizerClass = _ProgressSynthesizer
    else:
        SynthesizerClass = Synthesizer

    synthesizer = SynthesizerClass(
        model=judge,
        async_mode=payload.async_mode,
        max_concurrent=payload.max_concurrent,
        filtration_config=FiltrationConfig(
            synthetic_input_quality_threshold=payload.input_quality_threshold,
            critic_model=judge,
        ),
        evolution_config=EvolutionConfig(num_evolutions=payload.num_evolutions),
    )
    max_contexts_per_document, max_goldens_per_context = _resolve_doc_generation_limits(payload)
    return synthesizer.generate_goldens_from_docs(
        document_paths=[tmp_path],
        include_expected_output=True,
        max_goldens_per_context=max_goldens_per_context,
        context_construction_config=ContextConstructionConfig(
            embedder=embedder,
            critic_model=judge,
            chunk_size=payload.chunk_size,
            chunk_overlap=payload.chunk_overlap,
            max_context_length=payload.max_context_length,
            max_contexts_per_document=max_contexts_per_document,
        ),
    )


def _run_synthesizer_from_docs_worker(
    tmp_path: str,
    payload_data: Dict[str, Any],
    result_queue,
) -> None:
    payload = SynthesizeFromDocRequest(**payload_data)
    judge = OllamaJudge(model_name=payload.model_name, timeout=payload.llm_timeout)
    embedder = OllamaEmbeddingModel(model_name=payload.embed_model_name)

    try:
        # progress_queue=result_queue makes the synthesizer send small
        # per-context batches instead of one giant payload at the end,
        # which avoids the pipe-buffer deadlock.
        _run_synthesizer_from_docs(
            tmp_path, payload, judge, embedder, progress_queue=result_queue,
        )
        result_queue.put({"type": "done"})
    except Exception as exc:
        message = str(exc).strip() or exc.__class__.__name__
        logger.exception("Document synthesis worker failed for %s", tmp_path)
        result_queue.put({"type": "error", "message": message})


async def synthesize_dataset(db: Session, payload: SynthesizeRequest) -> EvalDataset:
    """Generate a golden dataset with DeepEval Synthesizer and persist it.

    Steps:
    1. ensure_model — pull the judge model if absent.
    2. Run Synthesizer in a thread (blocking LLM calls).
    3. Normalise goldens with pandas (drop rows with null input).
    4. Persist EvalDataset + EvalDatasetEntry rows.
    """
    await ensure_model(payload.model_name)
    judge = OllamaJudge(model_name=payload.model_name, timeout=payload.llm_timeout)

    logger.info(
        "Synthesizing dataset '%s': %d contexts, target=%d, %d goldens each, async=%s, max_concurrent=%d",
        payload.name,
        len(payload.contexts),
        payload.target_goldens,
        payload.num_goldens_per_context,
        payload.async_mode,
        payload.max_concurrent,
    )

    goldens = await asyncio.to_thread(
        _run_synthesizer,
        payload,
        judge,
        payload.contexts,
        payload.num_goldens_per_context,
    )

    # Normalise with pandas
    records = _goldens_to_records(goldens)

    df = pd.DataFrame(records)
    df = df.dropna(subset=["input"]).reset_index(drop=True)

    if payload.target_goldens and len(df) > payload.target_goldens:
        df = df.head(payload.target_goldens).reset_index(drop=True)

    if df.empty:
        raise ValueError("Synthesizer returned no valid goldens (all inputs were null)")

    dataset = EvalDataset(name=payload.name, description=payload.description)
    db.add(dataset)
    db.flush()

    for _, row in df.iterrows():
        db.add(
            EvalDatasetEntry(
                dataset_id=dataset.id,
                input=row["input"],
                expected_output=row.get("expected_output"),
                context=_normalize_context(row.get("context")),
            )
        )

    db.commit()
    db.refresh(dataset)
    logger.info("Synthesized dataset '%s' with %d entries", dataset.name, len(df))
    return dataset


# ---------------------------------------------------------------------------
# Background synthesis helpers (non-blocking endpoint pattern)
# ---------------------------------------------------------------------------


def create_pending_dataset(db: Session, payload: SynthesizeFromDocRequest) -> EvalDataset:
    """Create a dataset record with status='pending' and return immediately."""
    dataset = EvalDataset(
        name=payload.name,
        description=payload.description,
        status="pending",
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset


async def run_synthesis_background(
    dataset_id: str,
    payload: SynthesizeFromDocRequest,
    file_bytes: bytes,
    file_ext: str,
) -> None:
    """Background task: synthesize a dataset from an uploaded document file.

    Writes the file to a temp path, calls DeepEval's generate_goldens_from_docs
    with OllamaEmbeddingModel for chunking/context construction, then persists
    the resulting goldens.  Cleans up the temp file on exit.
    """
    tmp_path: Optional[str] = None
    synthesis_process: Optional[multiprocessing.Process] = None
    result_queue = None
    db: Session = SessionLocal()
    try:
        dataset = db.query(EvalDataset).filter(EvalDataset.id == dataset_id).first()
        if not dataset:
            logger.error("Background synthesis: dataset %s not found", dataset_id)
            return
        dataset.status = "synthesizing"
        dataset.total_contexts = 0
        dataset.completed_contexts = 0
        # When target_goldens is not set by the user, use the computed maximum
        # (max_contexts × max_goldens_per_context) so the UI progress bar
        # always has a denominator.  DeepEval may produce fewer goldens than
        # this estimate (quality filtering), so it is only an upper bound.
        dataset.target_goldens = (
            payload.target_goldens
            if payload.target_goldens is not None
            else payload.max_contexts * payload.max_goldens_per_context
        )
        dataset.completed_goldens = 0
        db.commit()

        # Cancellation check before pulling models / writing file.
        if dataset_id in _cancelled_datasets:
            _cancelled_datasets.discard(dataset_id)
            logger.info("Synthesis for dataset %s cancelled before start", dataset_id)
            return

        # Ensure both models are available (pull if absent).
        await ensure_model(payload.model_name)
        await ensure_model(payload.embed_model_name)

        judge = OllamaJudge(model_name=payload.model_name, timeout=payload.llm_timeout)
        embedder = OllamaEmbeddingModel(model_name=payload.embed_model_name)

        # Write document bytes to a temporary file that DeepEval can read.
        suffix = file_ext if file_ext.startswith(".") else f".{file_ext}"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        logger.info(
            "Background synthesis for dataset %s '%s': embed=%s, file=%s, target=%s",
            dataset_id, payload.name, payload.embed_model_name, tmp_path, payload.target_goldens,
        )

        # Final cancellation check before the expensive synthesizer call.
        if dataset_id in _cancelled_datasets:
            _cancelled_datasets.discard(dataset_id)
            logger.info("Synthesis for dataset %s cancelled before synthesizer", dataset_id)
            return

        synthesis_process, result_queue = _start_synthesis_process(dataset_id, tmp_path, payload)
        worker_result = await _wait_for_synthesis_process_result(
            dataset_id, synthesis_process, result_queue, db=db,
        )

        if worker_result.get("error"):
            raise RuntimeError(worker_result["error"])

        records = worker_result.get("records") or []

        # Cancellation check after synthesis, before DB write.
        if dataset_id in _cancelled_datasets:
            _cancelled_datasets.discard(dataset_id)
            logger.info("Synthesis for dataset %s cancelled after synthesizer", dataset_id)
            return

        df = pd.DataFrame(records)
        df = df.dropna(subset=["input"]).reset_index(drop=True)

        if payload.target_goldens and len(df) > payload.target_goldens:
            df = df.head(payload.target_goldens).reset_index(drop=True)

        if df.empty:
            raise ValueError("Synthesizer returned no valid goldens (all inputs were null)")

        dataset = db.query(EvalDataset).filter(EvalDataset.id == dataset_id).first()
        for _, row in df.iterrows():
            db.add(
                EvalDatasetEntry(
                    dataset_id=dataset.id,
                    input=row["input"],
                    expected_output=row.get("expected_output"),
                    context=_normalize_context(row.get("context")),
                )
            )
        dataset.status = "completed"
        dataset.completed_goldens = len(df)
        dataset.error = None
        db.commit()
        logger.info("Background synthesis completed for dataset %s with %d entries", dataset_id, len(df))

    except asyncio.CancelledError:
        _stop_synthesis_process(dataset_id, synthesis_process)
        logger.info("Synthesis task for dataset %s was cancelled", dataset_id)
        # Status was already set to 'stopped' by stop_dataset / request_dataset_cancellation.
    except Exception as exc:
        logger.error("Background synthesis failed for dataset %s: %s", dataset_id, exc)
        try:
            dataset = db.query(EvalDataset).filter(EvalDataset.id == dataset_id).first()
            if dataset:
                dataset.status = "failed"
                dataset.error = str(exc)
                db.commit()
        except Exception:
            pass
    finally:
        _stop_synthesis_process(dataset_id, synthesis_process)
        if result_queue is not None:
            try:
                result_queue.close()
                result_queue.join_thread()
            except Exception:
                logger.debug("Failed to close synthesis result queue for dataset %s", dataset_id, exc_info=True)
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        _synthesis_tasks.pop(dataset_id, None)
        _cancelled_datasets.discard(dataset_id)
        db.close()
