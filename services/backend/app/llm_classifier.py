"""LLM zero-shot intent classifier for incoming messages.

Supports DeepSeek-V3 and OpenAI GPT-4o-mini via HTTP.
Falls back to keyword heuristic if no API key configured.

Tenant-aware: reads keywords, thresholds, prompt from tenant_settings.
"""
import json
import logging
import os
import re

import httpx

log = logging.getLogger(__name__)

try:
    from app.config import settings
    DEEPSEEK_API_KEY = settings.DEEPSEEK_API_KEY or ""
    OPENAI_API_KEY = settings.OPENAI_API_KEY or ""
    OPENROUTER_API_KEY = settings.OPENROUTER_API_KEY or ""
except ImportError:
    DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

# Priority: openrouter (free models) → deepseek (cheap) → openai (fallback)
LLM_ENDPOINTS = [
    {
        "name": "openrouter",
        "url": "https://openrouter.ai/api/v1/chat/completions",
        "key": OPENROUTER_API_KEY,
        "model": "meta-llama/llama-3.1-8b-instruct:free",
    },
    {
        "name": "deepseek",
        "url": "https://api.deepseek.com/v1/chat/completions",
        "key": DEEPSEEK_API_KEY,
        "model": "deepseek-chat",
    },
    {
        "name": "openai",
        "url": "https://api.openai.com/v1/chat/completions",
        "key": OPENAI_API_KEY,
        "model": "gpt-4o-mini",
    },
]

# ── Defaults (used when no tenant_settings override exists) ──────
DEFAULT_SYSTEM_PROMPT = (
    "You are an expert sales analyst for a B2B lead generation system.\n\n"
    "Analyze an incoming message and extract qualification parameters.\n\n"
    "Return strictly a valid JSON object:\n"
    "{\n"
    '  "intent_score": "HOT" | "WARM" | "COLD" | "SPAM",\n'
    '  "confidence": 0.00 to 1.00,\n'
    '  "summary": "Brief 1-sentence summary",\n'
    '  "extracted_parameters": {\n'
    '    "geo_origin": "city/region or null",\n'
    '    "budget_mentioned": "budget string or null",\n'
    '    "dates_mentioned": "dates string or null",\n'
    '    "service_category": "villas | tours | real_estate | general"\n'
    '  }\n'
    '}\n\n'
    "Return ONLY the JSON string."
)

DEFAULT_HOT_KEYWORDS = [
    "сколько стоит", "цена", "купить", "аренду", "оплатить",
    "готов", "заказать", "стоимость", "buy", "price", "order",
]
DEFAULT_WARM_KEYWORDS = [
    "подскажите", "какие есть", "расскажите", "варианты",
    "интересует", "хотел бы", "планирую", "interested", "tell me more",
]
DEFAULT_SPAM_KEYWORDS = [
    "casino", "crypto", "earn money", "заработать",
    "бесплатно", "free", "click here", "нажми",
]


def _classify_by_keywords(text: str, cfg: dict | None = None) -> dict:
    """Fast keyword heuristic using tenant-configured keywords and thresholds."""
    cfg = cfg or {}
    hot_kws = cfg.get("hot_keywords", DEFAULT_HOT_KEYWORDS)
    warm_kws = cfg.get("warm_keywords", DEFAULT_WARM_KEYWORDS)
    spam_kws = cfg.get("spam_keywords", DEFAULT_SPAM_KEYWORDS)
    hot_thresh = cfg.get("hot_threshold", 2)
    warm_thresh = cfg.get("warm_threshold", 1)

    lower = text.lower()

    spam_hits = sum(1 for kw in spam_kws if kw.lower() in lower)
    if spam_hits >= 2:
        return {
            "intent_score": "SPAM",
            "confidence": 0.85,
            "summary": f"Spam message (matches: {spam_hits})",
            "extracted_parameters": {
                "geo_origin": None, "budget_mentioned": None,
                "dates_mentioned": None, "service_category": "general",
            },
        }

    hot_hits = sum(1 for kw in hot_kws if kw.lower() in lower)
    warm_hits = sum(1 for kw in warm_kws if kw.lower() in lower)

    if hot_hits >= hot_thresh:
        return {
            "intent_score": "HOT",
            "confidence": min(0.7 + hot_hits * 0.05, 0.95),
            "summary": f"High interest (matches: {hot_hits})",
            "extracted_parameters": {
                "geo_origin": None, "budget_mentioned": None,
                "dates_mentioned": None, "service_category": "general",
            },
        }

    if warm_hits >= warm_thresh or hot_hits == 1:
        return {
            "intent_score": "WARM",
            "confidence": min(0.6 + warm_hits * 0.05, 0.90),
            "summary": f"Interest signals (matches: {warm_hits})",
            "extracted_parameters": {
                "geo_origin": None, "budget_mentioned": None,
                "dates_mentioned": None, "service_category": "general",
            },
        }

    return {
        "intent_score": "COLD",
        "confidence": 0.5,
        "summary": "Low engagement",
        "extracted_parameters": {
            "geo_origin": None, "budget_mentioned": None,
            "dates_mentioned": None, "service_category": "general",
        },
    }


