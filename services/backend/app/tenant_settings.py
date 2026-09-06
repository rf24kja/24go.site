"""Tenant settings: per-tenant JSONB configuration with defaults.

Usage:
    from app.tenant_settings import get_settings, DEFAULTS
    cfg = await get_settings(db_url, tenant_id)
    prompt = cfg["ai_auto_reply"]["classification_prompt"]
"""
import json
import logging
import uuid

import asyncpg

log = logging.getLogger(__name__)

# ── Default settings for every section ──────────────────────────────
DEFAULTS = {
    "ai_auto_reply": {
        # LLM Provider (shared for classification + reply generation)
        "llm_provider": "auto",
        "llm_api_key": "",
        "llm_model": "deepseek-chat",

        # Classification
        "classification_prompt": (
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
        "hot_threshold": 2,
        "warm_threshold": 1,
        "confidence_threshold": 0.5,

        # AI Reply Generation
        "reply_prompt": (
            "Ты — вежливый менеджер по продажам B2B. "
            "Отвечай на русском языке кратко и по делу. "
            "Используй информацию из сообщения клиента. "
            "Не используй шаблонные фразы. Будь конкретным."
        ),
        "reply_temperature": 0.7,
        "reply_max_tokens": 500,

        # Reply Rules
        "reply_enabled": False,
        "ai_reply_for": "HOT",          # HOT | WARM | OFF
        "template_reply_for": "WARM",   # WARM | OFF
        "reply_mode": "random",         # random | cyclic
        "templates": [
            "Спасибо за интерес! Менеджер свяжется с вами. 🙏",
            "Здравствуйте! Мы скоро ответим. 😊",
        ],

        # Schedule & Limits
        "channels": {"telegram": True, "vkontakte": True},
        "reply_delay_seconds": 5,
        "max_replies_per_hour": 10,
        "work_hours_start": 9,
        "work_hours_end": 21,
        "blacklist_usernames": "",
    },
    "warmup": {
        "channels": [
            "https://t.me/s/ru2ch",
            "https://t.me/s/pikabu",
            "https://t.me/s/born2chat",
        ],
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
        "lead_created_sound": False,
        "telegram_bot_token": "",
        "telegram_chat_id": "",
        "slack_webhook_url": "",
        "notify_min_intent": "WARM",
    },
    "groups": {
        "scan_interval_min": 30,
        "max_messages_per_scan": 50,
        "auto_discover_enabled": True,
        "auto_discover_interval_hours": 6,
        "min_members_count": 100,
        "prefer_open_comments": True,
    },
    "tgstat": {
        "api_token": "",
        "default_country": "ru",
        "default_language": "russian",
    },
    "webhooks": {
        "enabled": False,
        "url": "",
        "secret": "",
    },
    "security": {
        "two_factor_enabled": False,
        "session_timeout": "30min",
        "ip_whitelist": "",
        "login_notifications": True,
    },
    "data": {
        "data_retention_days": "90",
        "auto_delete_old_leads": False,
        "gdpr_mode": False,
    },
}

# Ponytail: migration — merge old llm+auto_reply into ai_auto_reply on first load
_MIGRATION_DONE: set[str] = set()


def _migrate_old_sections(raw: dict) -> dict:
    """Merge legacy llm + auto_reply sections into ai_auto_reply. Idempotent."""
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
            raw = row["settings"]
            if isinstance(raw, str):
                raw = json.loads(raw)

            # Migration: merge old llm+auto_reply into ai_auto_reply
            if tenant_id not in _MIGRATION_DONE:
                migrated = _migrate_old_sections(raw)
                if migrated is not raw:
                    _MIGRATION_DONE.add(tenant_id)
                    try:
                        conn2 = await asyncpg.connect(url)
                        try:
                            await conn2.execute(
                                """INSERT INTO tenant_settings (id, tenant_id, settings, created_at, updated_at)
                                   VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
                                   ON CONFLICT (tenant_id) DO UPDATE
                                   SET settings = $2, updated_at = NOW()""",
                                uuid.UUID(tenant_id),
                                json.dumps(migrated),
                            )
                        finally:
                            await conn2.close()
                    except Exception as e:
                        log.warning(f"Migration save failed for {tenant_id}: {e}")
                    raw = migrated

            return _deep_merge(DEFAULTS, raw)
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
