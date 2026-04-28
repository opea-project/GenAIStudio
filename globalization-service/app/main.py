import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

app = FastAPI(
    title="OPEA Globalization & Governance Service",
    description="Language-aware gateway for OPEA-based GenAI apps (Topic A)",
    version="0.1.0",
)

# -----------------------------
# 静态文件目录 & 看板页面
# -----------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(STATIC_DIR, exist_ok=True)

# 挂载 /static，用于访问 dashboard 里的静态资源（如果后面要拆 css/js）
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
@app.get("/dashboard", include_in_schema=False)
def dashboard_page():
    """
    国际化运营看板页面
    访问 http://localhost:8080/ 或 /dashboard 即可
    """
    dashboard_path = os.path.join(STATIC_DIR, "dashboard.html")
    if not os.path.exists(dashboard_path):
        raise HTTPException(status_code=404, detail="dashboard.html not found")
    return FileResponse(dashboard_path)


# -----------------------------
# 配置 & 内存事件日志
# -----------------------------


class RegionConfig(BaseModel):
    region_code: str                # cn / eu / us 等
    default_language: str           # zh-CN / en-US / th-TH ...
    allowed_languages: List[str]
    blocked_keywords: List[str]     # 简单敏感词示例
    hallucination_notice: bool      # 是否强制附带“内容可能有误差”提示
    pii_strict: bool                # 是否启用更严格的隐私限制


TENANT_CONFIGS: Dict[str, RegionConfig] = {
    "demo-tenant-cn": RegionConfig(
        region_code="cn",
        default_language="zh-CN",
        allowed_languages=["zh-CN", "en-US", "th-TH"],
        blocked_keywords=["政治敏感", "违法犯罪"],  # 纯示例
        hallucination_notice=True,
        pii_strict=True,
    ),
    "demo-tenant-eu": RegionConfig(
        region_code="eu",
        default_language="en-US",
        allowed_languages=["en-US", "de-DE", "fr-FR"],
        blocked_keywords=["hate speech", "terrorism"],
        hallucination_notice=True,
        pii_strict=True,
    ),
}

# 简单事件缓存，用于看板
EVENT_LOG: List[Dict[str, Any]] = []


# -----------------------------
# 模型定义
# -----------------------------


class PromptPreviewRequest(BaseModel):
    tenant_id: str = Field(..., description="租户 ID，例如 demo-tenant-cn")
    region: Optional[str] = Field(None, description="区域编码，可选，默认取租户配置")
    language: Optional[str] = Field(None, description="目标语言，不填则用租户默认语言")
    raw_prompt: str = Field(..., description="原始提示词（还没做国际化之前）")
    task_type: str = Field("chat", description="任务类型：chat / qa / summarization 等")


class PromptPreviewResponse(BaseModel):
    rewritten_prompt: str
    target_language: str
    applied_policies: List[str]
    warnings: List[str]


class PolicyEvaluationRequest(BaseModel):
    tenant_id: str
    region: Optional[str] = None
    language: Optional[str] = None
    content: str = Field(..., description="最终要发给大模型的内容（或用户问题）")


class PolicyEvaluationResponse(BaseModel):
    allowed: bool
    reasons: List[str]
    matched_rules: List[str]


class EventLogItem(BaseModel):
    id: str
    tenant_id: str
    region: str
    language: str
    event_type: str       # prompt_preview / blocked / allowed ...
    created_at: datetime
    payload: Dict[str, Any]


class EventIn(BaseModel):
    tenant_id: str
    region: str
    language: str
    event_type: str
    payload: Dict[str, Any]


# -----------------------------
# 工具函数
# -----------------------------


def get_tenant_cfg(tenant_id: str) -> RegionConfig:
    cfg = TENANT_CONFIGS.get(tenant_id)
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Unknown tenant_id: {tenant_id}")
    return cfg


def detect_or_default_language(req_lang: Optional[str], cfg: RegionConfig) -> str:
    """
    1）如果请求里有 language 并且在允许列表里，直接用
    2）否则 fallback 到租户默认语言
    后面可以在这里接入自动语言检测
    """
    if req_lang and req_lang in cfg.allowed_languages:
        return req_lang
    return cfg.default_language


