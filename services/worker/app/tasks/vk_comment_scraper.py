"""VK Comment Scraper: scrape wall post comments → leads.

Queue: parser
Retry: 2 retries
Timeout: 120s

Flow:
1. Fetch comments on a VK wall post via API
2. Classify each comment via LLM/keyword pipeline
3. Save as leads with source='comment'
"""
import asyncio
import logging
import time

from celery import shared_task
from app.celery_app import celery

log = logging.getLogger(__name__)

# ponytail: in-memory per worker with max size to prevent OOM
_scraped_cache: dict[str, set] = {}
_MAX_SCRAPED_VK = 10000


@celery.task(name="app.tasks.vk_comment_scraper.scrape_vk_comments", bind=True,
             queue="parser", max_retries=2, default_retry_delay=60)
def scrape_vk_comments(self, tenant_id: str, account_id: str,
                       group_id: int, post_id: str,
                       source_target_id: str = ""):
    """Scrape comments on a VK wall post → classify → save as leads.

    group_id: VK community ID
    post_id: VK wall post ID
    """
    log.info(f"scrape_vk_comments: tenant={tenant_id} group={group_id} post={post_id}")

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(
            _scrape_vk_and_classify(tenant_id, account_id, group_id,
                                    int(post_id), source_target_id)
        )
    except Exception as e:
        log.error(f"scrape_vk_comments failed: {e}")
        raise self.retry(exc=e)
    finally:
        loop.close()

    return result


async def _scrape_vk_and_classify(tenant_id: str, account_id: str,
                                   group_id: int, post_id: int,
                                   source_target_id: str) -> dict:
    """Fetch VK wall comments, classify each, save as leads."""
    from app.vk_client import get_vk_group_session
    from app.lead_pipeline import process_incoming_message
    from app.tenant_settings import get_tenant_settings_from_db

    import os
    group_token = os.getenv("VK_GROUP_TOKEN", "")
    if not group_token:
        return {"status": "error", "error": "no_vk_token", "leads_created": 0}

    posting_cfg = get_tenant_settings_from_db(
        os.getenv("DATABASE_URL", "postgresql://app_user:secure_password@postgres:5432/app_db"),
        tenant_id
    ).get("posting", {})
    max_comments = posting_cfg.get("max_comment_replies_per_post", 10)

    vk_session = await get_vk_group_session(account_id, group_token)
    if vk_session is None:
        return {"status": "error", "error": "no_session", "leads_created": 0}

    vk = vk_session.get_api()

    try:
        # Get comments
        owner_id = -group_id  # VK uses negative IDs for communities
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: vk.wall.getComments(
                owner_id=owner_id,
                post_id=post_id,
                count=max_comments,
                sort="asc",
                need_likes=1,
            ),
        )

        comments = response.get("items", [])
        if not comments:
            return {"status": "ok", "comments_found": 0, "leads_created": 0}

        leads_created = 0
        for comment in comments:
            text = comment.get("text", "")
            if not text or len(text) < 3:
                continue

            user_id = comment.get("from_id", 0)
            cache_key = f"vk_{group_id}:{post_id}:{comment['id']}"
            tenant_cache_vk = _scraped_cache.setdefault(tenant_id, set())
            if cache_key in tenant_cache_vk:
                continue
            if len(tenant_cache_vk) >= _MAX_SCRAPED_VK:
                tenant_cache_vk.clear()
            tenant_cache_vk.add(cache_key)

            # Get user info
            try:
                user_info = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda uid=user_id: vk.users.get(user_ids=uid, fields="screen_name")[0],
                )
                user_handle = f"@{user_info.get('screen_name', user_id)}"
                user_full = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
            except Exception:
                user_handle = f"vk_{user_id}"
                user_full = ""

            result = await process_incoming_message(
                tenant_id=tenant_id,
                platform="vkontakte",
                target_id=source_target_id,
                account_id=account_id,
                user_handle=user_handle,
                user_full_name=user_full,
                message_text=text,
                geo_tag="",
                source="comment",
                post_id=str(post_id),
            )

            intent = result.get("intent_score", "COLD")
            log.info(f"VK Comment classified: {user_handle} → {intent}")
            leads_created += 1

        return {
            "status": "ok",
            "comments_found": len(comments),
            "leads_created": leads_created,
        }
    except Exception as e:
        log.error(f"VK comment scraping error: {e}")
        return {"status": "error", "error": str(e)[:200], "leads_created": 0}
