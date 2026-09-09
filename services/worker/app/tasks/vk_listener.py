"""VK Listener: intercept incoming messages in VK communities.

Queue: listener
Retry: 5 retries, 30s delay
Timeout: Infinite (long-polling)

Uses VK Groups Long Poll API for real-time community event interception.
Groups LP delivers: messages, wall posts, comments, member joins, etc.
"""
import asyncio
import json
import logging
import time

from celery import shared_task
from app.celery_app import celery

log = logging.getLogger(__name__)


@celery.task(name="app.tasks.vk_listener.start_vk_listener", queue="listener",
             bind=True, max_retries=5, default_retry_delay=30,
             acks_late=True, reject_on_worker_lost=True)
def start_vk_listener(self, tenant_id: str, account_id: str,
                      group_id: int):
    """Start long-polling listener on a VK community for incoming events.

    group_id: VK community ID (positive integer)
    Token is loaded from DB via account_id.
    """
    log.info(f"start_vk_listener: tenant={tenant_id} account={account_id} group={group_id}")

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(
            _run_vk_listener(self, tenant_id, account_id, group_id)
        )
    except Exception as e:
        log.error(f"VK Listener crashed: {e}")
        raise self.retry(exc=e)
    finally:
        loop.close()

    return {"status": "vk_listener_stopped", "account_id": account_id}


async def _run_vk_listener(task, tenant_id: str, account_id: str, group_id: int):
    """Async runner: connects to VK Groups Long Poll and listens for events."""
    from app.vk_client import (
        get_vk_group_session_for, get_longpoll_server,
        _handle_vk_error, handle_flood_wait,
    )
    from app.lead_pipeline import process_incoming_message
    import httpx

    vk_session = await get_vk_group_session_for(account_id)
    if vk_session is None:
        log.error(f"No VK session for account {account_id}")
        return

    # Get Groups Long Poll server (NOT messages.getLongPollServer)
    lp = get_longpoll_server(vk_session, group_id)
    if lp is None:
        return

    lp_server, lp_key, lp_ts = lp["server"], lp["key"], lp["ts"]

    log.info(f"VK Listener connected for group {group_id}, waiting for events...")
    _set_vk_status(account_id, "online")

    # ponytail: cached Redis connection for heartbeat
    _heartbeat_redis = None

    async def _heartbeat():
        nonlocal _heartbeat_redis
        import redis
        import os
        while True:
            await asyncio.sleep(30)
            _set_vk_status(account_id, "online")

    heartbeat_task = asyncio.create_task(_heartbeat())

    try:
        while True:
            try:
                loop = asyncio.get_event_loop()
                raw = await loop.run_in_executor(
                    None,
                    lambda: httpx.get(
                        f"{lp_server}?act=a_check&key={lp_key}&ts={lp_ts}&wait=25",
                        timeout=30,
                    ).json(),
                )

                if raw.get("failed"):
                    log.warning(f"VK LongPoll failed ({raw['failed']}), reconnecting...")
                    lp = get_longpoll_server(vk_session, group_id)
                    if lp:
                        lp_server, lp_key, lp_ts = lp["server"], lp["key"], lp["ts"]
                    continue

                lp_ts = raw.get("ts", lp_ts)
                updates = raw.get("updates", [])

                for event in updates:
                    await _handle_event(event, tenant_id, account_id, group_id, vk_session)

            except Exception as e:
                vk_err = _handle_vk_error(str(e))
                if vk_err.code == 921:
                    await handle_flood_wait(vk_err)
                log.error(f"VK LongPoll error: {e}, reconnecting in 5s...")
                await asyncio.sleep(5)
                lp = get_longpoll_server(vk_session, group_id)
                if lp:
                    lp_server, lp_key, lp_ts = lp["server"], lp["key"], lp["ts"]

    finally:
        heartbeat_task.cancel()
        _set_vk_status(account_id, "offline")
        log.info(f"VK Listener disconnected for account {account_id}")


