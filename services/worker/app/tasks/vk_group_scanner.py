"""VK Group Scanner: monitor public VK community walls and discussions.

Queue: listener
Retry: 5 retries, 30s delay
Timeout: Infinite (long-polling)

Flow:
1. Connect to VK community via group token (from DB)
2. Listen for new wall posts and comments via Groups LongPoll
3. Classify each via LLM/keyword pipeline
4. Messages with buying intent → leads
"""
import asyncio
import json
import logging
import time
import uuid

from celery import shared_task
from app.celery_app import celery

log = logging.getLogger(__name__)


@celery.task(name="app.tasks.vk_group_scanner.start_vk_group_scanner", queue="listener",
             bind=True, max_retries=5, default_retry_delay=30,
             acks_late=True, reject_on_worker_lost=True)
def start_vk_group_scanner(self, tenant_id: str, account_id: str,
                           group_id: int, monitor_group_id: str = ""):
    """Start monitoring a VK community wall for new posts and comments.

    group_id: VK community ID (positive integer)
    Token is loaded from DB via account_id.
    """
    log.info(f"start_vk_group_scanner: tenant={tenant_id} group={group_id}")

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(
            _run_vk_group_scanner(self, tenant_id, account_id,
                                  group_id, monitor_group_id)
        )
    except asyncio.CancelledError:
        log.info(f"VK Group scanner cancelled for {group_id}")
    except Exception as e:
        log.error(f"VK group scanner crashed: {e}")
        raise self.retry(exc=e)
    finally:
        loop.close()

    return {"status": "vk_scanner_stopped", "group_id": group_id}


async def _run_vk_group_scanner(task, tenant_id: str, account_id: str,
                                group_id: int, monitor_group_id: str):
    from app.vk_client import (
        get_vk_group_session_for, get_longpoll_server,
        _handle_vk_error, handle_flood_wait,
    )
    from app.lead_pipeline import process_incoming_message
    from app.config import DATABASE_URL
    from app.db_pool import execute as pool_execute
    import httpx

    vk_session = await get_vk_group_session_for(account_id)
    if vk_session is None:
        log.error(f"No VK session for account {account_id}")
        return

    # Update DB status
    if monitor_group_id:
        try:
            await pool_execute(
                "UPDATE monitored_groups SET status = 'scanning', last_scan_at = NOW() WHERE id = $1",
                uuid.UUID(monitor_group_id),
            )
        except Exception:
            pass

    loop = asyncio.get_event_loop()

    # Groups LongPoll server
    lp = await loop.run_in_executor(
        None, lambda: get_longpoll_server(vk_session, group_id)
    )
    if lp is None:
        return

    lp_server, lp_key, lp_ts = lp["server"], lp["key"], lp["ts"]
    log.info(f"VK Group Scanner connected: group={group_id}")

    loop = asyncio.get_event_loop()

    try:
        while True:
            try:
                raw = await loop.run_in_executor(
                    None,
                    lambda: httpx.get(
                        f"{lp_server}?act=a_check&key={lp_key}&ts={lp_ts}&wait=25",
                        timeout=30,
                    ).json(),
                )

                if raw.get("failed"):
                    log.warning(f"VK LongPoll failed ({raw['failed']}), reconnecting...")
                    if raw["failed"] == 1:
                        pass  # Keep old ts, VK will replay events
                    else:
                        lp = await loop.run_in_executor(
                            None, lambda: get_longpoll_server(vk_session, group_id)
                        )
                        if lp:
                            lp_server, lp_key, lp_ts = lp["server"], lp["key"], lp["ts"]
                    continue

                lp_ts = raw.get("ts", lp_ts)
                updates = raw.get("updates", [])

                for event in updates:
                    if event[0] == 4:
                        message_id = event[1]
                        flags = event[2]
                        peer_id = event[3]
                        text = event[5] if len(event) > 5 else ""

                        if flags & 2:
                            continue
                        if not text or len(text) < 3:
                            continue

                        # Redis dedup
                        dedup_key = f"vk:scanner:{account_id}:{message_id}:{peer_id}"
                        if await _is_duplicate(dedup_key):
                            continue

                        user_id = peer_id if peer_id > 0 else 0
                        if user_id <= 0:
                            continue

                        try:
                            vk = vk_session.get_api()
                            user_info = await loop.run_in_executor(
                                None,
                                lambda: vk.users.get(user_ids=str(user_id), fields="screen_name")[0],
                            )
                            user_handle = f"@{user_info.get('screen_name', user_id)}"
                            user_full = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
                        except Exception:
                            user_handle = f"vk_{user_id}"
                            user_full = ""

                        log.info(f"VK Group msg in {group_id}: {user_handle}: {text[:80]}...")

                        result = await process_incoming_message(
                            tenant_id=tenant_id,
                            platform="vkontakte",
                            target_id=str(group_id),
                            account_id=account_id,
                            user_handle=user_handle,
                            user_full_name=user_full,
                            message_text=text,
                            geo_tag="",
                            source="group",
                        )
                        log.info(f"VK Group lead: {result.get('intent_score')} from {user_handle}")
                        await _mark_seen(dedup_key)

            except Exception as e:
                vk_err = _handle_vk_error(e)
                if vk_err.code == 921:
                    await handle_flood_wait(vk_err)
                elif vk_err.code in (5, 7, 15, 113):
                    log.error(f"VK auth error {vk_err.code}: token revoked — stopping scanner")
                    from app.vk_client import disconnect_vk
                    disconnect_vk(account_id)
                    return
                log.error(f"VK Group scanner error: {e}, reconnecting in 5s...")
                await asyncio.sleep(5)
                lp = await loop.run_in_executor(
                    None, lambda: get_longpoll_server(vk_session, group_id)
                )
                if lp:
                    lp_server, lp_key, lp_ts = lp["server"], lp["key"], lp["ts"]

    finally:
        if monitor_group_id:
            try:
                await pool_execute(
                    "UPDATE monitored_groups SET status = 'idle' WHERE id = $1",
                    uuid.UUID(monitor_group_id),
                )
            except Exception:
                pass
        log.info(f"VK Group scanner stopped: {group_id}")


_dedup_redis = None

async def _get_dedup_redis():
    global _dedup_redis
    if _dedup_redis is None:
        import redis.asyncio as aioredis
        from app.config import REDIS_URL
        _dedup_redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    return _dedup_redis


async def _is_duplicate(key: str) -> bool:
    r = await _get_dedup_redis()
    return await r.exists(key)


async def _mark_seen(key: str) -> None:
    r = await _get_dedup_redis()
    await r.set(key, "1", ex=3600)
