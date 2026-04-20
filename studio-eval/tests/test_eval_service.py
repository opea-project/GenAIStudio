from app.services import eval_service


def test_normalize_context_handles_json_string_list():
    context = '["alpha", "beta"]'

    assert eval_service._normalize_context(context) == ["alpha", "beta"]


def test_normalize_context_handles_plain_string():
    assert eval_service._normalize_context("single context") == ["single context"]


def test_format_exception_uses_class_name_when_message_empty():
    assert eval_service._format_exception(AssertionError()) == "AssertionError"