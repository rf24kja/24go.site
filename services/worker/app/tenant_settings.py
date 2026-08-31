"""Worker-side sync tenant settings loader.

Celery tasks run synchronously, so we need a sync version of get_settings.
Uses the same DEFAULTS as the backend for consistency.
"""
import json
import logging
import uuid

import asyncpg

log = logging.getLogger(__name__)

# Same defaults as app.tenant_settings
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
}


def _ensure_dict(val):
    """If val is a JSON string, parse it. Otherwise return as-is."""
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            return parsed if isinstance(parsed, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}
    return val if isinstance(val, dict) else {}


def _deep_merge(base: dict, override: dict) -> dict:
    override = _ensure_dict(override)
    result = base.copy()
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(result.get(k), dict):
            result[k] = _deep_merge(result[k], v)
        else:
            result[k] = v
    return result


def get_tenant_settings_sync(url: str, tenant_id: str) -> dict:
    """Synchronous version for Celery tasks."""
    try:
        import asyncio
        conn = asyncio.get_event_loop().run_until_complete(
            _fetch_settings(url, tenant_id)
        )
        return conn
    except Exception as e:
        log.warning(f"Failed to load tenant settings: {e}, using defaults")
        return DEFAULTS.copy()


async def _fetch_settings(url: str, tenant_id: str) -> dict:
    conn = await asyncpg.connect(url)
    try:
        row = await conn.fetchrow(
            "SELECT settings FROM tenant_settings WHERE tenant_id = $1",
            uuid.UUID(tenant_id),
        )
    finally:
        await conn.close()

    if row and row["settings"]:
        return _deep_merge(DEFAULTS, row["settings"])
    return DEFAULTS.copy()


def get_tenant_settings_from_db(url: str, tenant_id: str) -> dict:
    """Sync version using a fresh event loop (safe for Celery workers)."""
    try:
        plain_url = url.replace("+asyncpg", "")
        import asyncio
        loop = asyncio.new_event_loop()
        try:
            settings = loop.run_until_complete(_fetch_settings(plain_url, tenant_id))
        finally:
            loop.close()
        return settings
    except Exception as e:
        log.warning(f"Failed to load tenant settings: {e}, using defaults")
        return DEFAULTS.copy()
