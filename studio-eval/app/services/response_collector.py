import json
import logging
import os
from typing import Optional

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

_APP_BACKEND_PORT = 8899
_CHAT_PATH = "/v1/app-backend"
_TIMEOUT = _parse_timeout("APP_BACKEND_TIMEOUT", "0")
_APP_BACKEND_URL_TEMPLATE = os.getenv(
    "APP_BACKEND_URL_TEMPLATE",
    f"http://app-backend.{{sandbox_id}}.svc.cluster.local:{_APP_BACKEND_PORT}{_CHAT_PATH}",
)

DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant"


def _app_backend_url(sandbox_id: str) -> str:
    return _APP_BACKEND_URL_TEMPLATE.format(sandbox_id=sandbox_id)


# ---------------------------------------------------------------------------
# SSE parsing helpers
# ---------------------------------------------------------------------------

def _parse_sse_token(payload: str) -> Optional[str]:
    """Extract the text token from a single SSE data payload."""
    if payload.strip() == "[DONE]":
        return None
    try:
        chunk = json.loads(payload)
    except json.JSONDecodeError:
        return payload if payload else None
    if not isinstance(chunk, dict):
        return None
    choices = chunk.get("choices", [])
    if not choices:
        return None
    delta = choices[0].get("delta", {})
    return delta.get("content") or choices[0].get("text", "") or None


def _extract_sse_answer(body: str) -> Optional[str]:
    """Parse a full SSE response body and concatenate all content tokens."""
    parts = []
    for raw_line in body.splitlines():
        line = raw_line.rstrip("\r")
        if not line or not line.startswith("data:"):
            continue
        payload = line[6:]  # skip "data: " (preserve leading space in token)
        if payload.strip() == "[DONE]":
            break
        token = _parse_sse_token(payload)
        if token is not None:
            parts.append(token)
    return "".join(parts).strip() if parts else None


def _parse_non_streaming(data: dict) -> Optional[str]:
    """Extract the assistant reply from a non-streaming JSON response."""
    choices = data.get("choices") or []
    if choices:
        choice = choices[0]
        content = choice.get("message", {}).get("content") or choice.get("text")
        if content:
            return content
    for key in ("answer", "response", "content", "actual_output"):
        if key in data and isinstance(data[key], str) and data[key].strip():
            return data[key]
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def collect_response(
    sandbox_id: str,
    user_input: str,
    system_prompt: str = DEFAULT_SYSTEM_PROMPT,
    temperature: float = 0.4,
    max_tokens: int = 100,
    request_model: str = "NA",
) -> Optional[str]:
    """POST a chat message to the app-backend in *sandbox_id* and return the
    assistant reply, or ``None`` if the response contains no usable content.

    Supports both streaming SSE (``text/event-stream``) and plain JSON
    non-streaming responses.  Raises ``httpx.HTTPError`` on non-2xx status.

    Parameters
    ----------
    sandbox_id:     Target sandbox namespace.
    user_input:     The user message to send.
    system_prompt:  System message prepended to the chat messages list.
    temperature:    Sampling temperature forwarded to the model.
    max_tokens:     Maximum number of tokens to generate.
    request_model:  Model identifier forwarded in the request body.
    """
    url = _app_backend_url(sandbox_id)

    messages = []
    if system_prompt.strip():
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_input})

    payload = {
        "messages": messages,
        "model": request_model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }

    logger.debug("Collecting response: sandbox=%s input=%.80s", sandbox_id, user_input)

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        async with client.stream("POST", url, json=payload) as resp:
            resp.raise_for_status()
            body = (await resp.aread()).decode("utf-8")
            content_type = resp.headers.get("content-type", "")

    if "text/event-stream" in content_type or body.lstrip().startswith("data:"):
        answer = _extract_sse_answer(body)
        if answer:
            return answer
        logger.warning("SSE parsing returned empty answer for sandbox=%s", sandbox_id)
        return None

    try:
        data = json.loads(body)
        answer = _parse_non_streaming(data)
        if answer:
            return answer
        logger.warning("app-backend returned no usable content for sandbox=%s", sandbox_id)
        return None
    except json.JSONDecodeError:
        # Last resort: try SSE parse on a non-event-stream content-type body
        return _extract_sse_answer(body)
