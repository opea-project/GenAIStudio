"""Compatibility shims for third-party libraries."""

import os

import pydantic.config


def ensure_pydantic_v2_apis() -> None:
    """Set DeepEval opt-out env vars and apply third-party compatibility patches.

    DeepEval performs a PyPI version check and telemetry IP lookup at import
    time.  Default those opt-outs to YES so evaluation and synthesis do not
    wait on external DeepEval calls unless a deployment explicitly opts back in.
    """
    os.environ.setdefault("DEEPEVAL_TELEMETRY_OPT_OUT", "YES")
    os.environ.setdefault("DEEPEVAL_UPDATE_WARNING_OPT_OUT", "YES")

    # DeepEval Synthesizer imports ExtraValues from pydantic.config. This
    # exists in Pydantic v2 but guard defensively in case of version skew.
    if not hasattr(pydantic.config, "ExtraValues"):
        from typing import Literal
        pydantic.config.ExtraValues = Literal["allow", "ignore", "forbid"]  # type: ignore[attr-defined]

    # DeepEval imports InvalidCollectionException from chromadb.errors, but
    # newer chromadb versions expose NotFoundError instead when a collection
    # is missing. Alias the exact runtime exception so DeepEval's except block
    # still catches a missing collection and creates it.
    try:
        import chromadb.errors as _ce
        if not hasattr(_ce, "InvalidCollectionException"):
            if hasattr(_ce, "NotFoundError"):
                _ce.InvalidCollectionException = _ce.NotFoundError  # type: ignore[attr-defined]
            else:
                class InvalidCollectionException(_ce.ChromaError):  # type: ignore[misc]
                    pass
                _ce.InvalidCollectionException = InvalidCollectionException  # type: ignore[attr-defined]
    except ImportError:
        pass


def patch_deepeval_document_chunker() -> None:
    """Patch DeepEval's DocumentChunker to collapse dot-leaders before chunking.

    PDF table-of-contents lines like "Chapter 1 ............... 5" produce
    hundreds of single-dot tokens that overflow the embedding context window.
    Collapsing runs of 4+ dots down to "..." prevents the overflow and avoids
    the downstream ChromaDB "Collection does not exist" error that results from
    a failed chunking call.
    """
    import re

    try:
        from deepeval.synthesizer.chunking import doc_chunker
    except ImportError:
        return

    Chunker = doc_chunker.DocumentChunker
    if getattr(Chunker, "_dot_leader_patch_applied", False):
        return

    dot_pattern = re.compile(r"\.{4,}")

    original_load = Chunker.load_doc
    original_aload = Chunker.a_load_doc

    def _process(chunker_instance) -> None:
        if not chunker_instance.sections:
            return
        for section in chunker_instance.sections:
            section.page_content = dot_pattern.sub("...", section.page_content)
        chunker_instance.text_token_count = chunker_instance.count_tokens(
            chunker_instance.sections
        )

    def patched_load_doc(self, path: str):  # type: ignore[override]
        original_load(self, path)
        _process(self)

    async def patched_a_load_doc(self, path: str):  # type: ignore[override]
        await original_aload(self, path)
        _process(self)

    Chunker.load_doc = patched_load_doc  # type: ignore[method-assign]
    Chunker.a_load_doc = patched_a_load_doc  # type: ignore[method-assign]
    Chunker._dot_leader_patch_applied = True  # type: ignore[attr-defined]
