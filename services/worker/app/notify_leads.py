"""Send lead notifications to Telegram/Slack."""
import logging
from typing import Optional

import httpx

log = logging.getLogger(__name__)

INTENT_PRIORITY = {"HOT": 3, "WARM": 2, "COLD": 1, "SPAM": 0}
INTENT_EMOJI = {"HOT": "\U0001f525", "WARM": "\U0001f7e1", "COLD": "\u2744\ufe0f", "SPAM": "\U0001f6ab"}


async def notify_new_lead(
    lead_handle: str,
    intent: str,
    message: str,
    source: str,
    geo: Optional[str],
    telegram_bot_token: str,
    telegram_chat_id: str,
    slack_webhook_url: str,
    min_intent: str = "WARM",
):
    """Send notification about a new lead to configured channels."""
    if INTENT_PRIORITY.get(intent, 0) < INTENT_PRIORITY.get(min_intent, 2):
        return

    emoji = INTENT_EMOJI.get(intent, "\U0001f4cc")
    geo_text = f" | \U0001f4cd {geo}" if geo else ""
    snippet = message[:200] + ("..." if len(message) > 200 else "")
    text = (
        f"{emoji} New {intent} Lead!\n\n"
        f"\U0001f464 {lead_handle}\n"
        f"\U0001f4ac {snippet}\n"
        f"\U0001f4f1 Source: {source}{geo_text}\n\n"
        f"\U0001f517 https://www.24go.site/leads"
    )

    if telegram_bot_token and telegram_chat_id:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"https://api.telegram.org/bot{telegram_bot_token}/sendMessage",
                    json={"chat_id": telegram_chat_id, "text": text, "parse_mode": "HTML"},
                    timeout=10,
                )
            log.info(f"Telegram notification sent for lead {lead_handle}")
        except Exception as e:
            log.warning(f"Telegram notification failed: {e}")

    if slack_webhook_url:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(slack_webhook_url, json={"text": text}, timeout=10)
            log.info(f"Slack notification sent for lead {lead_handle}")
        except Exception as e:
            log.warning(f"Slack notification failed: {e}")
