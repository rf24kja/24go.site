"""Comment Scraper: intercept comments on published posts → leads.

Queue: parser_tasks (same as parser — lightweight, periodic)
Retry: 2 retries
Timeout: 120s

Flow:
1. Fetch comments on a specific post via Telethon
2. Classify each comment via LLM/keyword pipeline
3. Save as leads with source='comment'
"""
import asyncio
import logging


from app.celery_app import celery

log = logging.getLogger(__name__)

# Track already-scraped comments to avoid re-processing
# ponytail: in-memory per worker with max size to prevent OOM
_scraped_cache: dict[str, set] = {}  # key: "{post_id}:{comment_id}"
_MAX_SCRAPED = 10000


@celery.task(name="app.tasks.comment_scraper.scrape_comments", bind=True,
             queue="parser", max_retries=2, default_retry_delay=60)
def scrape_comments(self, tenant_id: str, account_id: str,
                    target_channel: str, post_id: str,
                    source_target_id: str = ""):
    """Scrape comments on a published Telegram post → classify → save as leads.

    target_channel: Telegram channel/group username (e.g. "@phuket_rentals")
    post_id: Message ID of the published post (from poster output)
    """
    log.info(f"scrape_comments: tenant={tenant_id} channel={target_channel} "
             f"post={post_id} account={account_id}")

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(
            _scrape_and_classify(tenant_id, account_id, target_channel,
                                 int(post_id), source_target_id)
        )
    except Exception as e:
        log.error(f"scrape_comments failed: {e}")
        raise self.retry(exc=e)
    finally:
        loop.close()

    log.info(f"scrape_comments done: {result}")
    return result


async def _scrape_and_classify(tenant_id: str, account_id: str,
                                target_channel: str, post_id: int,
                                source_target_id: str) -> dict:
    """Fetch comments, classify each, save as leads."""
    from app.telegram_client import get_client
    from app.lead_pipeline import process_incoming_message
    from app.tenant_settings import get_tenant_settings_from_db

    posting_cfg = (await get_tenant_settings_from_db(tenant_id, service="telegram")).get("posting", {})
    max_comments = posting_cfg.get("max_comment_replies_per_post", 10)

    client = await get_client(account_id)
    if client is None:
        return {"status": "error", "error": "no_session", "leads_created": 0}

    try:
        # Get comments (replies to the post)
        entity = await client.get_entity(target_channel)
        comments = await client.get_messages(
            entity, limit=max_comments, reply_to=post_id
        )

        if not comments:
            return {"status": "ok", "comments_found": 0, "leads_created": 0}

        leads_created = 0
        for comment in comments:
            if not comment.text or len(comment.text) < 3:
                continue

            # Skip our own account's messages
            if comment.sender_id and str(comment.sender_id) == account_id:
                continue

            # Dedup check with max size
            cache_key = f"{post_id}:{comment.id}"
            tenant_cache = _scraped_cache.setdefault(tenant_id, set())
            if cache_key in tenant_cache:
                continue
            if len(tenant_cache) >= _MAX_SCRAPED:
                tenant_cache.clear()
            tenant_cache.add(cache_key)

            sender = await comment.get_sender()
            user_handle = (getattr(sender, 'username', None)
                          or getattr(sender, 'first_name', None)
                          or "unknown")
            user_full_name = " ".join(filter(None, [
                getattr(sender, 'first_name', ''),
                getattr(sender, 'last_name', ''),
            ]))

            result = await process_incoming_message(
                tenant_id=tenant_id,
                platform="telegram",
                target_id=source_target_id,
                account_id=account_id,
                user_handle=f"@{user_handle}",
                user_full_name=user_full_name,
                message_text=comment.text,
                geo_tag="",
                source="comment",
                post_id=post_id,
            )

            intent = result.get("intent_score", "COLD")
            log.info(f"Comment classified: @{user_handle} → {intent}")
            leads_created += 1

        return {
            "status": "ok",
            "comments_found": len(comments),
            "leads_created": leads_created,
        }
    except Exception as e:
        log.error(f"Comment scraping error: {e}")
        return {"status": "error", "error": str(e)[:200], "leads_created": 0}


@celery.task(name="app.tasks.comment_scraper.auto_scrape_after_post", bind=True,
             queue="parser", max_retries=1)
def auto_scrape_after_post(self, tenant_id: str, account_id: str,
                           target_channel: str, post_id: str,
                           source_target_id: str = ""):
    """Schedule 3 comment scrapes: configurable delay, 10min, 24h after posting.

    Called by poster after successful publish.
    First scrape uses comment_scrape_delay_sec from tenant settings.
    """
    from app.tenant_settings import get_tenant_settings_sync

    posting_cfg = get_tenant_settings_sync(tenant_id, service="telegram").get("posting", {})
    scrape_delay = posting_cfg.get("comment_scrape_delay_sec", 120)

    log.info(f"auto_scrape_after_post: scheduling 3 scrapes for post {post_id} (first in {scrape_delay}s)")

    # Scrape 1: configurable delay (default 2min)
    scrape_comments.apply_async(
        args=[tenant_id, account_id, target_channel, post_id, source_target_id],
        countdown=scrape_delay,
    )

    # Scrape 2: 10 minutes
    scrape_comments.apply_async(
        args=[tenant_id, account_id, target_channel, post_id, source_target_id],
        countdown=600,
    )

    # Scrape 3: 24 hours
    scrape_comments.apply_async(
        args=[tenant_id, account_id, target_channel, post_id, source_target_id],
        countdown=86400,
    )

    return {"status": "scheduled", "post_id": post_id, "scrapes": 3, "first_delay_sec": scrape_delay}
