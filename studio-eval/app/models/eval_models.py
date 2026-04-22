from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from pydantic import BaseModel, ConfigDict, field_validator

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
    model_config = ConfigDict(from_attributes=True)

    id: int
    dataset_id: str
    input: str
    expected_output: Optional[str] = None
    context: Optional[List[str]] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------


class EvalDatasetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    entries: Optional[List[EvalDatasetEntryCreate]] = []


class EvalDatasetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class EvalDatasetEntryUpdate(BaseModel):
    input: Optional[str] = None
    expected_output: Optional[str] = None
    context: Optional[List[str]] = None


class AddEntriesRequest(BaseModel):
    entries: List[EvalDatasetEntryCreate]

    @field_validator("entries")
    @classmethod
    def entries_not_empty(cls, v):
        if not v:
            raise ValueError("entries must not be empty")
        return v


class AddEntriesResponse(BaseModel):
    added: int
    entries: List[EvalDatasetEntryResponse]


class EvalDatasetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    status: str = "completed"
    error: Optional[str] = None
    completed_contexts: Optional[int] = None
    total_contexts: Optional[int] = None
    completed_goldens: Optional[int] = None
    target_goldens: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    entries: List[EvalDatasetEntryResponse] = []


class EvalDatasetSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    status: str = "completed"
    error: Optional[str] = None
    completed_contexts: Optional[int] = None
    total_contexts: Optional[int] = None
    completed_goldens: Optional[int] = None
    target_goldens: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    entry_count: int = 0


# ---------------------------------------------------------------------------
# Synthesis request
# ---------------------------------------------------------------------------


class SynthesizeRequest(BaseModel):
    name: str
    description: Optional[str] = None
    contexts: List[List[str]]
    model_name: str
    target_goldens: int = 10
    num_goldens_per_context: int = 2
    num_evolutions: int = 1
    input_quality_threshold: float = 0.4
    llm_timeout: float = 0
    async_mode: bool = False
    max_concurrent: int = 1

    @field_validator("contexts")
    @classmethod
    def contexts_not_empty(cls, v):
        if not v:
            raise ValueError("contexts must not be empty")
        return v

    @field_validator("target_goldens")
    @classmethod
    def target_goldens_positive(cls, v):
        if v < 1:
            raise ValueError("target_goldens must be >= 1")
        return v

    @field_validator("num_goldens_per_context")
    @classmethod
    def goldens_positive(cls, v):
        if v < 1:
            raise ValueError("num_goldens_per_context must be >= 1")
        return v

    @field_validator("num_evolutions")
    @classmethod
    def evolutions_positive(cls, v):
        if v < 1:
            raise ValueError("num_evolutions must be >= 1")
        return v

    @field_validator("input_quality_threshold")
    @classmethod
    def input_quality_range(cls, v):
        if v < 0 or v > 1:
            raise ValueError("input_quality_threshold must be between 0 and 1")
        return v

    @field_validator("llm_timeout")
    @classmethod
    def llm_timeout_non_negative(cls, v):
        if v < 0:
            raise ValueError("llm_timeout must be >= 0")
        return v

    @field_validator("max_concurrent")
    @classmethod
    def max_concurrent_positive(cls, v):
        if v < 1:
            raise ValueError("max_concurrent must be >= 1")
        return v


# ---------------------------------------------------------------------------
# Synthesis request (document-based — file upload path)
# ---------------------------------------------------------------------------


class SynthesizeFromDocRequest(BaseModel):
    """Synthesis request that accepts a raw document file.

    The file bytes + extension are passed separately to the background task;
    this model carries only the scalar configuration fields.
    """

    name: str
    description: Optional[str] = None
    model_name: str
    embed_model_name: str = "nomic-embed-text"
    target_goldens: int = 10
    max_goldens_per_context: int = 2
    max_contexts: int = 5
    max_context_length: int = 3
    chunk_size: int = 1024
    chunk_overlap: int = 0
    num_evolutions: int = 1
    input_quality_threshold: float = 0.4
    llm_timeout: float = 0
    async_mode: bool = False
    max_concurrent: int = 1

    @field_validator("target_goldens")
    @classmethod
    def target_goldens_positive(cls, v):
        if v < 1:
            raise ValueError("target_goldens must be >= 1")
        return v

    @field_validator("max_goldens_per_context")
    @classmethod
    def goldens_positive(cls, v):
        if v < 1:
            raise ValueError("max_goldens_per_context must be >= 1")
        return v

    @field_validator("input_quality_threshold")
    @classmethod
    def input_quality_range(cls, v):
        if v < 0 or v > 1:
            raise ValueError("input_quality_threshold must be between 0 and 1")
        return v

    @field_validator("max_concurrent")
    @classmethod
    def max_concurrent_positive(cls, v):
        if v < 1:
            raise ValueError("max_concurrent must be >= 1")
        return v


# ---------------------------------------------------------------------------
# Eval Run
# ---------------------------------------------------------------------------


class EvalRunCreate(BaseModel):
    name: str
    dataset_id: str
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

    @field_validator("metrics")
    @classmethod
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
    model_config = ConfigDict(from_attributes=True)

    id: int
    run_id: str
    entry_id: int
    actual_output: Optional[str] = None
    metric_scores: Optional[Dict[str, Any]] = None
    passed: Optional[bool] = None
    reason: Optional[str] = None
    created_at: datetime
    entry: Optional[EvalDatasetEntryResponse] = None


class EvalRunSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    dataset_id: Optional[str] = None
    sandbox_id: str
    model_name: str
    metrics: List[str]
    status: str
    completed_count: Optional[int] = None
    total_count: Optional[int] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    request_model: Optional[str] = None
    configuration_snapshot: Optional[Dict[str, Any]] = None
    dataset_name_snapshot: Optional[str] = None


class EvalRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    dataset_id: Optional[str] = None
    sandbox_id: str
    model_name: str
    metrics: List[str]
    status: str
    completed_count: Optional[int] = None
    total_count: Optional[int] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    request_model: Optional[str] = None
    configuration_snapshot: Optional[Dict[str, Any]] = None
    dataset_name_snapshot: Optional[str] = None
    dataset_entries_snapshot: Optional[List[Dict[str, Any]]] = None
    results: List[EvalRunResultResponse] = []


# ---------------------------------------------------------------------------
# Ollama model management
# ---------------------------------------------------------------------------


class OllamaModelInfo(BaseModel):
    name: str
    size: Optional[int] = None
    digest: Optional[str] = None


class ModelPullRequest(BaseModel):
    model_name: str

    @field_validator("model_name")
    @classmethod
    def model_name_not_empty(cls, v):
        if not v.strip():
            raise ValueError("model_name must not be empty")
        return v.strip()
