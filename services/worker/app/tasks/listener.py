"""Listener tasks: real-time DM interception for lead capture.

Queue: listener
Concurrency: Persistent daemon processes (1 Celery worker = 1 Telegram account)
Retry: Auto-restart on failure
Timeout: Infinite (long-polling)

Uses telegram_client.py factory for session management.
"""
import asyncio
import logging
import uuid as uuid_mod


from app.celery_app import celery

log = logging.getLogger(__name__)

# Track running listeners for graceful shutdown
_running_listeners: dict[str, asyncio.Task] = {}


@celery.task(name="app.tasks.listener.start_lead_listener", queue="listener",
             bind=True, max_retries=5, default_retry_delay=30,
             acks_late=True, reject_on_worker_lost=True)
def start_lead_listener(self, tenant_id: str, account_id: str):
    """Start a long-polling listener on an account for incoming DMs.

    Uses telegram_client.py factory — loads encrypted session from DB.
    Each incoming DM triggers the lead qualification pipeline.
    """
    try:
        uuid_mod.UUID(account_id)
        uuid_mod.UUID(tenant_id)
    except ValueError:
        log.warning(f"Invalid id format: tenant={tenant_id} account={account_id}, skipping listener")
        return {"status": "skipped", "reason": "invalid_uuid"}

    log.info(f"start_lead_listener: tenant={tenant_id} account={account_id}")

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(
            _run_listener(self, tenant_id, account_id)
        )
    except Exception as e:
        log.error(f"Listener crashed: {e}")
        raise self.retry(exc=e)
    finally:
        loop.close()

    return {"status": "listener_stopped", "account_id": account_id}


async def _run_listener(task, tenant_id: str, account_id: str):
    """Async runner: connects to Telegram via factory and listens for DMs."""
    from app.telegram_client import get_client, heartbeat, _set_status
    from app.lead_pipeline import process_incoming_message

    client = await get_client(account_id)
    if client is None:
        log.error(f"No session for account {account_id} — cannot start listener")
        _set_status(account_id, "error")
        return

    from telethon import events

    @client.on(events.NewMessage(incoming=True, func=lambda e: e.is_private))
    async def handler(event):
        """Handle incoming private messages → lead pipeline."""
        try:
            sender = await event.get_sender()
            user_handle = sender.username or sender.first_name or "unknown"
            user_full_name = " ".join(
                filter(None, [sender.first_name, sender.last_name])
            )
            message_text = event.message.text or ""

            if not message_text or len(message_text) < 3:
                return

            log.info(f"DM from @{user_handle}: {message_text[:80]}...")

            result = await process_incoming_message(
                tenant_id=tenant_id,
                platform="telegram",
                target_id="",
                account_id=account_id,
                user_handle=f"@{user_handle}",
                user_full_name=user_full_name,
                message_text=message_text,
                geo_tag="",
            )

            log.info(f"Lead processed: {result.get('intent_score')} "
                     f"handle=@{user_handle}")

        except Exception as e:
            log.error(f"Handler error: {e}")

    log.info(f"Listener connected for account {account_id}, waiting for DMs...")
    _set_status(account_id, "online")

    # Heartbeat loop — keep status fresh
    async def _heartbeat_loop():
        while True:
            await asyncio.sleep(30)
            heartbeat(account_id)

    heartbeat_task = asyncio.create_task(_heartbeat_loop())

    try:
        await client.run_until_disconnected()
    finally:
        heartbeat_task.cancel()
        _set_status(account_id, "offline")
        log.info(f"Listener disconnected for account {account_id}")
