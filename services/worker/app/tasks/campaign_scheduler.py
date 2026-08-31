"""Campaign scheduling: timezone-aware periodic posting.

Queue: poster
Schedule: Beat every 5 min. Each campaign has its own cron + timezone.
Logic: For each campaign whose cron fires now (in its TZ), post once.
"""
import asyncio
import logging
import random
import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import asyncpg
from croniter import croniter

from app.celery_app import celery
from app.config import DATABASE_URL

log = logging.getLogger(__name__)

DB_URL = DATABASE_URL.replace("+asyncpg", "") if "+asyncpg" in DATABASE_URL else DATABASE_URL


@celery.task(name="app.tasks.poster.periodic_campaign_post", queue="poster", max_retries=3)
def periodic_campaign_post():
    """Beat-triggered every 5 min: for each active campaign, check if its cron
    fires in the current 5-min window (in the campaign's timezone).

    If yes and posts_per_day limit not reached → dispatch one post.
    """
    return asyncio.run(_run())


async def _run():
    conn = await asyncpg.connect(DB_URL)
    try:
        # Fetch all active campaigns with scheduling fields
        campaigns = await conn.fetch(
            "SELECT id, tenant_id, base_text, target_geos, target_niches, "
            "schedule_cron, posts_per_day, timezone, last_posted_at, "
            "ab_enabled, ab_variants "
            "FROM campaigns WHERE is_active = true"
        )
        if not campaigns:
            return {"status": "no_active_campaigns"}

        now_utc = datetime.now(timezone.utc)
        dispatched = []

        for c in campaigns:
            tz_name = c["timezone"] or "UTC"
            try:
                tz = ZoneInfo(tz_name)
            except Exception:
                tz = ZoneInfo("UTC")

            local_now = now_utc.astimezone(tz)

            # ── Idempotency lock: prevent double-dispatch within 5 min window ──
            lock_key = f"campaign_dispatch:{c['id']}:{local_now.strftime('%Y%m%d%H')}"
            try:
                import os, redis as _redis
                r = _redis.Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"))
                if r.exists(lock_key):
                    continue  # Already dispatched this campaign in this window
                r.set(lock_key, "1", ex=300)  # 5 min TTL
            except Exception:
                pass  # If Redis unavailable, proceed (risk double-dispatch, better than blocking)

            # ── Cron check ─────────────────────────────────────────────
            cron_expr = c["schedule_cron"]
            if cron_expr:
                # Campaigns without a cron are manual-only → skip
                cron = croniter(cron_expr, local_now.replace(second=0, microsecond=0))
                prev = cron.get_prev(datetime)
                # Fire if the previous cron tick is within the last 5 minutes
                delta = (local_now - prev).total_seconds()
                if delta > 300:
                    continue

            # ── Daily limit check ──────────────────────────────────────
            posts_today = await conn.fetchval(
                """SELECT count(*) FROM posting_logs
                   WHERE campaign_id = $1 AND executed_at >= (NOW() AT TIME ZONE $2)::date""",
                c["id"], tz_name,
            )
            limit = c["posts_per_day"] or 1
            if posts_today >= limit:
                log.debug(f"Campaign {c['id']} hit daily limit ({posts_today}/{limit})")
                continue

            # ── Pick a matching target ─────────────────────────────────
            target_geos = c["target_geos"] or []
            if isinstance(target_geos, str):
                import json as _json
                target_geos = _json.loads(target_geos)
            target = await conn.fetchrow(
                "SELECT id, target_id_code, title FROM targets "
                "WHERE tenant_id = $1 AND is_active = true "
                "AND (geo_tag = ANY($2) OR $2 = '{}') "
                "ORDER BY random() LIMIT 1",
                c["tenant_id"],
                target_geos,
            )
            if not target:
                continue

            # ── Pick an available account ──────────────────────────────
            account = await conn.fetchrow(
                "SELECT id, account_identifier FROM account_pool "
                "WHERE tenant_id = $1 AND status = 'active' "
                "AND actions_today < daily_action_limit "
                "ORDER BY random() LIMIT 1",
                c["tenant_id"],
            )
            if not account:
                continue

            # ── Dispatch ───────────────────────────────────────────────
            from app.tenant_settings import get_tenant_settings_from_db
            posting_cfg = (await get_tenant_settings_from_db(str(c["tenant_id"]))).get("posting", {})
            utm_source = posting_cfg.get("utm_source", "leadgen")
            utm_medium = posting_cfg.get("utm_medium", "post")
            utm_url = (
                f"https://t.me/{target['target_id_code']}"
                f"?utm_source={utm_source}&utm_medium={utm_medium}"
                f"&utm_campaign={c['id']}"
            )

            celery.send_task(
                "app.tasks.poster.publish_post",
                args=[
                    str(c["tenant_id"]),
                    str(c["id"]),
                    str(target["id"]),
                    str(account["id"]),
                    c["base_text"],  # raw spintax template — poster renders
                    utm_url,
                    f"@{target['target_id_code']}",  # target_channel for Telethon
                ],
                kwargs={
                    "ab_enabled": c.get("ab_enabled", False),
                    "ab_variants": c.get("ab_variants") or [],
                },
                queue="poster",
            )

            # Update last_posted_at
            await conn.execute(
                "UPDATE campaigns SET last_posted_at = NOW() WHERE id = $1",
                c["id"],
            )

            dispatched.append(str(c["id"]))
            log.info(
                f"Dispatched: campaign={c['id']} target={target['title']} "
                f"account={account['account_identifier']} tz={tz_name}"
            )

        return {"status": "ok", "dispatched": dispatched}
    finally:
        await conn.close()
