"""VK Poster: publish posts to VK community walls.

Queue: poster
Retry: 3 retries
Timeout: 60s

Flow:
1. Render spintax template
2. Post to VK community wall
3. Save to posting_logs
4. Trigger VK comment scraper
"""
import asyncio
import logging
import re
import time
import random

from celery import shared_task
from app.celery_app import celery

log = logging.getLogger(__name__)


@celery.task(name="app.tasks.vk_poster.post_to_vk", queue="poster",
             bind=True, max_retries=3, default_retry_delay=60)
def post_to_vk(self, tenant_id: str, account_id: str,
               group_id: int, text: str, campaign_id: str = "",
               target_id: str = ""):
    """Post a message to a VK community wall.

    text: spintax-enabled text, e.g. "Hello {World|Earth|Universe}"
    group_id: VK community ID
    """
    log.info(f"post_to_vk: tenant={tenant_id} group={group_id}")

    # Load tenant settings
    from app.tenant_settings import get_tenant_settings_sync
    posting_cfg = get_tenant_settings_sync(tenant_id).get("posting", {})

    # Render spintax
    rendered = _render_spintax(text, posting_cfg.get("spintax_max_depth", 10))
    log.info(f"Rendered: {rendered[:100]}...")

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

    return result


def _render_spintax(text: str, max_depth: int = 10) -> str:
    """Render spintax: {option1|option2|option3} → random choice.

    Args:
        max_depth: Maximum nesting depth to prevent infinite loops.
    """
    import re
    def _replace(match):
        options = match.group(1).split("|")
        return random.choice(options)
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
    """Publish to VK wall and save to posting_logs."""
    from app.vk_client import get_vk_group_session
    import asyncpg, uuid, os

    group_token = os.getenv("VK_GROUP_TOKEN", "")
    if not group_token:
        return {"status": "error", "error": "no_vk_token"}

    vk_session = await get_vk_group_session(account_id, group_token)
    if vk_session is None:
        return {"status": "error", "error": "no_session"}

    vk = vk_session.get_api()

    try:
        # Post to wall
        owner_id = -group_id
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: vk.wall.post(owner_id=owner_id, message=text, from_group=1),
        )

        post_id = response.get("post_id", 0)
        log.info(f"VK post published: group={group_id} post={post_id}")

        # Save to posting_logs
        db_url = os.getenv("DATABASE_URL", "").replace("+asyncpg", "")
        if db_url:
            conn = await asyncpg.connect(db_url)
            try:
                await conn.execute(
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
            finally:
                await conn.close()

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
        log.error(f"VK publish error: {e}")
        return {"status": "error", "error": str(e)[:200]}
