"""Poster tasks: spintax rendering, stealth posting via Telethon, UTM tracking.

Queue: poster_tasks
Concurrency: Prefetch=1 per worker thread
Retry: Max 2 retries (skip on ban)
Timeout: 120s

Uses telegram_client.py factory for session management.
"""
import asyncio
import logging
import random
import re

from celery import shared_task

from app.celery_app import celery
from app.locks import acquire_account_lock, increment_daily_actions
from app.config import WARMUP_LIMITS
from app.telegram_client import disconnect_client

log = logging.getLogger(__name__)


def render_spintax(text_template: str) -> str:
    """Render spintax template: {option1|option2|option3} → random pick."""
    pattern = r"\{([^{}]*)\}"

    def _replace(match):
        options = match.group(1).split("|")
        return random.choice(options)

    result = text_template
    for _ in range(10):  # max depth to avoid infinite loops
        new_result = re.sub(pattern, _replace, result)
        if new_result == result:
            break
        result = new_result
    return result


def build_utm_url(base_url: str, campaign_id: str, target_id: str, account_id: str,
                   posting_cfg: dict | None = None) -> str:
    """Append UTM parameters for click tracking. Uses tenant settings if provided."""
    from urllib.parse import quote
    cfg = posting_cfg or {}
    source = quote(str(cfg.get("utm_source", "leadgen"))[:64], safe="")
    medium = quote(str(cfg.get("utm_medium", "post"))[:64], safe="")
    campaign = quote(str(cfg.get("utm_campaign", campaign_id))[:64], safe="")
    separator = "&" if "?" in base_url else "?"
    return f"{separator}utm_source={source}&utm_medium={medium}&utm_campaign={campaign}&utm_content={target_id}_{account_id}"


@celery.task(name="app.tasks.poster.publish_post", bind=True, queue="poster", max_retries=2)
def publish_post(self, tenant_id: str, campaign_id: str, target_id: str, account_id: str,
                 base_text: str, base_url: str, target_channel: str = ""):
    """Post spintax-rendered content to a Telegram target via Telethon.

    Acquires per-account lock before execution.
    Checks daily action limits.
    Saves message_id for comment scraper.

    target_channel: Telegram channel/group username or ID (e.g. "@phuket_rentals")
    """
    with acquire_account_lock(tenant_id, account_id) as locked:
        if not locked:
            log.warning(f"Account {account_id} locked by another worker, retrying")
            raise self.retry(countdown=30, exc=Exception("Account lock active"))

        from app.tenant_settings import get_tenant_settings_sync
        posting_cfg = get_tenant_settings_sync(tenant_id).get("posting", {})
        limit = posting_cfg.get("stage3_daily_limit", WARMUP_LIMITS.get(3, 20))

        # Atomic daily limit via Lua script (no race between INCR/check/DECR)
        from app.locks import _get_redis
        daily_key = f"daily_actions:{tenant_id}:{account_id}:{__import__('time').strftime('%Y-%m-%d')}"
        r = _get_redis()
        LUA_CHECK_AND_INCR = """
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local current = tonumber(redis.call('GET', key) or '0')
if current >= limit then
    return 0
end
redis.call('INCR', key)
if current == 0 then
    redis.call('EXPIRE', key, 86400)
end
return 1
"""
        allowed = r.eval(LUA_CHECK_AND_INCR, 1, daily_key, limit)
        if not allowed:
            log.info(f"Account {account_id} reached daily limit ({limit})")
            return {"status": "skipped", "reason": "daily_limit_reached"}

        # Render content
        rendered_text = render_spintax(base_text)
        utm_url = build_utm_url(base_url, campaign_id, target_id, account_id, posting_cfg)
        full_text = f"{rendered_text}\n\n{utm_url}"

        log.info(f"publish_post: tenant={tenant_id} target={target_id} "
                 f"account={account_id} channel={target_channel}")

        # Send via Telethon
        loop = asyncio.new_event_loop()
        try:
            result = loop.run_until_complete(
                _send_message(account_id, target_channel, full_text)
            )
        finally:
            loop.run_until_complete(disconnect_client(account_id))
            loop.close()

        if result.get("status") == "ok":
            # Save to posting_logs with message_id for comment scraper
            _save_posting_log(tenant_id, campaign_id, target_id, account_id,
                              full_text, utm_url, result.get("message_id"))

            # Schedule comment scraping (2min, 10min, 24h)
            if target_channel and result.get("message_id"):
                from app.tasks.comment_scraper import auto_scrape_after_post
                auto_scrape_after_post.delay(
                    tenant_id, account_id, target_channel,
                    result["message_id"], target_id,
                )
                log.info(f"Scheduled comment scraping for post {result['message_id']}")

            return {
                "status": "published",
                "message_id": result.get("message_id"),
                "rendered_text": rendered_text[:100],
                "utm_url": utm_url,
            }
        elif result.get("status") == "flood_wait":
            # Telegram is rate-limiting — schedule retry after wait
            wait_seconds = result.get("wait_seconds", 300)
            log.warning(f"FloodWaitError for {account_id}, waiting {wait_seconds}s")
            raise self.retry(countdown=wait_seconds, exc=Exception(f"Flood wait {wait_seconds}s"))
        elif result.get("status") == "banned":
            log.error(f"Account {account_id} banned from channel {target_channel}")
            return {"status": "error", "error": "account_banned"}
        else:
            log.error(f"Post failed: {result}")
            raise self.retry(exc=Exception(result.get("error", "unknown")))


async def _send_message(account_id: str, target_channel: str, text: str) -> dict:
    """Send message via Telethon client from factory."""
    from app.telegram_client import get_client, _set_status

    client = await get_client(account_id)
    if client is None:
        return {"status": "error", "error": "no_session"}

    try:
        entity = await client.get_entity(target_channel)
        message = await client.send_message(entity, text)
        _set_status(account_id, "online")
        return {
            "status": "ok",
            "message_id": str(message.id),
        }
    except Exception as e:
        error_name = type(e).__name__
        if "FloodWaitError" in error_name or "flood" in str(e).lower():
            # Extract wait time from error
            wait = getattr(e, "seconds", 300)
            return {"status": "flood_wait", "wait_seconds": wait}
        elif "UserBannedInChannelError" in error_name or "banned" in str(e).lower():
            return {"status": "banned"}
        else:
            log.error(f"Telethon send error: {e}")
            return {"status": "error", "error": str(e)[:200]}


def _save_posting_log(tenant_id, campaign_id, target_id, account_id,
                      rendered_text, utm_url, message_id):
    """Save posting record to DB for comment scraper tracking."""
    import uuid
    import asyncpg
    import os

    db_url = os.getenv("DATABASE_URL", "postgresql://app_user:secure_password@postgres:5432/app_db")
    db_url = db_url.replace("+asyncpg", "")

    async def _insert():
        conn = await asyncpg.connect(db_url)
        try:
            await conn.execute(
                """INSERT INTO posting_logs
                   (id, tenant_id, campaign_id, target_id, account_id,
                    rendered_text, utm_url, status, message_id, executed_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', $8, NOW())""",
                uuid.uuid4(),
                uuid.UUID(tenant_id),
                uuid.UUID(campaign_id) if campaign_id else None,
                uuid.UUID(target_id) if target_id else None,
                uuid.UUID(account_id) if account_id else None,
                rendered_text[:2000],
                utm_url,
                message_id,
            )
        finally:
            await conn.close()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_insert())
    finally:
        loop.close()
