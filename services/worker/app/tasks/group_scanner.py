"""Group Scanner: monitor public Telegram groups for lead signals.

Queue: listener (same as DM listener — long-running)
Retry: 5 retries, 30s delay
Timeout: Infinite (long-polling)

Flow:
1. Join/enter a public Telegram group
2. Listen for ALL new messages (not just DMs)
3. Classify each message via LLM/keyword pipeline
4. Messages with buying intent → leads
"""
import asyncio
import logging
import time

from celery import shared_task
from app.celery_app import celery

log = logging.getLogger(__name__)

# ponytail: in-memory dedup per worker with max size to prevent OOM
_seen_messages: dict[str, set] = {}
_MAX_SEEN = 10000  # max message IDs per tenant before evicting oldest


@celery.task(name="app.tasks.group_scanner.start_group_scanner", queue="listener",
             bind=True, max_retries=5, default_retry_delay=30,
             acks_late=True, reject_on_worker_lost=True)
def start_group_scanner(self, tenant_id: str, account_id: str,
                        group_username: str, monitor_group_id: str = ""):
    """Start monitoring a public Telegram group for incoming messages.

    group_username: Telegram group/channel username (e.g. "@phuket_rentals")
    monitor_group_id: UUID of the monitored_groups DB row
    """
    log.info(f"start_group_scanner: tenant={tenant_id} group={group_username}")

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(
            _run_group_scanner(self, tenant_id, account_id,
                               group_username, monitor_group_id)
        )
    except Exception as e:
        log.error(f"Group scanner crashed: {e}")
        raise self.retry(exc=e)
    finally:
        loop.close()

    return {"status": "scanner_stopped", "group": group_username}


async def _run_group_scanner(task, tenant_id: str, account_id: str,
                             group_username: str, monitor_group_id: str):
    """Async runner: connect to group and listen for messages."""
    from app.telegram_client import get_client, _set_status
    from app.lead_pipeline import process_incoming_message
    from app.config import DATABASE_URL
    import asyncpg, os

    client = await get_client(account_id)
    if client is None:
        log.error(f"No session for account {account_id} — cannot start group scanner")
        _set_status(account_id, "error")
        if monitor_group_id:
            try:
                db_url = DATABASE_URL.replace("+asyncpg", "")
                conn = await asyncpg.connect(db_url)
                try:
                    await conn.execute(
                        "UPDATE monitored_groups SET status = 'error' WHERE id = $1",
                        __import__('uuid').UUID(monitor_group_id),
                    )
                finally:
                    await conn.close()
            except Exception:
                pass
        return

    from telethon import events

    # Get group entity
    try:
        entity = await client.get_entity(group_username)
        group_title = getattr(entity, 'title', group_username)
        log.info(f"Group scanner connected to: {group_title} ({group_username})")
    except Exception as e:
        log.error(f"Cannot find group {group_username}: {e}")
        _set_status(account_id, "error")
        if monitor_group_id:
            try:
                db_url = DATABASE_URL.replace("+asyncpg", "")
                conn = await asyncpg.connect(db_url)
                try:
                    await conn.execute(
                        "UPDATE monitored_groups SET status = 'error' WHERE id = $1",
                        __import__('uuid').UUID(monitor_group_id),
                    )
                finally:
                    await conn.close()
            except Exception:
                pass
        return

    # Update monitored_groups status in DB
    if monitor_group_id:
        try:
            db_url = DATABASE_URL.replace("+asyncpg", "")
            conn = await asyncpg.connect(db_url)
            try:
                await conn.execute(
                    "UPDATE monitored_groups SET status = 'scanning', last_scan_at = NOW() WHERE id = $1",
                    __import__('uuid').UUID(monitor_group_id),
                )
            finally:
                await conn.close()
        except Exception as e:
            log.debug(f"DB update failed: {e}")

    _set_status(account_id, "scanning_group")

    # Cache bot ID to avoid get_me() per message
    try:
        _bot_id = (await client.get_me()).id
    except Exception:
        _bot_id = 0

    @client.on(events.NewMessage(chats=entity))
    async def handler(event):
        """Handle new message in the monitored group."""
        try:
            # Skip own messages (cached bot ID)
            if event.message.sender_id == _bot_id:
                return

            text = event.message.text or ""
            if not text or len(text) < 3:
                return

            # Dedup with max size to prevent OOM
            msg_id = f"{group_username}:{event.message.id}"
            if msg_id in _seen_messages.get(tenant_id, set()):
                return
            tenant_seen = _seen_messages.setdefault(tenant_id, set())
            if len(tenant_seen) >= _MAX_SEEN:
                tenant_seen.clear()  # Evict all when full (ponytail: simple, not precise)
            tenant_seen.add(msg_id)

            # Get sender info
            sender = await event.get_sender()
            if sender is None:
                return

            user_handle = (getattr(sender, 'username', None)
                          or getattr(sender, 'first_name', None)
                          or "unknown")
            user_full_name = " ".join(
                filter(None, [getattr(sender, 'first_name', ''),
                              getattr(sender, 'last_name', '')])
            )

            log.info(f"Group msg in {group_username}: @{user_handle}: {text[:80]}...")

            # Process through lead pipeline
            result = await process_incoming_message(
                tenant_id=tenant_id,
                platform="telegram",
                target_id="",
                account_id=account_id,
                user_handle=f"@{user_handle}",
                user_full_name=user_full_name,
                message_text=text,
                geo_tag="",
                source="group",
                post_id=str(event.message.id),
            )

            intent = result.get("intent_score", "COLD")
            log.info(f"Group lead: {intent} from @{user_handle} in {group_username}")

        except Exception as e:
            log.error(f"Group scanner handler error: {e}")

    # Heartbeat loop
    async def _heartbeat():
        while True:
            await asyncio.sleep(30)
            _set_status(account_id, "scanning_group")

    heartbeat_task = asyncio.create_task(_heartbeat())

    log.info(f"Group scanner active: {group_username}, listening for messages...")
    try:
        await client.run_until_disconnected()
    finally:
        heartbeat_task.cancel()
        _set_status(account_id, "offline")
        # Update DB status
        if monitor_group_id:
            try:
                db_url = DATABASE_URL.replace("+asyncpg", "")
                conn = await asyncpg.connect(db_url)
                try:
                    await conn.execute(
                        "UPDATE monitored_groups SET status = 'idle' WHERE id = $1",
                        __import__('uuid').UUID(monitor_group_id),
                    )
                finally:
                    await conn.close()
            except Exception as e:
                log.warning(f"Group scanner cleanup error: {e}")
        log.info(f"Group scanner stopped: {group_username}")
