from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from pydantic import BaseModel, validator

# ---------------------------------------------------------------------------
# Supported DeepEval metrics
# ---------------------------------------------------------------------------

SUPPORTED_METRICS: Set[str] = {
    "AnswerRelevancy",
    "Faithfulness",
    "Hallucination",
}

# ---------------------------------------------------------------------------
# Dataset Entry
# ---------------------------------------------------------------------------


class EvalDatasetEntryCreate(BaseModel):
    input: str
    expected_output: Optional[str] = None
    context: Optional[List[str]] = None


class EvalDatasetEntryResponse(BaseModel):
    id: int
    dataset_id: int
    input: str
    expected_output: Optional[str] = None
    context: Optional[List[str]] = None
    created_at: datetime

    class Config:
        orm_mode = True


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------


class EvalDatasetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    entries: Optional[List[EvalDatasetEntryCreate]] = []


class EvalDatasetResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    entries: List[EvalDatasetEntryResponse] = []

    class Config:
        orm_mode = True


class EvalDatasetSummaryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    entry_count: int = 0

    class Config:
        orm_mode = True


# ---------------------------------------------------------------------------
# Synthesis request
# ---------------------------------------------------------------------------


class SynthesizeRequest(BaseModel):
    name: str
    description: Optional[str] = None
    contexts: List[List[str]]
    model_name: str
    num_goldens_per_context: int = 2

    @validator("contexts")
    def contexts_not_empty(cls, v):
        if not v:
            raise ValueError("contexts must not be empty")
        return v

    @validator("num_goldens_per_context")
    def goldens_positive(cls, v):
        if v < 1:
            raise ValueError("num_goldens_per_context must be >= 1")
        return v


# ---------------------------------------------------------------------------
# Eval Run
# ---------------------------------------------------------------------------


class EvalRunCreate(BaseModel):
    name: str
    dataset_id: int
    sandbox_id: str
    model_name: str
    metrics: List[str]
    configuration_snapshot: Optional[Dict[str, Any]] = None
    # Optional app-backend request parameters.
    # Context for Faithfulness / AnswerRelevancy is always taken from the
    # dataset entries so that RAG evaluation works even when the backend
    # does not return retrieval context in its response.
    system_prompt: Optional[str] = "You are a helpful assistant"
    temperature: Optional[float] = 0.4
    max_tokens: Optional[int] = 100
    request_model: Optional[str] = "NA"

    @validator("metrics")
    def validate_metrics(cls, v):
        if not v:
            raise ValueError("At least one metric must be specified")
        invalid = set(v) - SUPPORTED_METRICS
        if invalid:
            raise ValueError(
                f"Unsupported metrics: {sorted(invalid)}. "
                f"Supported: {sorted(SUPPORTED_METRICS)}"
            )
        return v


class MetricScoreDetail(BaseModel):
    score: Optional[float] = None
    passed: Optional[bool] = None
    reason: Optional[str] = None


class EvalRunResultResponse(BaseModel):
    id: int
    run_id: str
    entry_id: int
    actual_output: Optional[str] = None
    metric_scores: Optional[Dict[str, Any]] = None
    passed: Optional[bool] = None
    reason: Optional[str] = None
    created_at: datetime
    entry: Optional[EvalDatasetEntryResponse] = None

    class Config:
        orm_mode = True


class EvalRunSummaryResponse(BaseModel):
    id: str
    name: str
    dataset_id: int
    sandbox_id: str
    model_name: str
    metrics: List[str]
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    request_model: Optional[str] = None
    configuration_snapshot: Optional[Dict[str, Any]] = None

    class Config:
        orm_mode = True


class EvalRunResponse(BaseModel):
    id: str
    name: str
    dataset_id: int
    sandbox_id: str
    model_name: str
    metrics: List[str]
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    request_model: Optional[str] = None
    configuration_snapshot: Optional[Dict[str, Any]] = None
    results: List[EvalRunResultResponse] = []

    class Config:
        orm_mode = True


# ---------------------------------------------------------------------------
# Ollama model management
# ---------------------------------------------------------------------------


class OllamaModelInfo(BaseModel):
    name: str
    size: Optional[int] = None
    digest: Optional[str] = None


class ModelPullRequest(BaseModel):
    model_name: str

    @validator("model_name")
    def model_name_not_empty(cls, v):
        if not v.strip():
            raise ValueError("model_name must not be empty")
        return v.strip()
