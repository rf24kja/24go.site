"""Tenant settings: per-tenant JSONB configuration with defaults.

Usage:
    from app.tenant_settings import get_settings, DEFAULTS
    cfg = await get_settings(db_url, tenant_id)
    prompt = cfg["llm"]["system_prompt"]
"""
import json
import logging
import uuid

import asyncpg

log = logging.getLogger(__name__)

# ── Default settings for every section ──────────────────────────────
DEFAULTS = {
    "llm": {
        "provider": "auto",              # auto | openrouter | deepseek | openai | keyword_only
        "model": "deepseek-chat",         # model name
        "system_prompt": (
            "You are an expert sales analyst for a B2B lead generation system.\n\n"
            "Analyze an incoming message and extract qualification parameters.\n\n"
            "Return strictly a valid JSON object:\n"
            '{\n'
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
        "hot_keywords": [
            "сколько стоит", "цена", "купить", "аренду", "оплатить",
            "готов", "заказать", "стоимость", "buy", "price", "order",
        ],
        "warm_keywords": [
            "подскажите", "какие есть", "расскажите", "варианты",
            "интересует", "хотел бы", "планирую", "interested", "tell me more",
        ],
        "spam_keywords": [
            "casino", "crypto", "earn money", "заработать",
            "бесплатно", "free", "click here", "нажми",
        ],
        "hot_threshold": 2,        # keyword matches needed for HOT
        "warm_threshold": 1,       # keyword matches needed for WARM
        "confidence_threshold": 0.5,  # min confidence to accept LLM result
    },
    "warmup": {
        "channels": [
            "https://t.me/s/ru2ch",
            "https://t.me/s/pikabu",
            "https://t.me/s/born2chat",
        ],
        "reactions": ["👍", "❤️", "🔥", "😊", "👀"],
        "stage1_days": 3,         # passive: read feeds + reactions
        "stage2_days": 4,         # soft: join groups, non-commercial
        "stage3_daily_limit": 20, # production: max posts/day
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
        "comment_scrape_delay_sec": 120,  # delay before scraping comments
        "spintax_max_depth": 10,
    },
    "notifications": {
        "notify_on": ["HOT", "WARM"],       # intent scores that trigger email
        "daily_summary": True,
        "daily_summary_hour": 9,            # UTC
        "email_subject_prefix": "[LeadGen]",
        "lead_created_sound": False,
        "telegram_bot_token": "",           # User's own bot token
        "telegram_chat_id": "",             # Chat/group ID to send notifications
        "slack_webhook_url": "",            # Slack incoming webhook URL
        "notify_min_intent": "WARM",        # Minimum intent to notify (HOT, WARM)
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
    "webhooks": {
        "enabled": False,
        "url": "",
        "secret": "",
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
    """Merge override into base, returning new dict. Lists are replaced, not merged."""
    override = _ensure_dict(override)
    result = base.copy()
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(result.get(k), dict):
            result[k] = _deep_merge(result[k], v)
        else:
            result[k] = v
    return result


async def get_settings(url: str, tenant_id: str) -> dict:
    """Get merged settings for a tenant (defaults + overrides)."""
    try:
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
    except Exception as e:
        log.warning(f"Failed to load tenant settings, using defaults: {e}")
        return DEFAULTS.copy()


async def get_section(url: str, tenant_id: str, section: str) -> dict:
    """Get a single section's merged settings."""
    cfg = await get_settings(url, tenant_id)
    return cfg.get(section, DEFAULTS.get(section, {}))


async def upsert_settings(url: str, tenant_id: str, new_settings: dict) -> dict:
    """Merge new_settings into existing and save. Returns full merged settings."""
    existing = await get_settings(url, tenant_id)
    merged = _deep_merge(existing, new_settings)

    conn = await asyncpg.connect(url)
    try:
        await conn.execute(
            """INSERT INTO tenant_settings (id, tenant_id, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
               ON CONFLICT (tenant_id) DO UPDATE
               SET settings = tenant_settings.settings || $2, updated_at = NOW()""",
            uuid.UUID(tenant_id),
            json.dumps(merged),
        )
    finally:
        await conn.close()

    return merged


async def reset_section(url: str, tenant_id: str, section: str) -> dict:
    """Reset a section to defaults and save."""
    existing = await get_settings(url, tenant_id)
    existing[section] = DEFAULTS.get(section, {})
    conn = await asyncpg.connect(url)
    try:
        await conn.execute(
            """INSERT INTO tenant_settings (id, tenant_id, settings, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
               ON CONFLICT (tenant_id) DO UPDATE
               SET settings = $2, updated_at = NOW()""",
            uuid.UUID(tenant_id),
            json.dumps(existing),
        )
    finally:
        await conn.close()
    return existing
