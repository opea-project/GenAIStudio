import os

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

STUDIO_EVAL_DNS = os.getenv(
    "STUDIO_EVAL_DNS",
    "studio-eval-service.studio.svc.cluster.local:8000",
)

router = APIRouter()


@router.api_route("/evaluation/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy_evaluation(path: str, request: Request):
    target_url = f"http://{STUDIO_EVAL_DNS}/eval/{path}"
    upstream_timeout = 60.0
    query = request.url.query
    if query:
        target_url = f"{target_url}?{query}"

    headers = dict(request.headers)
    # Remove hop-by-hop headers that must not be forwarded
    for hop in ("host", "transfer-encoding", "connection"):
        headers.pop(hop, None)

    body = await request.body()

    try:
        async with httpx.AsyncClient(timeout=upstream_timeout) as client:
            upstream = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
            )
    except httpx.ConnectError as exc:
        raise HTTPException(status_code=502, detail=f"Cannot reach eval service: {exc}")
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail=f"Eval service timed out: {exc}")

    # Strip hop-by-hop headers from the upstream response before forwarding
    excluded = {"transfer-encoding", "connection", "keep-alive", "te", "trailers", "upgrade"}
    response_headers = {
        k: v for k, v in upstream.headers.items() if k.lower() not in excluded
    }

    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )
