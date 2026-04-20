from datetime import datetime
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class EvalDataset(Base):
    __tablename__ = "eval_datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    entries = relationship(
        "EvalDatasetEntry",
        back_populates="dataset",
        cascade="all, delete-orphan",
    )
    runs = relationship("EvalRun", back_populates="dataset")


class EvalDatasetEntry(Base):
    __tablename__ = "eval_dataset_entries"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("eval_datasets.id"), nullable=False)
    input = Column(Text, nullable=False)
    expected_output = Column(Text, nullable=True)
    context = Column(JSON, nullable=True)  # list[str]
    created_at = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("EvalDataset", back_populates="entries")
    results = relationship("EvalRunResult", back_populates="entry")


class EvalRun(Base):
    __tablename__ = "eval_runs"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    dataset_id = Column(Integer, ForeignKey("eval_datasets.id"), nullable=False)
    sandbox_id = Column(String(255), nullable=False)
    model_name = Column(String(255), nullable=False)
    metrics = Column(JSON, nullable=False)  # list[str]
    status = Column(String(50), default="pending")  # pending/running/completed/failed
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error = Column(Text, nullable=True)
    # App-backend request parameters for RAG evaluation
    system_prompt = Column(Text, nullable=True)
    temperature = Column(Float, nullable=True)
    max_tokens = Column(Integer, nullable=True)
    request_model = Column(String(255), nullable=True)
    configuration_snapshot = Column(JSON, nullable=True)

    dataset = relationship("EvalDataset", back_populates="runs")
    results = relationship(
        "EvalRunResult",
        back_populates="run",
        cascade="all, delete-orphan",
    )


class EvalRunResult(Base):
    __tablename__ = "eval_run_results"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(String(36), ForeignKey("eval_runs.id"), nullable=False)
    entry_id = Column(Integer, ForeignKey("eval_dataset_entries.id"), nullable=False)
    actual_output = Column(Text, nullable=True)
    metric_scores = Column(JSON, nullable=True)  # {metric_name: {score, passed, reason}}
    passed = Column(Boolean, nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    run = relationship("EvalRun", back_populates="results")
    entry = relationship("EvalDatasetEntry", back_populates="results")
