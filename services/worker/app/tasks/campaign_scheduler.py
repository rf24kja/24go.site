"""Campaign scheduling: periodic posting from active campaigns.

Queue: poster
Schedule: Triggered by Celery Beat every 30 minutes.
Logic: For each active campaign, pick an account, render spintax, dispatch post.
"""
import json
import logging
import random
import uuid

import asyncpg

from app.celery_app import celery
from app.config import DATABASE_URL

log = logging.getLogger(__name__)

DB_URL = DATABASE_URL.replace("+asyncpg", "") if "+asyncpg" in DATABASE_URL else DATABASE_URL


@celery.task(name="app.tasks.poster.periodic_campaign_post", queue="poster", max_retries=3)
def periodic_campaign_post():
    """Beat-triggered: post from active campaigns to discovered targets.

    Runs every 30 minutes. Picks one random active campaign, one random target,
    one random available account, renders spintax, and dispatches the post.
    """
    import asyncio

    async def _run():
        conn = await asyncpg.connect(DB_URL)
        try:
            # Find an active campaign
            campaign = await conn.fetchrow(
                "SELECT id, tenant_id, base_text, target_geos, target_niches "
                "FROM campaigns WHERE is_active = true ORDER BY random() LIMIT 1"
            )
            if not campaign:
                return {"status": "no_active_campaigns"}

            # Find a matching target
            target = await conn.fetchrow(
                "SELECT id, target_id_code, title, geo_tag, niche "
                "FROM targets WHERE tenant_id = $1 AND is_active = true "
                "AND (geo_tag = ANY($2) OR $2 = '{}') "
                "ORDER BY random() LIMIT 1",
                campaign["tenant_id"],
                campaign["target_geos"] or [],
            )
            if not target:
                return {"status": "no_matching_targets"}

            # Find an available account
            account = await conn.fetchrow(
                "SELECT id, account_identifier FROM account_pool "
                "WHERE tenant_id = $1 AND status = 'active' AND actions_today < daily_action_limit "
                "ORDER BY random() LIMIT 1",
                campaign["tenant_id"],
            )
            if not account:
                return {"status": "no_available_accounts"}

            # Render spintax
            rendered = _render_spintax(campaign["base_text"])
            utm_url = f"https://t.me/{target['target_id_code']}?utm_source=leadgen&utm_medium=post&utm_campaign={campaign['id']}"

            # Dispatch to poster worker
            celery.send_task(
                "app.tasks.poster.publish_post",
                args=[
                    str(campaign["tenant_id"]),
                    str(campaign["id"]),
                    str(target["id"]),
                    str(account["id"]),
                    rendered,
                    utm_url,
                ],
                queue="poster",
            )

            log.info(f"Campaign post dispatched: campaign={campaign['id']} target={target['title']} account={account['account_identifier']}")
            return {"status": "dispatched", "campaign_id": str(campaign["id"])}
        finally:
            await conn.close()

    return asyncio.run(_run())


def _render_spintax(text: str) -> str:
    """Render spintax: {option1|option2|option3} → random choice."""
    import re
    def replace_group(match):
        options = match.group(1).split("|")
        return random.choice(options)
    result = text
    for _ in range(10):  # nested spintax support
        new_result = re.sub(r"\{([^{}]*)\}", replace_group, result)
        if new_result == result:
            break
        result = new_result
    return result
