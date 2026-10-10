"""MAX Poster: send messages via POST /messages.

Queue: poster
Retry: 3 retries
Timeout: 60s

Rate limit: MAX allows 30 rps platform-wide; per-account daily cap enforced
via account_pool.daily_action_limit (conservative default from account row).
"""
import asyncio
import logging
import random
import uuid

from celery import shared_task
from app.celery_app import celery

log = logging.getLogger(__name__)


@celery.task(name="app.tasks.max_poster.post_to_max", queue="poster",
             bind=True, max_retries=3, default_retry_delay=60)
def post_to_max(self, tenant_id: str, account_id: str,
                chat_id: str = "", user_id: str = "",
                text: str = "", campaign_id: str = "",
                target_id: str = ""):
    """Send a text message to a MAX chat or user."""
    log.info(f"post_to_max: tenant={tenant_id} account={account_id}")

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(
            _publish_max_post(tenant_id, account_id, chat_id, user_id,
                              text, campaign_id, target_id)
        )
    except Exception as e:
        log.error(f"post_to_max failed: {e}")
        raise self.retry(exc=e)
    finally:
        loop.close()

    return result


async def _publish_max_post(tenant_id, account_id, chat_id, user_id,
                            text, campaign_id, target_id) -> dict:
    from app.max_client import load_max_token, send_message
    from app.db_pool import get_pool, execute as pool_execute

    token = await load_max_token(account_id)
    if not token:
        return {"status": "error", "error": "no_token"}

    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT daily_action_limit, actions_today FROM account_pool WHERE id = $1",
            uuid.UUID(account_id),
        )
    if row and row["actions_today"] >= (row["daily_action_limit"] or 15):
        log.info(f"MAX account {account_id} reached daily limit")
        return {"status": "skipped", "reason": "daily_limit_reached"}

    await asyncio.sleep(random.uniform(1, 3))

    result = await send_message(token, chat_id=chat_id or None,
                                user_id=user_id or None, text=text)
    if result.get("error"):
        log.error(f"MAX publish error: {result}")
        return {"status": "error", "error": str(result.get("error"))[:200]}

    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE account_pool SET actions_today = actions_today + 1 WHERE id = $1",
            uuid.UUID(account_id),
        )

    from app.quota import record_post
    try:
        await record_post(tenant_id)
    except Exception as e:
        log.warning(f"MAX quota recording failed (non-blocking): {e}")

    try:
        await pool_execute(
            """INSERT INTO posting_logs (id, tenant_id, campaign_id, target_id,
               account_id, rendered_text, utm_url, status, message_id, executed_at)
               VALUES ($1, $2, $3, $4, $5, $6, '', 'published', $7, NOW())""",
            uuid.uuid4(),
            uuid.UUID(tenant_id),
            uuid.UUID(campaign_id) if campaign_id else None,
            uuid.UUID(target_id) if target_id else None,
            uuid.UUID(account_id),
            text[:2000],
            str((result.get("message") or {}).get("message_id", "")),
        )
    except Exception as e:
        log.warning(f"MAX posting_logs write failed (non-blocking): {e}")

    log.info(f"MAX post published: account={account_id}")
    return {"status": "ok"}
