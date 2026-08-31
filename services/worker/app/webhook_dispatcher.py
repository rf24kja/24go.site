"""Send outbound webhooks for events (new leads, etc.)."""
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
    """Send webhooks when a new lead is captured."""
    if not webhook_config.get("enabled"):
        return

    urls = webhook_config.get("urls", [])
    if not urls:
        return

    payload = {
        "event": "lead.new",
        "tenant_id": tenant_id,
        "data": lead_data,
        "timestamp": lead_data.get("created_at", ""),
    }

    payload_bytes = json.dumps(payload, default=str).encode()

    async with httpx.AsyncClient() as client:
        for entry in urls:
            url = entry.get("url", "")
            secret = entry.get("secret", "")
            events = entry.get("events", ["lead.new"])

            if "lead.new" not in events or not url:
                continue

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

                resp = await client.post(url, content=payload_bytes, headers=headers, timeout=10)

                if 200 <= resp.status_code < 300:
                    log.info(f"Webhook sent to {url} for tenant {tenant_id}")
                else:
                    log.warning(f"Webhook {url} returned {resp.status_code}")
            except Exception as e:
                log.warning(f"Webhook to {url} failed: {e}")
