import asyncio

from app.services import eval_service
from app.services import dataset_service
from app.compat import ensure_pydantic_v2_apis
from app.models.eval_models import SynthesizeFromDocRequest

def test_normalize_context_handles_json_string_list():
    context = '["alpha", "beta"]'

    assert eval_service._normalize_context(context) == ["alpha", "beta"]


def test_normalize_context_handles_plain_string():
    assert eval_service._normalize_context("single context") == ["single context"]


def test_format_exception_uses_class_name_when_message_empty():
    assert eval_service._format_exception(AssertionError()) == "AssertionError"


def test_run_synthesizer_applies_pydantic_compat(monkeypatch):
    compat_calls = []

    def fake_ensure_pydantic_v2_apis():
        compat_calls.append(True)

    class FakeSynthesizer:
        def __init__(self, model):
            self.model = model

        def generate_goldens_from_contexts(self, contexts, max_goldens_per_context):
            return [
                {
                    "contexts": contexts,
                    "max_goldens_per_context": max_goldens_per_context,
                    "model": self.model,
                }
            ]

    import sys
    from types import ModuleType

    deepeval_module = ModuleType("deepeval")
    synthesizer_module = ModuleType("deepeval.synthesizer")
    synthesizer_module.Synthesizer = FakeSynthesizer

    monkeypatch.setattr(dataset_service, "ensure_pydantic_v2_apis", fake_ensure_pydantic_v2_apis)
    monkeypatch.setitem(sys.modules, "deepeval", deepeval_module)
    monkeypatch.setitem(sys.modules, "deepeval.synthesizer", synthesizer_module)
    monkeypatch.setitem(sys.modules, "deepeval.synthesizer.config", ModuleType("deepeval.synthesizer.config"))

    class Payload:
        async_mode = False
        max_concurrent = 1
        input_quality_threshold = 0.4
        num_evolutions = 1

    result = dataset_service._run_synthesizer(Payload(), "judge", [["context"]], 2)

    assert compat_calls == [True]
    assert result[0]["max_goldens_per_context"] == 2


def test_request_dataset_cancellation_stops_registered_work():
    class FakeTask:
        def __init__(self):
            self.cancelled = False

        def done(self):
            return False

        def cancel(self):
            self.cancelled = True

    class FakeProcess:
        def __init__(self):
            self.terminated = False

        def is_alive(self):
            return True

        def terminate(self):
            self.terminated = True

    dataset_id = "dataset-123"
    task = FakeTask()
    process = FakeProcess()

    dataset_service._cancelled_datasets.discard(dataset_id)
    dataset_service._synthesis_tasks[dataset_id] = task
    dataset_service._synthesis_processes[dataset_id] = process

    try:
        dataset_service.request_dataset_cancellation(dataset_id)

        assert dataset_id in dataset_service._cancelled_datasets
        assert task.cancelled is True
        assert process.terminated is True
    finally:
        dataset_service._cancelled_datasets.discard(dataset_id)
        dataset_service._synthesis_tasks.pop(dataset_id, None)
        dataset_service._synthesis_processes.pop(dataset_id, None)


def test_wait_for_synthesis_process_result_drains_queue_before_process_exit():
    class FakeProcess:
        def __init__(self):
            self.alive = True
            self.exitcode = 0
            self.join_calls = []

        def is_alive(self):
            return self.alive

        def join(self, timeout=None):
            self.join_calls.append(timeout)
            self.alive = False

    class FakeQueue:
        def __init__(self, process):
            self.process = process
            self.calls = []

        def get(self, block=True, timeout=None):
            self.calls.append((block, timeout))
            self.process.alive = False
            return {"records": [{"input": "hello"}]}

    async def run_wait(process, result_queue):
        return await asyncio.wait_for(
            dataset_service._wait_for_synthesis_process_result("dataset-123", process, result_queue),
            timeout=1,
        )

    process = FakeProcess()
    result_queue = FakeQueue(process)

    result = asyncio.run(run_wait(process, result_queue))

    assert result == {"records": [{"input": "hello"}]}
    assert result_queue.calls == [(True, 0.25)]
    assert process.join_calls == [1]


def test_ensure_pydantic_v2_apis_aliases_invalid_collection_exception(monkeypatch):
    import chromadb.errors as chroma_errors

    monkeypatch.delattr(chroma_errors, "InvalidCollectionException", raising=False)

    ensure_pydantic_v2_apis()

    assert chroma_errors.InvalidCollectionException is chroma_errors.NotFoundError


