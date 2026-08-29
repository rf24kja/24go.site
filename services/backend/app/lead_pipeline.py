"""Lead processing pipeline: classify → upsert → dispatch.

Ponytail: single function orchestrates the full flow.
Uses SELECT → INSERT/UPDATE instead of ON CONFLICT (no unique constraint on leads).
"""
import logging
import uuid
from datetime import datetime

import asyncpg

from app.config import settings
DATABASE_URL = settings.DATABASE_URL.replace("+asyncpg", "")  # asyncpg needs plain postgresql://
from app.llm_classifier import classify_message
from app.scoring import get_rules, classify_with_rules

try:
    from app.webhooks import notify_lead_captured
except ImportError:
    notify_lead_captured = None

log = logging.getLogger(__name__)

INSERT_SQL = """
INSERT INTO leads (
    id, tenant_id, platform, target_id, account_id, user_handle,
    user_full_name, geo_tag, message_text, intent_score, status,
    dialog_url, created_at
) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, 'new',
    $11, NOW()
) RETURNING id;
"""

UPDATE_SQL = """
UPDATE leads SET
    message_text = $1,
    intent_score = $2,
    created_at = NOW()
WHERE id = $3
RETURNING id;
"""

FIND_SQL = """
SELECT id FROM leads
WHERE tenant_id = $1 AND user_handle = $2
ORDER BY created_at DESC LIMIT 1;
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
) -> dict:
    """Full pipeline: classify → upsert → dispatch webhook.

    Returns lead_id and intent_score.
    """
    # 1. Try custom scoring rules first, fallback to LLM/keyword
    try:
        # Load tenant settings for LLM config
        from app.tenant_settings import get_settings as _get_tenant_settings
        tenant_cfg = await _get_tenant_settings(DATABASE_URL, tenant_id)

        custom_rules = await get_rules(DATABASE_URL, tenant_id)
        if custom_rules:
            intent_score, confidence = classify_with_rules(message_text, custom_rules)
            classification = {
                "intent_score": intent_score,
                "confidence": confidence,
                "summary": f"Classified by custom rule ({intent_score})",
                "extracted_parameters": {},
            }
        else:
            classification = await classify_message(message_text, geo_tag, tenant_cfg=tenant_cfg)
    except Exception as e:
        log.warning(f"Custom scoring failed, falling back to LLM: {e}")
        classification = await classify_message(message_text, geo_tag, tenant_cfg=locals().get("tenant_cfg"))
    intent_score = classification["intent_score"]

    # 2. Build dialog URL
    if platform == "telegram":
        dialog_url = f"https://t.me/{user_handle.lstrip('@')}"
    elif platform == "vkontakte":
        dialog_url = f"https://vk.com/{user_handle.lstrip('@')}"
    else:
        dialog_url = ""

    # 3. Upsert into leads table
    lead_id = None
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        try:
            # Check for existing lead from same handle
            existing = await conn.fetchrow(
                FIND_SQL,
                uuid.UUID(tenant_id),
                user_handle,
            )

            if existing:
                # Update existing lead
                row = await conn.fetchrow(
                    UPDATE_SQL,
                    message_text,
                    intent_score,
                    existing["id"],
                )
                lead_id = str(row["id"])
            else:
                # Insert new lead
                row = await conn.fetchrow(
                    INSERT_SQL,
                    uuid.uuid4(),
                    uuid.UUID(tenant_id),
                    platform,
                    uuid.UUID(target_id) if target_id else None,
                    uuid.UUID(account_id) if account_id else None,
                    user_handle,
                    user_full_name or "",
                    geo_tag,
                    message_text,
                    intent_score,
                    dialog_url,
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
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        if notify_lead_captured:
            try:
                await notify_lead_captured(tenant_id, lead_payload)
            except Exception as e:
                log.warning(f"Webhook dispatch failed (non-blocking): {e}")

    return {
        "status": "processed",
        "lead_id": lead_id,
        "intent_score": intent_score,
        "confidence": classification.get("confidence"),
        "summary": classification.get("summary"),
    }
