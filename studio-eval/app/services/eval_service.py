import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.compat import ensure_pydantic_v2_apis
from app.db.database import SessionLocal
from app.db.schema import EvalDataset, EvalDatasetEntry, EvalRun, EvalRunResult
from app.models.eval_models import EvalRunCreate
from app.services.ollama_service import OllamaJudge, ensure_model
from app.services.response_collector import (  # noqa: PLC0415
    DEFAULT_SYSTEM_PROMPT,
    collect_response,
)

logger = logging.getLogger(__name__)

# Lazy import cache — avoids importing deepeval at module load time.
_METRIC_CLASSES: Optional[dict] = None

# ---------------------------------------------------------------------------
# In-process cancellation registry
# ---------------------------------------------------------------------------
_cancelled_runs: set = set()
_run_tasks: Dict[str, asyncio.Task] = {}


def request_run_cancellation(run_id: str) -> None:
    """Signal the background job for *run_id* to exit at its next checkpoint."""
    _cancelled_runs.add(run_id)
    task = _run_tasks.get(run_id)
    if task and not task.done():
        task.cancel()


def register_run_task(run_id: str, task: asyncio.Task) -> None:
    """Register the asyncio Task running an eval so it can be cancelled."""
    _run_tasks[run_id] = task


def stop_run(db: Session, run_id: str) -> Optional[str]:
    """Mark a run as stopped and register its cancellation.

    Returns the resulting status string, or None if the run was not found.
    """
    run = db.query(EvalRun).filter(EvalRun.id == run_id).first()
    if not run:
        return None
    if run.status not in ("pending", "running"):
        return run.status  # already finished — nothing to do
    request_run_cancellation(run_id)
    run.status = "stopped"
    run.completed_at = datetime.utcnow()
    db.commit()
    return "stopped"


def _normalize_context(context) -> List[str]:
    if context is None:
        return []

    if isinstance(context, str):
        stripped = context.strip()
        if not stripped:
            return []
        try:
            loaded = json.loads(stripped)
        except json.JSONDecodeError:
            return [stripped]
        return _normalize_context(loaded)

    if isinstance(context, (list, tuple, set)):
        normalized: List[str] = []
        for item in context:
            if item is None:
                continue
            if isinstance(item, str):
                stripped = item.strip()
                if stripped:
                    normalized.append(stripped)
            else:
                normalized.append(str(item))
        return normalized

    return [str(context)]


def _format_exception(exc: Exception) -> str:
    message = str(exc).strip()
    return message or exc.__class__.__name__


def _get_metric_classes() -> dict:
    global _METRIC_CLASSES
    if _METRIC_CLASSES is None:
        ensure_pydantic_v2_apis()
        from deepeval.metrics import (  # noqa: PLC0415
            AnswerRelevancyMetric,
            FaithfulnessMetric,
            HallucinationMetric,
        )

        _METRIC_CLASSES = {
            "AnswerRelevancy": AnswerRelevancyMetric,
            "Faithfulness": FaithfulnessMetric,
            "Hallucination": HallucinationMetric,
        }
    return _METRIC_CLASSES


# ---------------------------------------------------------------------------
# CRUD helpers
# ---------------------------------------------------------------------------


def create_eval_run(db: Session, payload: EvalRunCreate) -> EvalRun:
    dataset = db.query(EvalDataset).filter_by(id=payload.dataset_id).first()
    dataset_name_snap = dataset.name if dataset else None
    entries_snap = None
    if dataset:
        entries = db.query(EvalDatasetEntry).filter_by(dataset_id=dataset.id).all()
        entries_snap = [
            {
                "id": e.id,
                "input": e.input,
                "expected_output": e.expected_output,
                "context": e.context,
            }
            for e in entries
        ]

    run = EvalRun(
        name=payload.name,
        dataset_id=payload.dataset_id,
        sandbox_id=payload.sandbox_id,
        model_name=payload.model_name,
        metrics=payload.metrics,
        status="pending",
        system_prompt=payload.system_prompt,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
        request_model=payload.request_model,
        configuration_snapshot=payload.configuration_snapshot,
        dataset_name_snapshot=dataset_name_snap,
        dataset_entries_snapshot=entries_snap,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def get_run(db: Session, run_id: str) -> Optional[EvalRun]:
    from sqlalchemy.orm import joinedload
    return (
        db.query(EvalRun)
        .filter(EvalRun.id == run_id)
        .options(joinedload(EvalRun.results).joinedload(EvalRunResult.entry))
        .first()
    )


def list_runs(db: Session) -> List[EvalRun]:
    return db.query(EvalRun).all()


def delete_run(db: Session, run_id: str) -> bool:
    run = db.query(EvalRun).filter(EvalRun.id == run_id).first()
    if not run:
        return False
    # Signal background job to stop if active so it exits before the FK is gone.
    if run.status in ("pending", "running"):
        request_run_cancellation(run_id)
    db.delete(run)
    db.commit()
    return True


# ---------------------------------------------------------------------------
# Background job
# ---------------------------------------------------------------------------


def _raise_if_cancelled(run_id: str, checkpoint: str) -> None:
    if run_id not in _cancelled_runs:
        return
    logger.info("Eval run %s stopped at %s", run_id, checkpoint)
    raise asyncio.CancelledError()


async def _measure_metric(metric, test_case) -> None:
    """Use async DeepEval execution when available so task cancellation propagates."""
    async_measure = getattr(metric, "a_measure", None)
    if callable(async_measure):
        await async_measure(test_case)
        return
    await asyncio.to_thread(metric.measure, test_case)


async def _run_eval_job(run_id: str) -> None:  # noqa: C901
    """Background task that drives a full eval run.

    Lifecycle:
      pending → running → completed | failed
    """
    db: Session = SessionLocal()
    task = asyncio.current_task()
    if task is not None:
        register_run_task(run_id, task)

    try:
        run: Optional[EvalRun] = (
            db.query(EvalRun).filter(EvalRun.id == run_id).first()
        )
        if not run:
            logger.error("Eval run %s not found in DB", run_id)
            return

        _raise_if_cancelled(run_id, "startup")

        run.status = "running"
        db.commit()

        # --- ensure judge model -----------------------------------------------
        _raise_if_cancelled(run_id, "model preparation")
        await ensure_model(run.model_name)
        judge = OllamaJudge(model_name=run.model_name)

        metric_classes = _get_metric_classes()

        # --- load entries -------------------------------------------------------
        entries: List[EvalDatasetEntry] = (
            db.query(EvalDatasetEntry)
            .filter(EvalDatasetEntry.dataset_id == run.dataset_id)
            .all()
        )

        if not entries:
            run.status = "failed"
            run.error = "Dataset has no entries"
            run.completed_at = datetime.utcnow()
            db.commit()
            return

        run.total_count = len(entries)
        run.completed_count = 0
        db.commit()

        # --- process each entry ------------------------------------------------
        for entry in entries:
            _raise_if_cancelled(run_id, f"entry {entry.id} start")

            actual_output: Optional[str] = None
            metric_scores: Dict[str, dict] = {}
            all_passed = True
            reasons: List[str] = []
            normalized_context = _normalize_context(entry.context)

            try:
                actual_output = await collect_response(
                    sandbox_id=run.sandbox_id,
                    user_input=entry.input,
                    system_prompt=run.system_prompt or DEFAULT_SYSTEM_PROMPT,
                    temperature=run.temperature if run.temperature is not None else 0.4,
                    max_tokens=run.max_tokens if run.max_tokens is not None else 100,
                    request_model=run.request_model or "NA",
                )
                actual_output = actual_output or ""
                _raise_if_cancelled(run_id, f"entry {entry.id} response collection")

                from deepeval.test_case import LLMTestCase  # noqa: PLC0415

                test_case = LLMTestCase(
                    input=entry.input,
                    actual_output=actual_output,
                    expected_output=entry.expected_output or "",
                    context=normalized_context,
                    retrieval_context=normalized_context,
                )

                for metric_name in run.metrics:
                    _raise_if_cancelled(run_id, f"entry {entry.id} metric {metric_name} start")
                    cls = metric_classes.get(metric_name)
                    if cls is None:
                        logger.warning("Unknown metric '%s' — skipping", metric_name)
                        continue
                    try:
                        metric = cls(model=judge, threshold=0.5)
                        await _measure_metric(metric, test_case)
                        _raise_if_cancelled(run_id, f"entry {entry.id} metric {metric_name} completion")

                        score = getattr(metric, "score", None)
                        passed = getattr(metric, "success", None)
                        if passed is None and score is not None:
                            passed = score >= 0.5
                        reason = getattr(metric, "reason", None)

                        metric_scores[metric_name] = {
                            "score": score,
                            "passed": passed,
                            "reason": reason,
                        }
                        if not passed:
                            all_passed = False
                        if reason:
                            reasons.append(f"{metric_name}: {reason}")

                    except Exception as exc:
                        logger.error(
                            "Metric '%s' failed for entry %d: %s",
                            metric_name,
                            entry.id,
                            _format_exception(exc),
                        )
                        failure_reason = _format_exception(exc)
                        metric_scores[metric_name] = {
                            "score": None,
                            "passed": False,
                            "reason": failure_reason,
                        }
                        all_passed = False
                        reasons.append(f"{metric_name}: {failure_reason}")

            except Exception as exc:
                logger.error(
                    "Error processing entry %d: %s",
                    entry.id,
                    _format_exception(exc),
                )
                all_passed = False
                reasons.append(_format_exception(exc))

            _raise_if_cancelled(run_id, f"entry {entry.id} result persistence")

            db.add(
                EvalRunResult(
                    run_id=run.id,
                    entry_id=entry.id,
                    actual_output=actual_output,
                    metric_scores=metric_scores or None,
                    passed=all_passed,
                    reason="; ".join(reasons) if reasons else None,
                )
            )
            run.completed_count = (run.completed_count or 0) + 1
            db.commit()

        run.status = "completed"
        run.completed_at = datetime.utcnow()
        db.commit()
        logger.info("Eval run %s completed successfully", run_id)

    except asyncio.CancelledError:
        logger.info("Eval run %s cancelled", run_id)
        try:
            db.rollback()
            run = db.query(EvalRun).filter(EvalRun.id == run_id).first()
            if run and run.status in ("pending", "running"):
                run.status = "stopped"
                run.completed_at = datetime.utcnow()
                db.commit()
        except Exception as inner:
            logger.error("Could not persist stopped status for run %s: %s", run_id, inner)
    except Exception as exc:
        logger.error("Eval run %s failed with unhandled error: %s", run_id, exc)
        try:
            run = db.query(EvalRun).filter(EvalRun.id == run_id).first()
            if run:
                run.status = "failed"
                run.error = str(exc)
                run.completed_at = datetime.utcnow()
                db.commit()
        except Exception as inner:
            logger.error("Could not persist failed status for run %s: %s", run_id, inner)
    finally:
        _run_tasks.pop(run_id, None)
        _cancelled_runs.discard(run_id)
        db.close()
