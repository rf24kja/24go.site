"""Poster tasks: spintax rendering, stealth posting, UTM tracking.

Queue: poster_tasks
Concurrency: Prefetch=1 per worker thread
Retry: Max 2 retries (skip on ban)
Timeout: 120s
"""
import logging
import random
import re

from celery import shared_task

from app.celery_app import celery
from app.locks import acquire_account_lock, get_daily_action_count, increment_daily_actions
from app.config import WARMUP_LIMITS

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


def build_utm_url(base_url: str, campaign_id: str, target_id: str, account_id: str) -> str:
    """Append UTM parameters for click tracking."""
    separator = "&" if "?" in base_url else "?"
    return f"{separator}utm_source=leadgen&utm_medium=post&utm_campaign={campaign_id}&utm_content={target_id}_{account_id}"


@celery.task(name="app.tasks.poster.publish_post", bind=True, queue="poster", max_retries=2)
def publish_post(self, tenant_id: str, campaign_id: str, target_id: str, account_id: str, base_text: str, base_url: str):
    """Stealth-post spintax-rendered content to a target.

    Acquires per-account lock before execution.
    Checks daily action limits.
    """
    with acquire_account_lock(tenant_id, account_id) as locked:
        if not locked:
            log.warning(f"Account {account_id} locked by another worker, retrying")
            raise self.retry(countdown=30, exc=Exception("Account lock active"))

        # Check daily limits
        current_actions = get_daily_action_count(tenant_id, account_id)
        limit = WARMUP_LIMITS.get(3, 20)  # default to stage 3 limit
        if current_actions >= limit:
            log.info(f"Account {account_id} reached daily limit ({current_actions}/{limit})")
            return {"status": "skipped", "reason": "daily_limit_reached"}

        # Render content
        rendered_text = render_spintax(base_text)
        utm_url = build_utm_url(base_url, campaign_id, target_id, account_id)

        log.info(f"publish_post: tenant={tenant_id} target={target_id} account={account_id}")

        # TODO: Actual Telethon/VK posting in TASK_POSTER.md stage
        increment_daily_actions(tenant_id, account_id)

        return {
            "status": "published",
            "rendered_text": rendered_text[:100],
            "utm_url": utm_url,
        }
