"""LLM zero-shot intent classifier for incoming messages.

Supports DeepSeek-V3 and OpenAI GPT-4o-mini via HTTP.
Falls back to keyword heuristic if no API key configured.
"""
import json
import logging
import os
import re

import httpx

log = logging.getLogger(__name__)

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "15"))

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

SYSTEM_PROMPT = """You are an expert sales analyst for a B2B travel and real estate lead generation system in Thailand (Phuket).

Your task is to analyze an incoming private message or comment reply and extract key qualification parameters.

[Output Requirement]
Return strictly a valid JSON object with the following fields:
{
  "intent_score": "HOT" | "WARM" | "COLD" | "SPAM",
  "confidence": 0.00 to 1.00,
  "summary": "Brief 1-sentence summary of the buyer request in Russian",
  "extracted_parameters": {
    "geo_origin": "Extracted city/region or null if unknown",
    "budget_mentioned": "Extracted budget string or null",
    "dates_mentioned": "Extracted dates string or null",
    "service_category": "villas" | "tours" | "real_estate_buy" | "currency" | "general"
  }
}

[Constraint]
Return ONLY the JSON string. Do NOT include markdown code fences or conversational text."""

# Keyword fallback heuristics (ponytail: fast path before hitting LLM)
HOT_KEYWORDS = [
    "сколько стоит", "цена", "бронировать", "забронировать", "записаться",
    "купить", "аренду", "оплатить", "готов", "заказать", "стоимость",
    "вилл", "недвижимость", "дом", "квартир", "таунхаус",
]
WARM_KEYWORDS = [
    "подскажите", "какие есть", "расскажите", "варианты", "каталог",
    "интересует", "хотел бы", "планирую", "в ноябре", "в декабре",
    "с детьми", "экскурси", "валют",
]
SPAM_KEYWORDS = [
    "заработок", "без вложений", "жми", "кликай", "telegram bot",
    "earn money", "free crypto", "casino", "viagra",
]


def _classify_by_keywords(text: str, ai_cfg: dict | None = None) -> dict:
    """Fast keyword heuristic — ponytail: skip LLM if signal is clear.

    Merges tenant-specific keywords from ai_auto_reply settings if provided.
    """
    lower = text.lower()

    # Merge tenant keywords if configured
    hot_kw = list(HOT_KEYWORDS)
    warm_kw = list(WARM_KEYWORDS)
    spam_kw = list(SPAM_KEYWORDS)
    if ai_cfg:
        hot_kw.extend(ai_cfg.get("hot_keywords", []))
        warm_kw.extend(ai_cfg.get("warm_keywords", []))
        spam_kw.extend(ai_cfg.get("spam_keywords", []))

    spam_hits = sum(1 for kw in spam_kw if kw in lower)
    if spam_hits >= 2:
        return {
            "intent_score": "SPAM",
            "confidence": 0.85,
            "summary": f"Спам-сообщение (совпадений: {spam_hits})",
            "extracted_parameters": {
                "geo_origin": None, "budget_mentioned": None,
                "dates_mentioned": None, "service_category": "general",
            },
        }

    hot_hits = sum(1 for kw in hot_kw if kw in lower)
    warm_hits = sum(1 for kw in warm_kw if kw in lower)

    if hot_hits >= 2:
        return {
            "intent_score": "HOT",
            "confidence": min(0.7 + hot_hits * 0.05, 0.95),
            "summary": f"Высокий интерес (совпадений: {hot_hits})",
            "extracted_parameters": {
                "geo_origin": None, "budget_mentioned": None,
                "dates_mentioned": None, "service_category": "general",
            },
        }

    if warm_hits >= 1 or hot_hits == 1:
        return {
            "intent_score": "WARM",
            "confidence": min(0.6 + warm_hits * 0.05, 0.90),
            "summary": f"Интерес к информации (совпадений: {warm_hits})",
            "extracted_parameters": {
                "geo_origin": None, "budget_mentioned": None,
                "dates_mentioned": None, "service_category": "general",
            },
        }

    return {
        "intent_score": "COLD",
        "confidence": 0.5,
        "summary": "Низкая вовлечённость",
        "extracted_parameters": {
            "geo_origin": None, "budget_mentioned": None,
            "dates_mentioned": None, "service_category": "general",
        },
    }


async def classify_message(text: str, geo_tag: str = "", ai_cfg: dict | None = None) -> dict:
    """Classify incoming message intent via LLM or keyword fallback.

    Returns dict with keys: intent_score, confidence, summary, extracted_parameters.
    """
    # Strip and validate
    text = text.strip()
    if not text or len(text) < 3:
        return _classify_by_keywords(text or "empty", ai_cfg)

    # Check if any real LLM API key is configured (skip placeholder values)
    has_llm = any(ep["key"] and not ep["key"].startswith("sk-...") for ep in LLM_ENDPOINTS)
    if not has_llm:
        log.debug("No real LLM API key configured, using keyword heuristic")
        return _classify_by_keywords(text, ai_cfg)

    user_prompt = (
        f"SENDER_HANDLE: (incoming message)\n"
        f"MESSAGE_TEXT: {text}\n"
        f"CHANNEL_GEO_TAG: {geo_tag}\n\n"
        f"Classify this message. Return ONLY the JSON."
    )

    # Use tenant-specific system prompt if configured
    system_prompt = SYSTEM_PROMPT
    if ai_cfg:
        custom_prompt = ai_cfg.get("classification_prompt", "")
        if custom_prompt:
            system_prompt = custom_prompt

    for ep in LLM_ENDPOINTS:
        if not ep["key"]:
            continue
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(connect=5, read=LLM_TIMEOUT)) as client:
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
                log.info(f"LLM classification ({ep['name']}): {result['intent_score']} "
                         f"confidence={result['confidence']}")
                return result

        except Exception as e:
            log.warning(f"LLM {ep['name']} failed: {e}, trying next")
            continue

    # All LLMs failed — fall back to keywords
    log.warning("All LLM providers failed, falling back to keyword heuristic")
    return _classify_by_keywords(text, ai_cfg)
