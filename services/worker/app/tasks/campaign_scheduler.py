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

from croniter import croniter

from app.celery_app import celery
from app.db_pool import fetch, fetchrow, fetchval, execute, get_redis

log = logging.getLogger(__name__)


@celery.task(name="app.tasks.poster.periodic_campaign_post", queue="poster", max_retries=3)
def periodic_campaign_post():
    """Beat-triggered every 5 min: for each active campaign, check if its cron
    fires in the current 5-min window (in the campaign's timezone).

    If yes and posts_per_day limit not reached → dispatch one post.
    """
    return asyncio.run(_run())


async def _run():
    # ponytail: one-shot helpers (open-use-close per query) — no shared pool
    # across per-task event loops, structurally leak-proof.
    campaigns = await fetch(
        "SELECT id, tenant_id, base_text, platform, target_geos, target_niches, "
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
            r = await get_redis()
            if await r.exists(lock_key):
                continue
            await r.set(lock_key, "1", ex=300)
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
        posts_today = await fetchval(
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
        target = await fetchrow(
            "SELECT id, target_id_code, title, platform FROM targets "
            "WHERE tenant_id = $1 AND is_active = true "
            "AND platform = $3 "
            "AND (geo_tag = ANY($2) OR $2 = '{}') "
            "ORDER BY random() LIMIT 1",
            c["tenant_id"],
            target_geos,
            # ponytail: campaigns are per-service — a VK campaign posts
            # to VK targets (used to pick any platform, building bogus URLs)
            c.get("platform") or "telegram",
        )
        if not target:
            continue

        platform = target.get("platform", "telegram")

        # ponytail: explicit skip — MAX campaigns need a recipient mapping
        # that doesn't exist yet; TG poster would build a bogus t.me URL.
        if platform == "max":
            log.debug(f"Campaign {c['id']}: skipping MAX target (unsupported)")
            continue

        # ponytail: same as MAX — no WA poster exists; the TG poster would
        # send to a t.me URL built from a WA group code. Skip, don't misfire.
        if platform == "whatsapp":
            log.debug(f"Campaign {c['id']}: skipping WhatsApp target (unsupported)")
            continue

        # ── Pick an available account (matching platform) ────────
        account = await fetchrow(
            "SELECT id, account_identifier FROM account_pool "
            "WHERE tenant_id = $1 AND status = 'active' AND platform = $2 "
            "AND actions_today < daily_action_limit "
            "ORDER BY random() LIMIT 1",
            c["tenant_id"],
            platform,
        )
        if not account:
            continue

            # ── Dispatch ───────────────────────────────────────────────
        from app.tenant_settings import get_tenant_settings_from_db
        # ponytail: UTM/limits follow the campaign's service (targets are
        # already constrained to it above)
        posting_cfg = (await get_tenant_settings_from_db(
            str(c["tenant_id"]), service=platform)).get("posting", {})
        utm_source = posting_cfg.get("utm_source", "leadgen")
        utm_medium = posting_cfg.get("utm_medium", "post")

        if platform == "vkontakte":
            utm_url = (
                f"https://vk.com/public{target['target_id_code']}"
                f"?utm_source={utm_source}&utm_medium={utm_medium}"
                f"&utm_campaign={c['id']}"
            )
            celery.send_task(
                "app.tasks.vk_poster.post_to_vk",
                args=[
                    str(c["tenant_id"]),
                    str(account["id"]),
                    int(target["target_id_code"].replace("vk_", "")),
                    c["base_text"],
                    str(c["id"]),
                    str(target["id"]),
                ],
                kwargs={
                    "ab_enabled": c.get("ab_enabled", False),
                    "ab_variants": c.get("ab_variants") or [],
                },
                queue="poster",
            )
        else:
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
                    c["base_text"],
                    utm_url,
                    f"@{target['target_id_code']}",
                ],
                kwargs={
                    "ab_enabled": c.get("ab_enabled", False),
                    "ab_variants": c.get("ab_variants") or [],
                },
                queue="poster",
            )

        # Update last_posted_at
        await execute(
            "UPDATE campaigns SET last_posted_at = NOW() WHERE id = $1",
            c["id"],
        )

        dispatched.append(str(c["id"]))
        log.info(
            f"Dispatched: campaign={c['id']} target={target['title']} "
            f"account={account['account_identifier']} tz={tz_name}"
        )

    return {"status": "ok", "dispatched": dispatched}