# ── Groups LongPoll Event Types ─────────────────────────────────────────
# VK Groups LP v2 event types:
#   1  =uild conversation entry (ignore)
#   4  =uild message (NEW_MESSAGE)
#   5  =uild edit message
#   7  =uild message incoming (in conversations)
#   8  =uild user online
#   9  =uild user offline
#  10  =uild wall post
#  12  =uild wall post restored
#  13  =uild wall post deleted
#  14  =uild comment added
#  15  =uild comment edited
#  16  =uild comment deleted
#  33  =uild group change settings
#  34  =uild group change photo
#  35  =uild group change officers
#  51  =uild group member join
#  52  =uild group member leave

async def _handle_event(event: list, tenant_id: str, account_id: str,
                        group_id: int, vk_session):
    """Process a single VK Groups LongPoll event."""
    from app.lead_pipeline import process_incoming_message

    event_type = event[0]

    # Only process message events (type 4)
    # ponytail: wall posts (10) and comments (14) handled by scraper, not listener
    if event_type != 4:
        return

    # VK Groups LP type 4 format: [4, flags, peer_id, timestamp, text, extras...]
    # peer_id for group conversations = 2000000000 + chat_id
    # peer_id for user PM = user_id directly
    flags = event[1]
    peer_id = event[3]
    text = event[5] if len(event) > 5 else ""

    # Skip outgoing messages (bit 2 = 0x2)
    if flags & 2:
        return
    # Skip service messages
    if not text or len(text) < 3:
        return

    # Dedup via Redis
    dedup_key = f"vk:msg:{account_id}:{event[1]}:{peer_id}"
    if await _is_duplicate(dedup_key):
        return
    await _mark_seen(dedup_key)

    # Get sender info — peer_id is user_id for PMs
    user_id = peer_id if peer_id > 0 else 0
    if user_id <= 0:
        return

    try:
        vk = vk_session.get_api()
        user_info = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: vk.users.get(user_ids=user_id, fields="screen_name")[0],
        )
        user_handle = f"@{user_info.get('screen_name', user_id)}"
        user_full = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
    except Exception:
        user_handle = f"vk_{user_id}"
        user_full = ""

    log.info(f"VK message from {user_handle}: {text[:80]}...")

    try:
        result = await process_incoming_message(
            tenant_id=tenant_id,
            platform="vkontakte",
            target_id=str(group_id),
            account_id=account_id,
            user_handle=user_handle,
            user_full_name=user_full,
            message_text=text,
            geo_tag="",
            source="dm",
        )
        log.info(f"VK Lead: {result.get('intent_score')} from {user_handle}")
    except Exception as e:
        log.error(f"VK lead pipeline error: {e}")


# ── Redis Dedup ─────────────────────────────────────────────────────────

async def _is_duplicate(key: str) -> bool:
    """Check Redis for duplicate event (1-hour window)."""
    import redis.asyncio as aioredis
    from app.config import REDIS_URL
    r = aioredis.from_url(REDIS_URL, decode_responses=True)
    try:
        return await r.exists(key)
    finally:
        await r.aclose()


async def _mark_seen(key: str) -> None:
    """Mark event as seen in Redis with 1-hour TTL."""
    import redis.asyncio as aioredis
    from app.config import REDIS_URL
    r = aioredis.from_url(REDIS_URL, decode_responses=True)
    try:
        await r.set(key, "1", ex=3600)
    finally:
        await r.aclose()


# ── Status ──────────────────────────────────────────────────────────────

def _set_vk_status(account_id: str, status: str) -> None:
    """Set VK connection status in Redis with TTL."""
    import redis
    import os
    try:
        _set_vk_status._conn = getattr(_set_vk_status, '_conn', None)
        if _set_vk_status._conn is None:
            _set_vk_status._conn = redis.Redis.from_url(
                os.getenv("REDIS_URL", "redis://redis:6379/0"),
                decode_responses=True,
            )
        _set_vk_status._conn.setex(f"tg_status:{account_id}", 300, json.dumps({
            "status": status,
            "updated_at": time.time(),
            "platform": "vkontakte",
        }))
    except Exception as e:
        log.warning(f"Failed to set VK status: {e}")
        _set_vk_status._conn = None
