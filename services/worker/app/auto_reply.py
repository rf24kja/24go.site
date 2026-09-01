"""Auto-reply to HOT leads via Telegram."""
import asyncio
import logging
import random
import time

log = logging.getLogger(__name__)

# ponytail: in-memory rate limiter, fine for single-process worker
_reply_counts: dict[str, list[float]] = {}

INTENT_PRIORITY = {"HOT": 3, "WARM": 2, "COLD": 1, "SPAM": 0}


async def send_auto_reply(
    account_id: str,
    tenant_id: str,
    user_handle: str,
    intent: str,
    auto_reply_config: dict,
):
    """Send an auto-reply to a lead if configured."""
    if not auto_reply_config.get("enabled"):
        return

    min_intent = auto_reply_config.get("min_intent", "HOT")
    if INTENT_PRIORITY.get(intent, 0) < INTENT_PRIORITY.get(min_intent, 3):
        return

    # Rate limiting
    max_per_hour = auto_reply_config.get("max_replies_per_hour", 10)
    now = time.time()
    hour_ago = now - 3600

    if tenant_id not in _reply_counts:
        _reply_counts[tenant_id] = []

    _reply_counts[tenant_id] = [t for t in _reply_counts[tenant_id] if t > hour_ago]

    if len(_reply_counts[tenant_id]) >= max_per_hour:
        log.warning(f"Auto-reply rate limit reached for tenant {tenant_id}")
        return

    # Delay before replying
    delay = auto_reply_config.get("reply_delay_seconds", 5)
    await asyncio.sleep(delay)

    replies = auto_reply_config.get("replies", [])
    if not replies:
        reply_text = auto_reply_config.get("reply_message", "Thank you for your interest!")
    else:
        mode = auto_reply_config.get("reply_mode", "random")
        if mode == "cyclic":
            idx_key = f"reply_idx_{tenant_id}"
            idx = getattr(send_auto_reply, '_idx', {}).get(idx_key, 0)
            reply_text = replies[idx % len(replies)]
            if not hasattr(send_auto_reply, '_idx'):
                send_auto_reply._idx = {}
            send_auto_reply._idx[idx_key] = idx + 1
        else:
            reply_text = random.choice(replies)

    try:
        from app.telegram_client import get_client

        client = await get_client(account_id)
        if not client:
            log.warning(f"No Telegram client for account {account_id}")
            return

        if user_handle.startswith("@"):
            entity = await client.get_entity(user_handle[1:])
        else:
            entity = await client.get_entity(int(user_handle))

        if entity:
            await client.send_message(entity, reply_text)
            _reply_counts[tenant_id].append(now)
            log.info(f"Auto-reply sent to {user_handle} for tenant {tenant_id}")
        else:
            log.warning(f"Could not resolve entity for {user_handle}")

    except Exception as e:
        log.warning(f"Auto-reply failed for {user_handle}: {e}")