def apply_governance_wrappers(
    prompt: str,
    target_language: str,
    cfg: RegionConfig,
) -> (str, List[str], List[str]):
    """
    根据区域 / 语言，加一些统一前后缀、免责声明之类的包装
    """
    applied_policies: List[str] = []
    warnings: List[str] = []

    # 语言约束（要求模型用指定语言回答）
    if target_language.startswith("zh"):
        language_hint = "请使用简体中文回答用户问题。"
    elif target_language.startswith("en"):
        language_hint = "Please answer the user in English."
    elif target_language.startswith("th"):
        language_hint = "กรุณาตอบเป็นภาษาไทย"
    else:
        language_hint = f"Please answer in language: {target_language}."

    applied_policies.append("language_hint")

    # 幻觉风险提醒（对终端用户可见）
    if cfg.hallucination_notice:
        if target_language.startswith("zh"):
            warnings.append("本回答由大模型生成，可能存在不准确或过期信息，请结合实际业务进行判断。")
        elif target_language.startswith("en"):
            warnings.append(
                "This answer is generated by a large language model and may contain inaccuracies. "
                "Please verify before applying to production."
            )
        else:
            warnings.append(
                "This answer is generated by an AI model and may be inaccurate. "
                "Please verify before using it in critical scenarios."
            )
        applied_policies.append("hallucination_notice")

    # PII 强化（这里只打标，实际可以在这里接 OPEA guardrails）
    if cfg.pii_strict:
        applied_policies.append("pii_strict")

    rewritten = f"{language_hint}\n\n{prompt}"
    return rewritten, applied_policies, warnings


def simple_blocked_keyword_check(content: str, cfg: RegionConfig) -> (bool, List[str], List[str]):
    """
    极简关键词命中逻辑，后续可以换成更复杂的策略或接入 OPEA guardrails
    """
    matched = []
    lower = content.lower()
    for kw in cfg.blocked_keywords:
        if kw and kw.lower() in lower:
            matched.append(kw)

    if matched:
        reasons = [f"命中敏感词: {', '.join(matched)}"]
        return False, reasons, matched
    return True, [], []


# -----------------------------
# API 定义
# -----------------------------


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "globalization-governance", "version": "0.1.0"}


@app.post("/v1/globalization/prompt/preview", response_model=PromptPreviewResponse)
def preview_prompt(req: PromptPreviewRequest):
    cfg = get_tenant_cfg(req.tenant_id)
    target_lang = detect_or_default_language(req.language, cfg)

    rewritten, policies, warnings = apply_governance_wrappers(
        prompt=req.raw_prompt,
        target_language=target_lang,
        cfg=cfg,
    )

    EVENT_LOG.append(
        EventLogItem(
            id=str(uuid4()),
            tenant_id=req.tenant_id,
            region=req.region or cfg.region_code,
            language=target_lang,
            event_type="prompt_preview",
            created_at=datetime.utcnow(),
            payload={"task_type": req.task_type},
        ).model_dump()
    )

    return PromptPreviewResponse(
        rewritten_prompt=rewritten,
        target_language=target_lang,
        applied_policies=policies,
        warnings=warnings,
    )


@app.post("/v1/globalization/policy/evaluate", response_model=PolicyEvaluationResponse)
def evaluate_policy(req: PolicyEvaluationRequest):
    cfg = get_tenant_cfg(req.tenant_id)
    lang = detect_or_default_language(req.language, cfg)

    allowed, reasons, matched = simple_blocked_keyword_check(req.content, cfg)

    EVENT_LOG.append(
        EventLogItem(
            id=str(uuid4()),
            tenant_id=req.tenant_id,
            region=req.region or cfg.region_code,
            language=lang,
            event_type="blocked" if not allowed else "allowed",
            created_at=datetime.utcnow(),
            payload={"matched_rules": matched},
        ).model_dump()
    )

    return PolicyEvaluationResponse(
        allowed=allowed,
        reasons=reasons,
        matched_rules=matched,
    )


@app.post("/v1/globalization/events", response_model=EventLogItem)
def log_event(ev: EventIn):
    """
    通用事件记录接口，方便前端 / 其它服务打点
    """
    item = EventLogItem(
        id=str(uuid4()),
        tenant_id=ev.tenant_id,
        region=ev.region,
        language=ev.language,
        event_type=ev.event_type,
        created_at=datetime.utcnow(),
        payload=ev.payload,
    )
    EVENT_LOG.append(item.model_dump())
    return item


@app.get("/v1/globalization/events", response_model=List[EventLogItem])
def list_events(limit: int = 100):
    """
    国际化运营看板的数据源：
    - 每条事件包含 tenant / region / language / event_type / payload
    """
    return EVENT_LOG[-limit:]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8080, reload=True)
