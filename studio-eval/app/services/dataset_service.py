import asyncio
import json
import logging
from typing import List, Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.db.schema import EvalDataset, EvalDatasetEntry
from app.models.eval_models import EvalDatasetCreate, SynthesizeRequest
from app.services.ollama_service import OllamaJudge, ensure_model

logger = logging.getLogger(__name__)


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


def get_dataset(db: Session, dataset_id: int) -> Optional[EvalDataset]:
    return db.query(EvalDataset).filter(EvalDataset.id == dataset_id).first()


def list_datasets(db: Session) -> List[EvalDataset]:
    return db.query(EvalDataset).all()


def delete_dataset(db: Session, dataset_id: int) -> bool:
    dataset = get_dataset(db, dataset_id)
    if not dataset:
        return False
    db.delete(dataset)
    db.commit()
    return True


# ---------------------------------------------------------------------------
# DeepEval Synthesizer → pandas → MySQL
# ---------------------------------------------------------------------------


def _run_synthesizer(judge: OllamaJudge, contexts: List[List[str]], max_per_context: int):
    """Blocking call to DeepEval Synthesizer — run via asyncio.to_thread."""
    from deepeval.synthesizer import Synthesizer  # noqa: PLC0415

    synthesizer = Synthesizer(model=judge)
    return synthesizer.generate_goldens_from_contexts(
        contexts=contexts,
        max_goldens_per_context=max_per_context,
    )


async def synthesize_dataset(db: Session, payload: SynthesizeRequest) -> EvalDataset:
    """Generate a golden dataset with DeepEval Synthesizer and persist it.

    Steps:
    1. ensure_model — pull the judge model if absent.
    2. Run Synthesizer in a thread (blocking LLM calls).
    3. Normalise goldens with pandas (drop rows with null input).
    4. Persist EvalDataset + EvalDatasetEntry rows.
    """
    await ensure_model(payload.model_name)
    judge = OllamaJudge(model_name=payload.model_name)

    logger.info(
        "Synthesizing dataset '%s': %d contexts, %d goldens each",
        payload.name,
        len(payload.contexts),
        payload.num_goldens_per_context,
    )

    goldens = await asyncio.to_thread(
        _run_synthesizer,
        judge,
        payload.contexts,
        payload.num_goldens_per_context,
    )

    # Normalise with pandas
    records = [
        {
            "input": getattr(g, "input", None),
            "expected_output": getattr(g, "expected_output", None),
            "context": getattr(g, "context", None),
        }
        for g in goldens
    ]

    df = pd.DataFrame(records)
    df = df.dropna(subset=["input"]).reset_index(drop=True)

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
