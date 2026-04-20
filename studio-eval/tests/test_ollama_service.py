import importlib
import sys
from types import ModuleType

from pydantic import BaseModel


def _load_ollama_service(monkeypatch):
    deepeval_module = ModuleType("deepeval")
    deepeval_models_module = ModuleType("deepeval.models")
    deepeval_base_model_module = ModuleType("deepeval.models.base_model")

    class DeepEvalBaseLLM:
        pass

    deepeval_models_module.DeepEvalBaseLLM = DeepEvalBaseLLM
    deepeval_base_model_module.DeepEvalBaseLLM = DeepEvalBaseLLM

    monkeypatch.setitem(sys.modules, "deepeval", deepeval_module)
    monkeypatch.setitem(sys.modules, "deepeval.models", deepeval_models_module)
    monkeypatch.setitem(
        sys.modules,
        "deepeval.models.base_model",
        deepeval_base_model_module,
    )
    sys.modules.pop("app.services.ollama_service", None)
    return importlib.import_module("app.services.ollama_service")


class ClaimsSchema(BaseModel):
    claims: list[str]


class StatementsSchema(BaseModel):
    statements: list[str]


def test_generate_returns_schema_instance(monkeypatch):
    ollama_service = _load_ollama_service(monkeypatch)
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"response": '{"claims": ["alpha", "beta"]}'}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, json):
            captured["url"] = url
            captured["json"] = json
            return FakeResponse()

    monkeypatch.setattr(ollama_service.httpx, "Client", FakeClient)

    judge = ollama_service.OllamaJudge(model_name="judge-model")
    result = judge.generate("prompt", schema=ClaimsSchema)

    assert isinstance(result, ClaimsSchema)
    assert result.claims == ["alpha", "beta"]
    assert captured["json"]["format"] == "json"


def test_parse_structured_response_handles_fenced_json(monkeypatch):
    ollama_service = _load_ollama_service(monkeypatch)

    result = ollama_service._parse_structured_response(
        StatementsSchema,
        '```json\n{"statements": ["first statement"]}\n```',
    )

    assert isinstance(result, StatementsSchema)
    assert result.statements == ["first statement"]


def test_generate_raises_type_error_on_invalid_structured_payload(monkeypatch):
    ollama_service = _load_ollama_service(monkeypatch)

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"response": 'not-json'}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, json):
            return FakeResponse()

    monkeypatch.setattr(ollama_service.httpx, "Client", FakeClient)

    judge = ollama_service.OllamaJudge(model_name="judge-model")

    try:
        judge.generate("prompt", schema=ClaimsSchema)
    except TypeError as exc:
        assert str(exc) == "Structured response parsing failed"
    else:
        raise AssertionError("Expected TypeError for invalid structured payload")