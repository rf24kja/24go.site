"""Listener tasks: real-time message interception for lead capture.

Queue: listener
Concurrency: Persistent daemon processes (1 Celery worker = 1 Telegram account)
Retry: Auto-restart on failure
Timeout: Infinite (long-polling)
"""
import asyncio
import logging
import os

from celery import shared_task

from app.celery_app import celery

log = logging.getLogger(__name__)

# Lazy import to avoid circular deps and heavy startup
_telethon_imported = False
_events = None
_TelegramClient = None


def _ensure_telethon():
    global _telethon_imported, _events, _TelegramClient
    if _telethon_imported:
        return
    try:
        from telethon import TelegramClient, events
        _TelegramClient = TelegramClient
        _events = events
        _telethon_imported = True
    except ImportError:
        log.warning("telethon not installed — listener will run in mock mode")


@celery.task(name="app.tasks.listener.start_lead_listener", queue="listener",
             bind=True, max_retries=5, default_retry_delay=30)
def start_lead_listener(self, tenant_id: str, account_id: str):
    """Start a long-polling listener on an account for incoming DMs.

    Uses Telethon to maintain a persistent connection to Telegram.
    Each incoming DM triggers the lead qualification pipeline.
    """
    log.info(f"start_lead_listener: tenant={tenant_id} account={account_id}")

    _ensure_telethon()

    if _TelegramClient is None:
        log.error("Telethon not available — cannot start listener")
        return {"status": "error", "error": "telethon not installed"}

    api_id = int(os.getenv("TG_API_ID", "0"))
    api_hash = os.getenv("TG_API_HASH", "")

    if not api_id or not api_hash:
        log.error("TG_API_ID / TG_API_HASH not configured")
        return {"status": "error", "error": "missing telegram credentials"}

    # Run the async event loop
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(
            _run_listener(tenant_id, account_id, api_id, api_hash)
        )
    except Exception as e:
        log.error(f"Listener crashed: {e}")
        raise self.retry(exc=e)
    finally:
        loop.close()

    return {"status": "listener_stopped", "account_id": account_id}


async def _run_listener(tenant_id: str, account_id: str, api_id: int, api_hash: str):
    """Async runner: connects to Telegram and listens for DMs."""
    from app.lead_pipeline import process_incoming_message

    # Session file per account (ponytail: reuse Telethon's session management)
    session_name = f"/app/sessions/{account_id}"
    client = _TelegramClient(session_name, api_id, api_hash)

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

            await process_incoming_message(
                tenant_id=tenant_id,
                platform="telegram",
                target_id="",  # resolved from account mapping
                account_id=account_id,
                user_handle=f"@{user_handle}",
                user_full_name=user_full_name,
                message_text=message_text,
                geo_tag="",  # TODO: resolve from target
            )
        except Exception as e:
            log.error(f"Handler error: {e}")

    await client.start()
    log.info(f"Listener connected for account {account_id}, waiting for DMs...")
    await client.run_until_disconnected()
