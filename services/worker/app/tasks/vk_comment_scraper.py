"""VK Comment Scraper: scrape wall post comments → leads.

Queue: parser
Retry: 2 retries
Timeout: 120s

Flow:
1. Fetch comments on a VK wall post via API (with pagination)
2. Fetch thread replies on each comment
3. Batch-fetch all user info
4. Classify each comment via LLM/keyword pipeline
5. Save as leads with source='comment'
"""
import asyncio
import logging
import time

from celery import shared_task
from app.celery_app import celery

log = logging.getLogger(__name__)

# ponytail: Redis-backed dedup. Key: vk:scraped:{tenant_id}, type: set, TTL: 7 days.
_DEDUP_PREFIX = "vk:scraped:"


@celery.task(name="app.tasks.vk_comment_scraper.scrape_vk_comments", bind=True,
             queue="parser", max_retries=2, default_retry_delay=60)
def scrape_vk_comments(self, tenant_id: str, account_id: str,
                       group_id: int, post_id: str,
                       source_target_id: str = ""):
    """Scrape comments on a VK wall post → classify → save as leads."""
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


async def _is_already_scraped(tenant_id: str, cache_key: str) -> bool:
    """Check Redis set for dedup."""
    import redis.asyncio as aioredis
    from app.config import REDIS_URL
    r = aioredis.from_url(REDIS_URL, decode_responses=True)
    try:
        return await r.sismember(f"{_DEDUP_PREFIX}{tenant_id}", cache_key)
    finally:
        await r.aclose()


async def _mark_scraped(tenant_id: str, cache_key: str) -> None:
    """Add to Redis dedup set with 7-day TTL."""
    import redis.asyncio as aioredis
    from app.config import REDIS_URL
    r = aioredis.from_url(REDIS_URL, decode_responses=True)
    try:
        key = f"{_DEDUP_PREFIX}{tenant_id}"
        await r.sadd(key, cache_key)
        await r.expire(key, 604800)  # 7 days
    finally:
        await r.aclose()


async def _scrape_vk_and_classify(tenant_id: str, account_id: str,
                                   group_id: int, post_id: int,
                                   source_target_id: str) -> dict:
    from app.vk_client import (
        get_vk_group_session_for, _handle_vk_error, handle_flood_wait,
    )
    from app.lead_pipeline import process_incoming_message
    from app.tenant_settings import get_tenant_settings_from_db

    posting_cfg = (await get_tenant_settings_from_db(tenant_id)).get("posting", {})
    max_comments = posting_cfg.get("max_comment_replies_per_post", 100)

    vk_session = await get_vk_group_session_for(account_id)
    if vk_session is None:
        return {"status": "error", "error": "no_session", "leads_created": 0}

    vk = vk_session.get_api()

    try:
        owner_id = -group_id
        all_comments = []

        # Paginate comments (VK max 100 per request)
        offset = 0
        page_size = min(max_comments, 100)
        while offset < max_comments:
            batch_count = min(page_size, max_comments - offset)
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda o=offset, c=batch_count: vk.wall.getComments(
                    owner_id=owner_id,
                    post_id=post_id,
                    count=c,
                    offset=o,
                    sort="asc",
                    need_likes=1,
                ),
            )
            items = response.get("items", [])
            if not items:
                break
            all_comments.extend(items)
            offset += len(items)
            if len(items) < batch_count:
                break  # No more comments

        if not all_comments:
            return {"status": "ok", "comments_found": 0, "leads_created": 0}

        # Fetch thread replies for each comment
        all_with_replies = []
        for comment in all_comments:
            all_with_replies.append(comment)
            thread = comment.get("thread", {})
            thread_count = thread.get("count", 0)
            if thread_count > 0:
                # Fetch replies (max 100)
                try:
                    reply_response = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda cid=comment["id"]: vk.wall.getComments(
                            owner_id=owner_id,
                            post_id=post_id,
                            start_comment_id=cid,
                            count=min(thread_count, 100),
                            sort="asc",
                            need_likes=1,
                        ),
                    )
                    all_with_replies.extend(reply_response.get("items", []))
                except Exception as e:
                    log.debug(f"Failed to fetch thread replies for comment {comment['id']}: {e}")

        # Batch-fetch all user info
        user_ids = list({str(c.get("from_id", 0)) for c in all_with_replies if c.get("from_id", 0) > 0})
        user_map: dict[int, dict] = {}
        if user_ids:
            try:
                for i in range(0, len(user_ids), 100):
                    batch = user_ids[i:i+100]
                    users = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda b=batch: vk.users.get(
                            user_ids=",".join(b), fields="screen_name"
                        ),
                    )
                    for u in users:
                        user_map[u["id"]] = u
            except Exception:
                pass

        leads_created = 0
        for comment in all_with_replies:
            text = comment.get("text", "")
            if not text or len(text) < 3:
                continue

            user_id = comment.get("from_id", 0)
            if user_id <= 0:
                continue

            cache_key = f"vk_{group_id}:{post_id}:{comment['id']}"
            if await _is_already_scraped(tenant_id, cache_key):
                continue
            await _mark_scraped(tenant_id, cache_key)

            # User info from batch map
            if user_id in user_map:
                u = user_map[user_id]
                user_handle = f"@{u.get('screen_name', user_id)}"
                user_full = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
            else:
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
            "comments_found": len(all_with_replies),
            "leads_created": leads_created,
        }

    except Exception as e:
        vk_err = _handle_vk_error(str(e))
        if vk_err.code == 921:
            await handle_flood_wait(vk_err)
        log.error(f"VK comment scraping error: {e}")
        return {"status": "error", "error": str(e)[:200], "leads_created": 0}