async def classify_message(text: str, geo_tag: str = "", tenant_cfg: dict | None = None) -> dict:
    """Classify incoming message intent via LLM or keyword fallback.

    Args:
        text: Message text to classify
        geo_tag: Geographic tag for context
        tenant_cfg: Tenant's LLM settings (from tenant_settings["llm"])

    Returns dict with keys: intent_score, confidence, summary, extracted_parameters.
    """
    llm_cfg = (tenant_cfg or {}).get("llm", tenant_cfg or {})

    # Strip and validate
    text = text.strip()
    if not text or len(text) < 3:
        return _classify_by_keywords(text or "empty", llm_cfg)

    # Check provider setting
    provider = llm_cfg.get("provider", "auto")
    if provider == "keyword_only":
        return _classify_by_keywords(text, llm_cfg)

    # Check if any real LLM API key is configured
    has_llm = any(ep["key"] and not ep["key"].startswith("sk-...") for ep in LLM_ENDPOINTS)
    if not has_llm:
        log.debug("No real LLM API key configured, using keyword heuristic")
        return _classify_by_keywords(text, llm_cfg)

    system_prompt = llm_cfg.get("system_prompt", DEFAULT_SYSTEM_PROMPT)
    confidence_threshold = llm_cfg.get("confidence_threshold", 0.5)

    user_prompt = (
        f"SENDER_HANDLE: (incoming message)\n"
        f"MESSAGE_TEXT: {text}\n"
        f"CHANNEL_GEO_TAG: {geo_tag}\n\n"
        f"Classify this message. Return ONLY the JSON."
    )

    # Auto: try all endpoints in priority order. Specific: try only that provider.
    for ep in LLM_ENDPOINTS:
        if provider != "auto" and provider != ep["name"]:
            continue
        if not ep["key"]:
            continue
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(connect=5, read=settings.LLM_TIMEOUT)) as client:
                resp = await client.post(
                    ep["url"],
                    headers={
                        "Authorization": f"Bearer {ep['key']}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": ep["model"],
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "temperature": 0.1,
                        "max_tokens": 500,
                    },
                )
                resp.raise_for_status()
                raw = resp.json()["choices"][0]["message"]["content"].strip()

                # Strip markdown fences if present
                raw = re.sub(r"^```(?:json)?\s*", "", raw)
                raw = re.sub(r"\s*```$", "", raw)

                result = json.loads(raw)
                # Validate required keys
                assert result.get("intent_score") in ("HOT", "WARM", "COLD", "SPAM")
                assert 0 <= result.get("confidence", 0) <= 1

                # Reject if confidence too low
                if result.get("confidence", 0) < confidence_threshold:
                    log.info(f"LLM result confidence {result['confidence']} < threshold {confidence_threshold}, using keywords")
                    return _classify_by_keywords(text, llm_cfg)

                log.info(f"LLM classification ({ep['name']}): {result['intent_score']} "
                         f"confidence={result['confidence']}")
                return result

        except Exception as e:
            log.warning(f"LLM {ep['name']} failed: {e}, trying next")
            continue

    # All LLMs failed — fall back to keywords
    log.warning("All LLM providers failed, falling back to keyword heuristic")
    return _classify_by_keywords(text, llm_cfg)
