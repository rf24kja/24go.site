"""VK Poster: publish posts to VK community walls.

Queue: poster
Retry: 3 retries
Timeout: 60s

Flow:
1. Check rate limit and warmup stage
2. Render spintax template
3. Random delay (anti-ban)
4. Post to VK community wall
5. Save to posting_logs
6. Trigger VK comment scraper
"""
import asyncio
import logging
import random
import re

from celery import shared_task
from app.celery_app import celery

log = logging.getLogger(__name__)


@celery.task(name="app.tasks.vk_poster.post_to_vk", queue="poster",
             bind=True, max_retries=3, default_retry_delay=60)
def post_to_vk(self, tenant_id: str, account_id: str,
               group_id: int, text: str, campaign_id: str = "",
               target_id: str = ""):
    """Post a message to a VK community wall."""
    log.info(f"post_to_vk: tenant={tenant_id} group={group_id}")

    from app.tenant_settings import get_tenant_settings_sync
    posting_cfg = get_tenant_settings_sync(tenant_id).get("posting", {})

    rendered = _render_spintax(text, posting_cfg.get("spintax_max_depth", 10))

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(
            _publish_vk_post(tenant_id, account_id, group_id, rendered,
                             campaign_id, target_id)
        )
    except Exception as e:
        log.error(f"post_to_vk failed: {e}")
        raise self.retry(exc=e)
    finally:
        loop.close()

    if result.get("error", "").startswith("vk_error_921"):
        raise self.retry(exc=Exception(result["error"]))

    return result


def _render_spintax(text: str, max_depth: int = 10) -> str:
    def _replace(match):
        return random.choice(match.group(1).split("|"))
    result = text
    for _ in range(max_depth):
        new_result = re.sub(r'\{([^}]+)\}', _replace, result)
        if new_result == result:
            break
        result = new_result
    return result


async def _publish_vk_post(tenant_id: str, account_id: str,
                           group_id: int, text: str,
                           campaign_id: str, target_id: str) -> dict:
    from app.vk_client import (
        get_vk_group_session_for, check_rate_limit, check_warmup,
        record_action, wait_for_rate_limit, handle_flood_wait, _handle_vk_error,
    )
    from app.config import DATABASE_URL
    from app.db_pool import execute as pool_execute
    import uuid

    # Warmup check
    if not await check_warmup(account_id, "wall_post"):
        return {"status": "skipped", "reason": "warmup_limit"}

    # Rate limit check
    if not await check_rate_limit(account_id, "wall_post"):
        return {"status": "error", "error": "rate_limited"}

    # ponytail: short jitter only — rate limiter handles cooldown via Redis
    await asyncio.sleep(random.uniform(1, 3))

    vk_session = await get_vk_group_session_for(account_id)
    if vk_session is None:
        return {"status": "error", "error": "no_session"}

    vk = vk_session.get_api()

    try:
        owner_id = -group_id
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: vk.wall.post(owner_id=owner_id, message=text, from_group=1,
                                 random_id=random.randint(0, 2**31)),
        )

        await record_action(account_id, "wall_post")

        post_id = response.get("post_id", 0)
        log.info(f"VK post published: group={group_id} post={post_id}")

        # Save to posting_logs
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
            str(post_id),
        )

        # Trigger comment scraper after 2min
        try:
            from app.tasks.vk_comment_scraper import scrape_vk_comments
            scrape_vk_comments.apply_async(
                args=[tenant_id, account_id, group_id, str(post_id), target_id],
                countdown=120,
            )
        except Exception as e:
            log.debug(f"VK comment scraper scheduling failed: {e}")

        return {"status": "ok", "post_id": post_id, "group_id": group_id}

    except Exception as e:
        vk_err = _handle_vk_error(str(e))
        if vk_err.code == 921:
            await handle_flood_wait(vk_err)
        if vk_err.code in (900, 901, 300):
            log.error(f"VK fatal error {vk_err.code}: {vk_err.message}")
            return {"status": "error", "error": f"vk_error_{vk_err.code}"}
        log.error(f"VK publish error: {e}")
        return {"status": "error", "error": str(e)[:200]}
