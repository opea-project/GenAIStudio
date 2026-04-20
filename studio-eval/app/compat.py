"""Compatibility shims for third-party libraries.

This service uses Pydantic v1, while some third-party packages imported at
runtime expect small parts of the Pydantic v2 API surface. Keep the shim local
and minimal so the rest of the app can continue using explicit Pydantic v1
syntax.
"""

import pydantic
from pydantic import root_validator, validator


def ensure_pydantic_v2_apis() -> None:
    """Provide a small subset of Pydantic v2 APIs on top of Pydantic v1.

    DeepEval currently imports ``field_validator`` and ``model_validator`` from
    ``pydantic``. Those names do not exist in Pydantic v1, so add compatible
    wrappers before importing DeepEval.
    """

    if not hasattr(pydantic, "field_validator"):
        def field_validator(*fields, mode="after", **kwargs):
            pre = mode == "before"
            return validator(*fields, pre=pre, allow_reuse=True, **kwargs)

        pydantic.field_validator = field_validator  # type: ignore[attr-defined]

    if not hasattr(pydantic, "model_validator"):
        def model_validator(*, mode="after", **kwargs):
            pre = mode == "before"

            def decorator(func):
                return root_validator(pre=pre, allow_reuse=True, **kwargs)(func)

            return decorator

        pydantic.model_validator = model_validator  # type: ignore[attr-defined]

    if not hasattr(pydantic, "ConfigDict"):
        pydantic.ConfigDict = dict  # type: ignore[attr-defined]

    if not hasattr(pydantic.BaseModel, "model_dump"):
        pydantic.BaseModel.model_dump = pydantic.BaseModel.dict  # type: ignore[attr-defined]

    if not hasattr(pydantic.BaseModel, "model_copy"):
        pydantic.BaseModel.model_copy = pydantic.BaseModel.copy  # type: ignore[attr-defined]
