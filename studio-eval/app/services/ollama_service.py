import json
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)


def _parse_timeout(env_name: str, default: str):
    raw_value = os.getenv(env_name, default)
    if raw_value is None:
        return None

    normalized = raw_value.strip().lower()
    if normalized in {"", "0", "none", "false", "off", "disable", "disabled"}:
        return None

    parsed = float(raw_value)
    return None if parsed <= 0 else parsed

OLLAMA_DNS = os.getenv("OLLAMA_DNS", "ollama.ollama.svc.cluster.local:11434")
OLLAMA_BASE_URL = f"http://{OLLAMA_DNS}"
OLLAMA_PULL_TIMEOUT = _parse_timeout("OLLAMA_PULL_TIMEOUT", "600")
OLLAMA_GENERATE_TIMEOUT = _parse_timeout("OLLAMA_GENERATE_TIMEOUT", "0")


def _schema_to_ollama_format(schema) -> Any:
    return "json"


def _load_structured_response(raw_response: str) -> Any:
    content = raw_response.strip()

    if content.startswith("```"):
        lines = content.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        content = "\n".join(lines).strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        json_start_candidates = [
            index for index in (content.find("{"), content.find("[")) if index != -1
        ]
        json_end_candidates = [
            index for index in (content.rfind("}"), content.rfind("]")) if index != -1
        ]
        if not json_start_candidates or not json_end_candidates:
            raise

        json_start = min(json_start_candidates)
        json_end = max(json_end_candidates) + 1
        return json.loads(content[json_start:json_end])


def _parse_structured_response(schema, raw_response: str) -> Any:
    payload = _load_structured_response(raw_response)

    if hasattr(schema, "model_validate"):
        return schema.model_validate(payload)
    if hasattr(schema, "parse_obj"):
        return schema.parse_obj(payload)
    if callable(schema):
        if isinstance(payload, dict):
            return schema(**payload)
        return schema(payload)
    return payload


# ---------------------------------------------------------------------------
# Async helpers — used by router and background jobs
# ---------------------------------------------------------------------------


async def list_models() -> list:
    """Return the list of locally available Ollama models (GET /api/tags)."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
        resp.raise_for_status()
        return resp.json().get("models", [])


async def is_model_available(model_name: str) -> bool:
    """True if *model_name* is already present in Ollama."""
    try:
        models = await list_models()
        target_base = model_name.split(":")[0]
        for m in models:
            name = m.get("name", "")
            if name == model_name or name.split(":")[0] == target_base:
                return True
        return False
    except Exception:
        return False


async def pull_model(model_name: str) -> None:
    """Pull *model_name* from the Ollama registry; blocks until complete."""
    logger.info("Pulling Ollama model: %s", model_name)
    async with httpx.AsyncClient(timeout=OLLAMA_PULL_TIMEOUT) as client:
        resp = await client.post(
            f"{OLLAMA_BASE_URL}/api/pull",
            json={"name": model_name, "stream": False},
        )
        resp.raise_for_status()
    logger.info("Model pulled successfully: %s", model_name)


async def ensure_model(model_name: str) -> None:
    """Ensure *model_name* is available in Ollama, pulling it if absent."""
    if not await is_model_available(model_name):
        logger.info("Model '%s' not found locally — pulling...", model_name)
        await pull_model(model_name)
    else:
        logger.debug("Model '%s' already available", model_name)


# ---------------------------------------------------------------------------
# OllamaJudge — DeepEvalBaseLLM wrapper
# ---------------------------------------------------------------------------

try:
    from deepeval.models import DeepEvalBaseLLM  # deepeval >= 0.21
except ImportError:
    from deepeval.models.base_model import DeepEvalBaseLLM  # older deepeval


class OllamaJudge(DeepEvalBaseLLM):
    """Custom DeepEval LLM that routes all generation requests to Ollama.

    Both synchronous (``generate``) and asynchronous (``a_generate``) paths
    are implemented so that DeepEval can pick the appropriate one depending on
    whether ``metric.measure()`` or ``metric.a_measure()`` is called.

    When *schema* is provided (structured-output request), the Ollama API is
    asked to return JSON via ``"format": "json"``.
    """

    def __init__(self, model_name: str) -> None:
        self._model_name = model_name
        self._base_url = OLLAMA_BASE_URL

    # -- DeepEvalBaseLLM contract -------------------------------------------

    def get_model_name(self) -> str:
        return self._model_name

    def load_model(self):
        # Model lives in Ollama; nothing to load locally.
        return self

    def generate(self, prompt: str, schema=None) -> Any:
        """Synchronous generation — used by ``metric.measure()``."""
        payload = {
            "model": self._model_name,
            "prompt": prompt,
            "stream": False,
        }
        if schema is not None:
            payload["format"] = _schema_to_ollama_format(schema)

        with httpx.Client(timeout=OLLAMA_GENERATE_TIMEOUT) as client:
            resp = client.post(f"{self._base_url}/api/generate", json=payload)
            resp.raise_for_status()
            response_text = resp.json()["response"]
            if schema is None:
                return response_text
            try:
                return _parse_structured_response(schema, response_text)
            except Exception as exc:
                raise TypeError("Structured response parsing failed") from exc

    async def a_generate(self, prompt: str, schema=None) -> Any:
        """Async generation — used by ``metric.a_measure()``."""
        payload = {
            "model": self._model_name,
            "prompt": prompt,
            "stream": False,
        }
        if schema is not None:
            payload["format"] = _schema_to_ollama_format(schema)

        async with httpx.AsyncClient(timeout=OLLAMA_GENERATE_TIMEOUT) as client:
            resp = await client.post(
                f"{self._base_url}/api/generate", json=payload
            )
            resp.raise_for_status()
            response_text = resp.json()["response"]
            if schema is None:
                return response_text
            try:
                return _parse_structured_response(schema, response_text)
            except Exception as exc:
                raise TypeError("Structured response parsing failed") from exc
