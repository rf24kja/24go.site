"""VK Health Check: periodic task to restart dead listeners.

Runs every 5 minutes via Celery Beat.
Checks vk_status:{account_id} keys in Redis.
If an account should be active but has no status, re-dispatches the listener.
"""
import json
import logging

from celery import shared_task
from app.celery_app import celery

log = logging.getLogger(__name__)


@celery.task(name="app.tasks.vk_health_check.check_vk_listeners", queue="warmup")
def check_vk_listeners():
    """Check all active VK accounts and restart dead listeners."""
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_check_listeners())
    finally:
        loop.close()


async def _check_listeners():
    import redis.asyncio as aioredis
    from app.config import REDIS_URL, DATABASE_URL
    import asyncpg

    r = aioredis.from_url(REDIS_URL, decode_responses=True)
    conn_url = DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(conn_url)
    try:
        # Find all active VK accounts
        rows = await conn.fetch(
            """SELECT ap.id, ap.tenant_id, ap.platform
               FROM account_pools ap
               WHERE ap.platform = 'vkontakte' AND ap.status IN ('active', 'warming_up')"""
        )

        for row in rows:
            account_id = str(row["id"])
            tenant_id = str(row["tenant_id"])
            status_key = f"vk_status:{account_id}"
            status_raw = await r.get(status_key)

            if not status_raw:
                # No status key = listener is dead, restart it
                log.info(f"VK health check: restarting listener for {account_id}")
                try:
                    from app.tasks.vk_listener import start_vk_listener
                    # Get group_id from account_pools metadata
                    meta = await conn.fetchrow(
                        "SELECT group_id FROM account_pools WHERE id = $1",
                        row["id"],
                    )
                    group_id = (meta or {}).get("group_id", 0)
                    if group_id:
                        start_vk_listener.apply_async(
                            args=[tenant_id, account_id, group_id],
                        )
                except Exception as e:
                    log.error(f"Failed to restart VK listener for {account_id}: {e}")
    finally:
        await conn.close()
        await r.aclose()
