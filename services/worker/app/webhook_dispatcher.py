"""Send outbound webhooks to n8n for events (new leads, etc.)."""
import hashlib
import hmac
import json
import logging

import httpx

log = logging.getLogger(__name__)


async def dispatch_lead_webhooks(
    tenant_id: str,
    lead_data: dict,
    webhook_config: dict,
):
    """Send webhook to n8n when a new lead is captured."""
    if not webhook_config.get("enabled"):
        return

    url = webhook_config.get("url", "")
    if not url:
        return

    payload = {
        "event": "lead.new",
        "tenant_id": tenant_id,
        "data": lead_data,
        "timestamp": lead_data.get("created_at", ""),
    }

    payload_bytes = json.dumps(payload, default=str).encode()
    secret = webhook_config.get("secret", "")

    try:
        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Event": "lead.new",
            "X-Tenant-Id": tenant_id,
        }

        if secret:
            signature = hmac.new(
                secret.encode(), payload_bytes, hashlib.sha256
            ).hexdigest()
            headers["X-Webhook-Signature"] = f"sha256={signature}"

        async with httpx.AsyncClient() as client:
            resp = await client.post(url, content=payload_bytes, headers=headers, timeout=10)

        if 200 <= resp.status_code < 300:
            log.info(f"Webhook sent to {url} for tenant {tenant_id}")
        else:
            log.warning(f"Webhook {url} returned {resp.status_code}")
    except Exception as e:
        log.warning(f"Webhook to {url} failed: {e}")
