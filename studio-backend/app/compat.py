"""
Compatibility shims for third-party libraries.

Currently used to keep kubernetes-python working with urllib3 2.x, which
removed HTTPResponse.getheaders(). Older kubernetes versions still call
getheaders when building ApiException objects. This shim reintroduces a
minimal getheaders that mirrors the previous behavior.
"""
from urllib3.response import HTTPResponse


def ensure_urllib3_getheaders() -> None:
    """Add HTTPResponse.getheaders if urllib3 2.x removed it.

    Returns the header items as a list of (key, value) tuples, matching the
    old http.client.HTTPResponse API used by kubernetes-python.
    """
    if not hasattr(HTTPResponse, "getheaders"):
        def _getheaders(self):  # type: ignore[override]
            return list(self.headers.items())

        HTTPResponse.getheaders = _getheaders  # type: ignore[attr-defined]