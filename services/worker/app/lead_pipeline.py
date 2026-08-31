"""Lead processing pipeline: classify → upsert → dispatch.

Ponytail: single function orchestrates the full flow.
Uses SELECT → INSERT/UPDATE instead of ON CONFLICT (no unique constraint on leads).
"""
import logging
import os
import uuid
from datetime import datetime, timezone

import asyncpg
import httpx

from app.config import DATABASE_URL
DATABASE_URL = DATABASE_URL.replace("+asyncpg", "")  # asyncpg needs plain postgresql://
from app.llm_classifier import classify_message
from app.webhooks import notify_lead_captured

log = logging.getLogger(__name__)

INSERT_SQL = """
INSERT INTO leads (
    id, tenant_id, platform, target_id, account_id, user_handle,
    user_full_name, geo_tag, message_text, intent_score, status,
    dialog_url, source, post_id, created_at
) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, 'new',
    $11, $12, $13, NOW()
)
ON CONFLICT (tenant_id, user_handle) DO UPDATE SET
    message_text = EXCLUDED.message_text,
    intent_score = EXCLUDED.intent_score,
    created_at = NOW()
RETURNING id;
"""

UPDATE_SQL = """
UPDATE leads SET
    message_text = $1,
    intent_score = $2,
    created_at = NOW()
WHERE id = $3
RETURNING id;
"""


async def process_incoming_message(
    tenant_id: str,
    platform: str,
    target_id: str,
    account_id: str,
    user_handle: str,
    user_full_name: str,
    message_text: str,
    geo_tag: str = "",
    source: str = "dm",
    post_id: str | None = None,
) -> dict:
    """Full pipeline: classify → upsert → dispatch webhook.

    Returns lead_id and intent_score.
    """
    # 1. Classify via LLM (keyword heuristic fallback)
    from app.tenant_settings import get_tenant_settings_from_db
    tenant_cfg = await get_tenant_settings_from_db(tenant_id)
    classification = await classify_message(message_text, geo_tag, tenant_cfg=tenant_cfg)  # ponytail: tenant_cfg passed for keyword merge
    intent_score = classification["intent_score"]

    # 2. Build dialog URL
    if platform == "telegram":
        dialog_url = f"https://t.me/{user_handle.lstrip('@')}"
    elif platform == "vkontakte":
        dialog_url = f"https://vk.com/{user_handle.lstrip('@')}"
    else:
        dialog_url = ""

    # 3. Upsert into leads table (ON CONFLICT for race-safe upsert)
    lead_id = None
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        try:
            row = await conn.fetchrow(
                INSERT_SQL,
                uuid.uuid4(),
                uuid.UUID(tenant_id),
                platform,
                uuid.UUID(target_id) if target_id and target_id.strip() else None,
                uuid.UUID(account_id) if account_id and account_id.strip() else None,
                user_handle,
                user_full_name or "",
                geo_tag,
                message_text,
                intent_score,
                dialog_url,
                source,
                post_id,
            )
            lead_id = str(row["id"])

            log.info(f"Lead upserted: {lead_id} intent={intent_score}")
        finally:
            await conn.close()
    except Exception as e:
        log.error(f"Lead upsert failed: {e}")
        return {"status": "error", "error": str(e)}

    # 4. Dispatch webhook for HOT/WARM leads
    if intent_score in ("HOT", "WARM"):
        lead_payload = {
            "id": lead_id,
            "platform": platform,
            "user_handle": user_handle,
            "user_full_name": user_full_name or "",
            "geo_tag": geo_tag,
            "intent_score": intent_score,
            "confidence_score": classification.get("confidence", 0),
            "summary": classification.get("summary", ""),
            "extracted_parameters": classification.get("extracted_parameters", {}),
            "message_text": message_text[:500],
            "dialog_url": dialog_url,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            await notify_lead_captured(tenant_id, lead_payload)
        except Exception as e:
            log.warning(f"Webhook dispatch failed (non-blocking): {e}")

        # Email alert for HOT/WARM leads
        try:
            from app.notifications import notify_hot_lead
            await notify_hot_lead(tenant_id, lead_payload, tenant_cfg)
        except Exception as e:
            log.debug(f"Email notify failed (non-blocking): {e}")

        # Telegram/Slack notifications
        try:
            from app.notify_leads import notify_new_lead
            notif_cfg = tenant_cfg.get("notifications", {})
            if notif_cfg.get("telegram_bot_token") or notif_cfg.get("slack_webhook_url"):
                await notify_new_lead(
                    lead_handle=user_handle,
                    intent=intent_score,
                    message=message_text[:500],
                    source=source,
                    geo=geo_tag or None,
                    telegram_bot_token=notif_cfg.get("telegram_bot_token", ""),
                    telegram_chat_id=notif_cfg.get("telegram_chat_id", ""),
                    slack_webhook_url=notif_cfg.get("slack_webhook_url", ""),
                    min_intent=notif_cfg.get("notify_min_intent", "WARM"),
                )
        except Exception as e:
            log.debug(f"Telegram/Slack notify failed (non-blocking): {e}")

    # 5. Broadcast to backend WebSocket for real-time dashboard
    try:
        backend_url = os.getenv("BACKEND_URL", "http://fastapi:8000")
        internal_key = os.getenv("INTERNAL_API_KEY", "")
        if backend_url and internal_key:
            async with httpx.AsyncClient(timeout=5) as hx:
                await hx.post(
                    f"{backend_url}/internal/broadcast",
                    json={
                        "tenant_id": tenant_id,
                        "event": {
                            "type": "lead_qualified",
                            "data": {
                                "id": lead_id,
                                "user_handle": user_handle,
                                "intent_score": intent_score,
                                "source": source,
                                "message_text": message_text[:200],
                                "geo_tag": geo_tag,
                                "status": "new",
                                "created_at": datetime.now(timezone.utc).isoformat(),
                            },
                        },
                    },
                    headers={"X-Internal-Key": internal_key},
                )
    except Exception as e:
        log.debug(f"Broadcast failed (non-blocking): {e}")

    return {
        "status": "processed",
        "lead_id": lead_id,
        "intent_score": intent_score,
        "confidence": classification.get("confidence"),
        "summary": classification.get("summary"),
    }
