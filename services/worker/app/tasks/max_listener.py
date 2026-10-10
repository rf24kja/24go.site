"""MAX Listener: long-poll bot updates via GET /updates.

Queue: listener
Retry: 5 retries, 30s delay
Timeout: Infinite (long-polling)

Bot must exist in DB (account_pool platform='max', token in account_sessions).
Each message_created with text goes through the shared lead pipeline.
"""
import asyncio
import logging

from celery import shared_task
from app.celery_app import celery

log = logging.getLogger(__name__)


@celery.task(name="app.tasks.max_listener.start_max_listener", queue="listener",
             bind=True, max_retries=5, default_retry_delay=30,
             acks_late=True, reject_on_worker_lost=True)
def start_max_listener(self, tenant_id: str, account_id: str):
    """Start long-polling MAX bot updates. Token loaded from DB."""
    log.info(f"start_max_listener: tenant={tenant_id} account={account_id}")

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(
            _run_max_listener(self, tenant_id, account_id)
        )
    except asyncio.CancelledError:
        log.info(f"MAX Listener cancelled for {account_id}")
    except Exception as e:
        log.error(f"MAX Listener crashed: {e}")
        raise self.retry(exc=e)
    finally:
        loop.close()

    return {"status": "max_listener_stopped", "account_id": account_id}


async def _run_max_listener(task, tenant_id: str, account_id: str):
    from app.max_client import load_max_token, get_updates
    from app.db_pool import get_redis
    from app.lead_pipeline import process_incoming_message

    token = await load_max_token(account_id)
    if not token:
        log.error(f"No MAX token for account {account_id}")
        return

    redis = await get_redis()
    marker_key = f"max_marker:{account_id}"
    try:
        marker_raw = await redis.get(marker_key)
        marker = int(marker_raw) if marker_raw else None
    except Exception:
        marker = None

    log.info(f"MAX listener polling for account {account_id}")
    while True:
        updates, marker = await get_updates(token, marker=marker, timeout=30)
        if marker is not None:
            try:
                await redis.set(marker_key, str(marker))
            except Exception:
                pass
        for upd in updates:
            try:
                await _handle_update(tenant_id, account_id, upd, process_incoming_message)
            except Exception as e:
                log.error(f"MAX update handling failed: {e}")
        await asyncio.sleep(1)


async def _handle_update(tenant_id, account_id, upd, process_incoming_message):
    update_type = upd.get("update_type", "")
    if update_type not in ("message_created", "bot_started"):
        return
    msg = upd.get("message") or {}
    # Skip own bot messages to avoid loops
    sender = msg.get("sender") or upd.get("user") or {}
    if sender.get("is_bot"):
        return
    text = (msg.get("text") or "").strip()
    if not text:
        return
    user_id = str(sender.get("user_id") or msg.get("sender_id") or "unknown")
    chat = msg.get("chat") or {}
    await process_incoming_message(
        tenant_id=tenant_id,
        platform="max",
        target_id="",
        account_id=account_id,
        user_handle=f"max_{user_id}",
        user_full_name=str(sender.get("name") or "")[:255],
        message_text=text[:2000],
        geo_tag="",
        source="max_chat" if chat.get("chat_id") else "max_dm",
    )
