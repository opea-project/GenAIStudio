import logging
import time

from fastapi import FastAPI
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError

from app.db.database import Base, engine
from app.routers.eval_router import router as eval_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


def _migrate_eval_runs_table() -> None:
    inspector = inspect(engine)
    if "eval_runs" not in inspector.get_table_names():
        return

    columns = inspector.get_columns("eval_runs")
    id_col = next((c for c in columns if c["name"] == "id"), None)
    if id_col and "int" in str(id_col["type"]).lower():
        logger.info("Detected schema change: migrating eval_runs table from Integer to UUID id…")
        Base.metadata.drop_all(bind=engine)
        logger.info("Dropped old tables")
        return

    column_names = {column["name"] for column in columns}
    if "configuration_snapshot" not in column_names:
        logger.info("Adding missing configuration_snapshot column to eval_runs…")
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE eval_runs ADD COLUMN configuration_snapshot JSON NULL")
            )

app = FastAPI(
    title="Studio Eval Service",
    description=(
        "Evaluation service for GenAI Studio: golden dataset management, "
        "DeepEval-based metric evaluation, and Ollama model management."
    ),
    version="1.0.0",
)


@app.on_event("startup")
async def startup() -> None:
    logger.info("Creating database tables (if not present)…")
    # Import schema module so that all ORM models register with Base.metadata
    from app.db import schema  # noqa: F401

    retries = 10
    delay = 3
    for attempt in range(1, retries + 1):
        try:
            _migrate_eval_runs_table()
            Base.metadata.create_all(bind=engine)
            logger.info("Database tables ready")
            return
        except OperationalError as e:
            if attempt == retries:
                logger.error("Could not connect to MySQL after %d attempts: %s", retries, e)
                raise
            logger.warning("MySQL not ready (attempt %d/%d), retrying in %ds…", attempt, retries, delay)
            time.sleep(delay)


app.include_router(eval_router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
