import importlib
import os
import sys

from app import compat


def _reload_module(module_name: str):
    sys.modules.pop(module_name, None)
    return importlib.import_module(module_name)


def test_response_collector_timeout_disabled_by_default(monkeypatch):
    monkeypatch.delenv("APP_BACKEND_TIMEOUT", raising=False)

    response_collector = _reload_module("app.services.response_collector")

    assert response_collector._TIMEOUT is None


def test_response_collector_timeout_can_be_enabled(monkeypatch):
    monkeypatch.setenv("APP_BACKEND_TIMEOUT", "300")

    response_collector = _reload_module("app.services.response_collector")

    assert response_collector._TIMEOUT == 300.0


def test_ollama_generate_timeout_disabled_by_default(monkeypatch):
    monkeypatch.delenv("OLLAMA_GENERATE_TIMEOUT", raising=False)
    monkeypatch.setenv("OLLAMA_PULL_TIMEOUT", "600")

    ollama_service = _reload_module("app.services.ollama_service")

    assert ollama_service.OLLAMA_GENERATE_TIMEOUT is None


def test_ollama_generate_timeout_can_be_enabled(monkeypatch):
    monkeypatch.setenv("OLLAMA_GENERATE_TIMEOUT", "240")
    monkeypatch.setenv("OLLAMA_PULL_TIMEOUT", "600")

    ollama_service = _reload_module("app.services.ollama_service")

    assert ollama_service.OLLAMA_GENERATE_TIMEOUT == 240.0


def test_deepeval_network_timeouts_disabled_by_default(monkeypatch):
    monkeypatch.delenv("DEEPEVAL_TELEMETRY_OPT_OUT", raising=False)
    monkeypatch.delenv("DEEPEVAL_UPDATE_WARNING_OPT_OUT", raising=False)

    compat.ensure_pydantic_v2_apis()

    assert os.getenv("DEEPEVAL_TELEMETRY_OPT_OUT") == "YES"
    assert os.getenv("DEEPEVAL_UPDATE_WARNING_OPT_OUT") == "YES"