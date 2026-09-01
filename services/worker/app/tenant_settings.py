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
    "llm": {
        "provider": "auto",
        "model": "deepseek-chat",
        "system_prompt": (
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
    "auto_reply": {
        "enabled": False,
        "min_intent": "HOT",
        "reply_mode": "random",
        "replies": [
            "Thank you for your interest! Our manager will contact you shortly. 🙏",
            "Hi there! Thanks for reaching out. We'll get back to you soon! 😊",
            "Great to hear from you! Our team will follow up shortly. ✨"
        ],
        "reply_delay_seconds": 5,
        "max_replies_per_hour": 10,
    },
}


def _ensure_dict(val):
    """Ensure val is a dict, handling strings and other types."""
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


async def get_tenant_settings_from_db(tenant_id: str) -> dict:
    """Async version — use when already in async context."""
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
            return _deep_merge(DEFAULTS, raw)
        return DEFAULTS.copy()
    except Exception as e:
        log.warning(f"Failed to load tenant settings for {tenant_id}: {e}")
        return DEFAULTS.copy()
    finally:
        await conn.close()


def get_tenant_settings_sync(tenant_id: str) -> dict:
    """Sync version — use from sync Celery tasks."""
    import concurrent.futures
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(asyncio.run, get_tenant_settings_from_db(tenant_id)).result()
        else:
            return loop.run_until_complete(get_tenant_settings_from_db(tenant_id))
    except RuntimeError:
        return asyncio.run(get_tenant_settings_from_db(tenant_id))