def test_resolve_doc_generation_limits_matches_target_without_overshoot():
    payload = SynthesizeFromDocRequest(
        name="dataset",
        model_name="qwen2.5:14b",
        target_goldens=10,
        max_goldens_per_context=5,
        max_contexts=5,
    )

    assert dataset_service._resolve_doc_generation_limits(payload) == (5, 2)


def test_resolve_doc_generation_limits_falls_back_when_target_exceeds_user_cap():
    payload = SynthesizeFromDocRequest(
        name="dataset",
        model_name="qwen2.5:14b",
        target_goldens=17,
        max_goldens_per_context=2,
        max_contexts=5,
    )

    assert dataset_service._resolve_doc_generation_limits(payload) == (5, 4)


def test_run_synthesizer_from_docs_uses_resolved_limits(monkeypatch):
    compat_calls = []
    chunker_patch_calls = []

    def fake_ensure_pydantic_v2_apis():
        compat_calls.append(True)

    def fake_patch_deepeval_document_chunker():
        chunker_patch_calls.append(True)

    class FakeSynthesizer:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        def generate_goldens_from_docs(self, **kwargs):
            return [kwargs]

    class FakeContextConstructionConfig:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    class FakeEvolutionConfig:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    class FakeFiltrationConfig:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    import sys
    from types import ModuleType

    deepeval_module = ModuleType("deepeval")
    synthesizer_module = ModuleType("deepeval.synthesizer")
    config_module = ModuleType("deepeval.synthesizer.config")
    compat_module = ModuleType("app.compat")

    synthesizer_module.Synthesizer = FakeSynthesizer
    config_module.ContextConstructionConfig = FakeContextConstructionConfig
    config_module.EvolutionConfig = FakeEvolutionConfig
    config_module.FiltrationConfig = FakeFiltrationConfig
    compat_module.patch_deepeval_document_chunker = fake_patch_deepeval_document_chunker

    monkeypatch.setattr(dataset_service, "ensure_pydantic_v2_apis", fake_ensure_pydantic_v2_apis)
    monkeypatch.setitem(sys.modules, "deepeval", deepeval_module)
    monkeypatch.setitem(sys.modules, "deepeval.synthesizer", synthesizer_module)
    monkeypatch.setitem(sys.modules, "deepeval.synthesizer.config", config_module)
    monkeypatch.setitem(sys.modules, "app.compat", compat_module)

    payload = SynthesizeFromDocRequest(
        name="dataset",
        model_name="qwen2.5:14b",
        target_goldens=10,
        max_goldens_per_context=5,
        max_contexts=5,
        chunk_size=1024,
        chunk_overlap=64,
        max_context_length=3,
    )

    result = dataset_service._run_synthesizer_from_docs(
        "/tmp/source.pdf",
        payload,
        "judge",
        "embedder",
    )

    assert compat_calls == [True]
    assert chunker_patch_calls == [True]
    assert result[0]["max_goldens_per_context"] == 2
    assert result[0]["context_construction_config"].kwargs["max_contexts_per_document"] == 5

# ---------------------------------------------------------------------------
# Progress-protocol tests
# ---------------------------------------------------------------------------

def test_wait_for_synthesis_handles_progress_then_done():
    """Parent must collect batches from progress messages and return them when done."""

    class FakeProcess:
        def __init__(self):
            self.alive = True
            self.exitcode = 0

        def is_alive(self):
            return self.alive

        def join(self, timeout=None):
            self.alive = False

    class FakeQueue:
        def __init__(self, messages, process):
            self._msgs = list(messages)
            self._process = process

        def get(self, block=True, timeout=None):
            if self._msgs:
                msg = self._msgs.pop(0)
                if not self._msgs:
                    self._process.alive = False
                return msg
            from queue import Empty
            raise Empty

    messages = [
        {"type": "progress", "completed_goldens": 2, "batch": [{"input": "q1"}, {"input": "q2"}]},
        {"type": "progress", "completed_goldens": 4, "batch": [{"input": "q3"}, {"input": "q4"}]},
        {"type": "done"},
    ]

    process = FakeProcess()
    queue = FakeQueue(messages, process)

    result = asyncio.run(asyncio.wait_for(
        dataset_service._wait_for_synthesis_process_result("ds-1", process, queue),
        timeout=2,
    ))

    assert result == {"records": [{"input": "q1"}, {"input": "q2"}, {"input": "q3"}, {"input": "q4"}]}


