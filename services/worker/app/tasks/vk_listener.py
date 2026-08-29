"""VK Listener: intercept incoming messages in VK communities.

Queue: listener
Retry: 5 retries, 30s delay
Timeout: Infinite (long-polling)

Uses VK Messages Long Poll API for real-time message interception.
"""
import asyncio
import logging
import time

from celery import shared_task
from app.celery_app import celery

log = logging.getLogger(__name__)

# ponytail: in-memory per worker. If multi-worker, use Redis set.
_last_event_ts: dict[str, int] = {}


@celery.task(name="app.tasks.vk_listener.start_vk_listener", queue="listener",
             bind=True, max_retries=5, default_retry_delay=30,
             acks_late=True, reject_on_worker_lost=True)
def start_vk_listener(self, tenant_id: str, account_id: str,
                      group_token: str, group_id: int):
    """Start long-polling listener on a VK community for incoming messages.

    group_token: VK community (service) token with messages permission
    group_id: VK community ID (positive integer)
    """
    log.info(f"start_vk_listener: tenant={tenant_id} account={account_id} group={group_id}")

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(
            _run_vk_listener(self, tenant_id, account_id, group_token, group_id)
        )
    except Exception as e:
        log.error(f"VK Listener crashed: {e}")
        raise self.retry(exc=e)
    finally:
        loop.close()

    return {"status": "vk_listener_stopped", "account_id": account_id}


async def _run_vk_listener(task, tenant_id: str, account_id: str,
                           group_token: str, group_id: int):
    """Async runner: connects to VK Long Poll and listens for messages."""
    from app.vk_client import get_vk_group_session
    from app.lead_pipeline import process_incoming_message
    import httpx

    vk_session = await get_vk_group_session(account_id, group_token)
    if vk_session is None:
        log.error(f"No VK session for account {account_id}")
        return

    vk = vk_session.get_api()

    # Get Long Poll server
    try:
        server_info = vk.messages.getLongPollServer(group_id=group_id)
        lp_server = server_info["server"]
        lp_key = server_info["key"]
        lp_ts = server_info["ts"]
    except Exception as e:
        log.error(f"Failed to get LongPoll server: {e}")
        return

    log.info(f"VK Listener connected for group {group_id}, waiting for messages...")
    _set_vk_status(account_id, "online")

    # Heartbeat
    async def _heartbeat():
        while True:
            await asyncio.sleep(30)
            _set_vk_status(account_id, "online")

    heartbeat_task = asyncio.create_task(_heartbeat())

    try:
        while True:
            try:
                # Long Poll request (blocking in sync vk_api, run in executor)
                loop = asyncio.get_event_loop()
                raw = await loop.run_in_executor(
                    None,
                    lambda: httpx.get(
                        f"{lp_server}?act=a_check&key={lp_key}&ts={lp_ts}&wait=25",
                        timeout=30,
                    ).json(),
                )

                if raw.get("failed"):
                    # Reconnect
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
                    # Event type 4 = new message
                    if event[0] == 4:
                        flags = event[1]
                        peer_id = event[3]
                        text = event[5] if len(event) > 5 else ""

                        # Skip outgoing messages (bit 2 = 0x2)
                        if flags & 2:
                            continue
                        # Skip service messages
                        if not text or len(text) < 3:
                            continue

                        # Get sender info
                        user_id = peer_id  # For PM, peer_id == user_id
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

                        log.info(f"VK message from {user_handle}: {text[:80]}...")

                        # Dedup
                        if _last_event_ts.get(account_id, 0) >= event[1]:
                            continue
                        _last_event_ts[account_id] = event[1]

                        # Process through lead pipeline
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

            except Exception as e:
                log.error(f"VK LongPoll error: {e}, reconnecting in 5s...")
                await asyncio.sleep(5)
                # Reconnect
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
        heartbeat_task.cancel()
        _set_vk_status(account_id, "offline")
        log.info(f"VK Listener disconnected for account {account_id}")


def _set_vk_status(account_id: str, status: str) -> None:
    """Set VK connection status in Redis."""
    import redis
    import json
    import os
    try:
        r = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"))
        r.set(f"tg_status:{account_id}", json.dumps({
            "status": status,
            "updated_at": time.time(),
            "platform": "vkontakte",
        }))
    except Exception:
        pass
