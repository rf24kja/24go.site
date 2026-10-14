"""Tenant settings loader — async + sync versions.

Use get_tenant_settings_from_db() with await from async contexts.
Use get_tenant_settings_sync() from sync Celery tasks.
"""
import asyncio
import json
import logging
import uuid

import asyncpg

log = logging.getLogger(__name__)

DEFAULTS = {
    "ai_auto_reply": {
        "llm_provider": "auto",
        "llm_api_key": "",
        "llm_model": "deepseek-chat",
        "classification_prompt": (
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
        ),
        "hot_keywords": ["сколько стоит", "цена", "купить", "аренду", "оплатить", "готов", "заказать", "стоимость", "buy", "price", "order"],
        "warm_keywords": ["подскажите", "какие есть", "расскажите", "варианты", "интересует", "хотел бы", "планирую", "interested", "tell me more"],
        "spam_keywords": ["casino", "crypto", "earn money", "заработать", "бесплатно", "free", "click here", "нажми"],
        "hot_threshold": 2,
        "warm_threshold": 1,
        "confidence_threshold": 0.5,
        "reply_prompt": (
            "Ты — вежливый менеджер по продажам B2B. "
            "Отвечай на русском языке кратко и по делу. "
            "Используй информацию из сообщения клиента."
        ),
        "reply_temperature": 0.7,
        "reply_max_tokens": 500,
        "reply_enabled": False,
        "ai_reply_for": "HOT",
        "template_reply_for": "WARM",
        "reply_mode": "random",
        "templates": [
            "Спасибо за интерес! Менеджер свяжется с вами. 🙏",
            "Здравствуйте! Мы скоро ответим. 😊",
        ],
        "channels": {"telegram": True, "vkontakte": True},
        "reply_delay_seconds": 5,
        "max_replies_per_hour": 10,
        "work_hours_start": 9,
        "work_hours_end": 21,
        "blacklist_usernames": "",
    },
    "warmup": {
        "channels": ["https://t.me/s/ru2ch", "https://t.me/s/pikabu", "https://t.me/s/born2chat"],
        "reactions": ["👍", "❤️", "🔥", "😊", "👀"],
        "stage1_days": 3,
        "stage2_days": 4,
        "stage3_daily_limit": 20,
        "stage1_actions_per_day": 5,
        "stage2_actions_per_day": 10,
        "random_delay_min_sec": 2,
        "random_delay_max_sec": 8,
    },
    "posting": {
        "utm_source": "leadgen",
        "utm_medium": "social",
        "utm_campaign": "auto",
        "delay_between_posts_sec": 30,
        "max_comment_replies_per_post": 10,
        "comment_scrape_delay_sec": 120,
        "spintax_max_depth": 10,
    },
    "notifications": {
        "notify_on": ["HOT", "WARM"],
        "daily_summary": True,
        "daily_summary_hour": 9,
        "email_subject_prefix": "[LeadGen]",
    },
    "groups": {
        "scan_interval_min": 30,
        "max_messages_per_scan": 50,
        "auto_discover_enabled": True,
        "auto_discover_interval_hours": 6,
        "min_members_count": 100,
        "prefer_open_comments": True,
    },
}


def _ensure_dict(val):
    if isinstance(val, dict):
        return val
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            if isinstance(parsed, dict):
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass
    return {}


def _deep_merge(base: dict, override: dict) -> dict:
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def _migrate_old_sections(raw: dict) -> dict:
    """Merge legacy llm + auto_reply sections into ai_auto_reply."""
    ai = raw.get("ai_auto_reply", {})
    changed = False

    llm = raw.pop("llm", None)
    if llm:
        ai.setdefault("llm_provider", llm.get("provider", "auto"))
        ai.setdefault("llm_model", llm.get("model", "deepseek-chat"))
        ai.setdefault("llm_api_key", llm.get("api_key", ""))
        ai.setdefault("classification_prompt", llm.get("system_prompt", ""))
        ai.setdefault("hot_keywords", llm.get("hot_keywords", []))
        ai.setdefault("warm_keywords", llm.get("warm_keywords", []))
        ai.setdefault("spam_keywords", llm.get("spam_keywords", []))
        ai.setdefault("hot_threshold", llm.get("hot_threshold", 2))
        ai.setdefault("warm_threshold", llm.get("warm_threshold", 1))
        ai.setdefault("confidence_threshold", llm.get("confidence_threshold", 0.5))
        changed = True

    ar = raw.pop("auto_reply", None)
    if ar:
        ai.setdefault("reply_enabled", ar.get("enabled", False))
        min_intent = ar.get("min_intent", "HOT")
        if min_intent == "HOT":
            ai.setdefault("ai_reply_for", "HOT")
            ai.setdefault("template_reply_for", "WARM")
        else:
            ai.setdefault("ai_reply_for", "WARM")
            ai.setdefault("template_reply_for", "OFF")
        ai.setdefault("reply_mode", ar.get("reply_mode", "random"))
        ai.setdefault("templates", ar.get("replies", []))
        ai.setdefault("reply_delay_seconds", ar.get("reply_delay_seconds", 5))
        ai.setdefault("max_replies_per_hour", ar.get("max_replies_per_hour", 10))
        ai.setdefault("work_hours_start", ar.get("work_hours_start", 9))
        ai.setdefault("work_hours_end", ar.get("work_hours_end", 21))
        changed = True

    if changed:
        raw["ai_auto_reply"] = ai
    return raw


# Services with per-service settings overlays (mirrors backend
# app/tenant_settings.py — same shape, workers read their platform's view).
SERVICES = ("telegram", "vkontakte", "whatsapp", "max", "facebook")


def _apply_service_overlay(merged: dict, raw: dict, service: str | None) -> dict:
    """Deep-merge services.{service}.* over each base section."""
    if not service:
        return merged
    overlays = (raw.get("services") or {}).get(service) or {}
    for section, override in overlays.items():
        if section in merged and isinstance(override, dict):
            merged[section] = _deep_merge(merged[section], override)
    return merged


async def get_tenant_settings_from_db(tenant_id: str, service: str | None = None) -> dict:
    """Async version — use when already in async context.

    With service: per-service overlay applied. Base behavior unchanged.
    """
    from app.config import DATABASE_URL
    url = DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(url)
    try:
        row = await conn.fetchrow(
            "SELECT settings FROM tenant_settings WHERE tenant_id = $1",
            uuid.UUID(tenant_id),
        )
        if row and row["settings"]:
            raw = row["settings"]
            if isinstance(raw, str):
                raw = json.loads(raw)
            raw = _migrate_old_sections(raw)
            return _apply_service_overlay(_deep_merge(DEFAULTS, raw), raw, service)
        return DEFAULTS.copy()
    except Exception as e:
        log.warning(f"Failed to load tenant settings for {tenant_id}: {e}")
        return DEFAULTS.copy()
    finally:
        await conn.close()


def get_tenant_settings_sync(tenant_id: str, service: str | None = None) -> dict:
    """Sync version — use from sync Celery tasks."""
    import concurrent.futures
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(asyncio.run, get_tenant_settings_from_db(tenant_id, service)).result()
        else:
            return loop.run_until_complete(get_tenant_settings_from_db(tenant_id, service))
    except RuntimeError:
        return asyncio.run(get_tenant_settings_from_db(tenant_id, service))