def test_wait_for_synthesis_handles_error_message():
    """Parent must return the error from a typed error message."""

    class FakeProcess:
        def __init__(self):
            self.alive = True
            self.exitcode = 1

        def is_alive(self):
            return self.alive

        def join(self, timeout=None):
            self.alive = False

    class FakeQueue:
        def __init__(self, msg, process):
            self._msg = msg
            self._process = process

        def get(self, block=True, timeout=None):
            if self._msg:
                msg = self._msg
                self._msg = None
                self._process.alive = False
                return msg
            from queue import Empty
            raise Empty

    process = FakeProcess()
    queue = FakeQueue({"type": "error", "message": "boom"}, process)

    result = asyncio.run(asyncio.wait_for(
        dataset_service._wait_for_synthesis_process_result("ds-2", process, queue),
        timeout=2,
    ))

    assert result == {"error": "boom"}

def test_progress_synthesizer_sends_per_context_batches(monkeypatch):
    """_run_synthesizer_from_docs with progress_queue must send per-context messages."""
    compat_calls = []
    chunker_patch_calls = []

    def fake_ensure_pydantic_v2_apis():
        compat_calls.append(True)

    def fake_patch_deepeval_document_chunker():
        chunker_patch_calls.append(True)

    class FakeGolden:
        def __init__(self, text):
            self.input = text
            self.expected_output = f"answer-{text}"
            self.context = [f"ctx-{text}"]

    class FakeSynthesizer:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        def generate_goldens_from_docs(self, **kwargs):
            # DeepEval internally calls self.generate_goldens_from_contexts
            return self.generate_goldens_from_contexts(
                [["ctx-a"], ["ctx-b"]],
                max_goldens_per_context=kwargs.get("max_goldens_per_context", 2),
            )

        def generate_goldens_from_contexts(self, contexts, *args, **kwargs):
            # Returns one golden per context.
            goldens = []
            for ctx in contexts:
                goldens.append(FakeGolden(ctx[0]))
            return goldens

    class FakeConfig:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    import sys
    from types import ModuleType

    synthesizer_module = ModuleType("deepeval.synthesizer")
    config_module = ModuleType("deepeval.synthesizer.config")
    compat_module = ModuleType("app.compat")
    synthesizer_module.Synthesizer = FakeSynthesizer
    config_module.ContextConstructionConfig = FakeConfig
    config_module.EvolutionConfig = FakeConfig
    config_module.FiltrationConfig = FakeConfig
    compat_module.patch_deepeval_document_chunker = fake_patch_deepeval_document_chunker

    monkeypatch.setattr(dataset_service, "ensure_pydantic_v2_apis", fake_ensure_pydantic_v2_apis)
    monkeypatch.setitem(sys.modules, "deepeval", ModuleType("deepeval"))
    monkeypatch.setitem(sys.modules, "deepeval.synthesizer", synthesizer_module)
    monkeypatch.setitem(sys.modules, "deepeval.synthesizer.config", config_module)
    monkeypatch.setitem(sys.modules, "app.compat", compat_module)

    from queue import Queue
    progress_queue = Queue()

    payload = SynthesizeFromDocRequest(
        name="ds", model_name="m", target_goldens=4,
        max_goldens_per_context=2, max_contexts=5,
    )

    dataset_service._run_synthesizer_from_docs(
        "/tmp/fake.pdf", payload, "judge", "embedder",
        progress_queue=progress_queue,
    )

    # The ProgressSynthesizer should have sent one message per context.
    msgs = []
    while not progress_queue.empty():
        msgs.append(progress_queue.get_nowait())

    assert len(msgs) == 2  # two contexts
    assert msgs[0]["type"] == "progress"
    assert msgs[0]["completed_goldens"] == 1
    assert msgs[1]["completed_goldens"] == 2
    # Each batch should have exactly one record (one golden per context).
    assert len(msgs[0]["batch"]) == 1
    assert len(msgs[1]["batch"]) == 1
    assert msgs[0]["batch"][0]["input"] == "ctx-a"
    assert msgs[1]["batch"][0]["input"] == "ctx-b"