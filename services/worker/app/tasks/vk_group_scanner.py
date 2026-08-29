"""VK Group Scanner: monitor public VK community walls and discussions.

Queue: listener
Retry: 5 retries, 30s delay
Timeout: Infinite (long-polling)

Flow:
1. Connect to VK community via group token
2. Listen for new wall posts and comments
3. Classify each via LLM/keyword pipeline
4. Messages with buying intent → leads
"""
import asyncio
import logging
import time
import os

from celery import shared_task
from app.celery_app import celery

log = logging.getLogger(__name__)

_seen_vk: dict[str, set] = {}


@celery.task(name="app.tasks.vk_group_scanner.start_vk_group_scanner", queue="listener",
             bind=True, max_retries=5, default_retry_delay=30,
             acks_late=True, reject_on_worker_lost=True)
def start_vk_group_scanner(self, tenant_id: str, account_id: str,
                           group_id: int, monitor_group_id: str = ""):
    """Start monitoring a VK community wall for new posts and comments.

    group_id: VK community ID (positive integer)
    """
    log.info(f"start_vk_group_scanner: tenant={tenant_id} group={group_id}")

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(
            _run_vk_group_scanner(self, tenant_id, account_id,
                                  group_id, monitor_group_id)
        )
    except Exception as e:
        log.error(f"VK group scanner crashed: {e}")
        raise self.retry(exc=e)
    finally:
        loop.close()

    return {"status": "vk_scanner_stopped", "group_id": group_id}


async def _run_vk_group_scanner(task, tenant_id: str, account_id: str,
                                group_id: int, monitor_group_id: str):
    """Async runner: monitor VK group wall via Long Poll."""
    from app.vk_client import get_vk_group_session
    from app.lead_pipeline import process_incoming_message
    from app.config import DATABASE_URL
    import httpx, asyncpg

    group_token = os.getenv("VK_GROUP_TOKEN", "")
    if not group_token:
        log.error("No VK_GROUP_TOKEN configured")
        return

    vk_session = await get_vk_group_session(account_id, group_token)
    if vk_session is None:
        log.error(f"No VK session for account {account_id}")
        return

    vk = vk_session.get_api()

    # Update DB status
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
        except Exception:
            pass

    # Get Long Poll for community messages
    try:
        server_info = vk.messages.getLongPollServer(group_id=group_id)
        lp_server = server_info["server"]
        lp_key = server_info["key"]
        lp_ts = server_info["ts"]
    except Exception as e:
        log.error(f"VK LongPoll server error: {e}")
        return

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
                    server_info = await loop.run_in_executor(
                        None, lambda: vk.messages.getLongPollServer(group_id=group_id)
                    )
                    lp_server = server_info["server"]
                    lp_key = server_info["key"]
                    lp_ts = server_info["ts"]
                    continue

                lp_ts = raw.get("ts", lp_ts)
                updates = raw.get("updates", [])

                for event in updates:
                    # Type 4 = new message
                    if event[0] == 4:
                        flags = event[1]
                        peer_id = event[3]
                        text = event[5] if len(event) > 5 else ""

                        if flags & 2:  # outgoing
                            continue
                        if not text or len(text) < 3:
                            continue

                        # Dedup
                        msg_key = f"vk_group_{group_id}:{event[1]}"
                        if msg_key in _seen_vk.get(tenant_id, set()):
                            continue
                        _seen_vk.setdefault(tenant_id, set()).add(msg_key)

                        # Get sender
                        user_id = peer_id
                        try:
                            user_info = await loop.run_in_executor(
                                None,
                                lambda: vk.users.get(user_ids=user_id, fields="screen_name")[0],
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
                            post_id=str(event[1]),
                        )

                        log.info(f"VK Group lead: {result.get('intent_score')} from {user_handle}")

            except Exception as e:
                log.error(f"VK Group scanner error: {e}, reconnecting in 5s...")
                await asyncio.sleep(5)
                try:
                    server_info = await loop.run_in_executor(
                        None, lambda: vk.messages.getLongPollServer(group_id=group_id)
                    )
                    lp_server = server_info["server"]
                    lp_key = server_info["key"]
                    lp_ts = server_info["ts"]
                except Exception:
                    pass

    finally:
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
            except Exception:
                pass
        log.info(f"VK Group scanner stopped: {group_id}")
