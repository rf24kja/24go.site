"""n8n webhook relay for lead alerts and CRM dispatch."""
import os
import httpx

from app.config import N8N_WEBHOOK_URL


async def notify_lead_captured(tenant_id: str, lead: dict):
    """POST lead payload to n8n webhook for CRM routing & mobile alerts."""
    if not N8N_WEBHOOK_URL:
        return

    payload = {
        "event": "lead_captured",
        "tenant_id": tenant_id,
        "data": {
            "lead_id": lead["id"],
            "intent_score": lead["intent_score"],
            "user_handle": lead["user_handle"],
            "geo_tag": lead.get("geo_tag", ""),
            "message_excerpt": lead["message_text"][:200],
            "dialog_url": lead["dialog_url"],
        },
    }
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            await client.post(N8N_WEBHOOK_URL, json=payload)
        except Exception:
            pass  # n8n is best-effort, never block the pipeline
