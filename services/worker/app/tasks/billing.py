"""Billing tasks: quota enforcement, token metering, daily resets.

Queue: billing
Concurrency: Solo Sync Worker
Retry: Strictly 5 retries
Timeout: 30s
"""
import json
import logging
import uuid
from datetime import datetime

import asyncpg
from celery import shared_task

from app.celery_app import celery
from app.config import DATABASE_URL, REDIS_URL

log = logging.getLogger(__name__)

DB_URL_SYNC = DATABASE_URL.replace("+asyncpg", "") if "+asyncpg" in DATABASE_URL else DATABASE_URL


def _get_redis():
    import redis
    return redis.from_url(REDIS_URL, decode_responses=True)


@celery.task(name="app.tasks.billing.reset_daily_limits", queue="billing", max_retries=5)
def reset_daily_limits():
    """Midnight UTC: reset daily action counters + monthly post counters on period rollover.

    Runs via Celery Beat.
    """
    log.info("reset_daily_limits: triggered by Beat scheduler")

    import asyncio

    async def _run():
        conn = await asyncpg.connect(DB_URL_SYNC)
        try:
            # Reset daily action counters for all accounts
            result = await conn.execute(
                "UPDATE account_pool SET actions_today = 0 WHERE actions_today > 0"
            )
            log.info(f"Reset daily actions for accounts: {result}")

            # Check if any subscription periods have rolled over
            result = await conn.execute(
                """UPDATE subscriptions SET
                    monthly_posts_used = 0,
                    current_period_start = NOW(),
                    current_period_end = NOW() + INTERVAL '1 month'
                   WHERE current_period_end <= NOW() AND status = 'active'"""
            )
            log.info(f"Rolled over subscription periods: {result}")

            # Invalidate all Redis quota caches (use SCAN instead of KEYS)
            r = _get_redis()
            cursor = 0
            deleted = 0
            while True:
                cursor, keys = r.scan(cursor, match="quota:*", count=100)
                if keys:
                    r.delete(*keys)
                    deleted += len(keys)
                if cursor == 0:
                    break
            if deleted:
                log.info(f"Invalidated {deleted} quota caches")
        finally:
            await conn.close()

    asyncio.run(_run())
    return {"status": "limits_reset"}


@celery.task(name="app.tasks.billing.check_quota", queue="billing", max_retries=3)
def check_quota_task(tenant_id: str, action_type: str, estimated_cost: int = 1):
    """Verify tenant has sufficient quota before executing an action.

    Returns True if quota OK, raises Exception if exceeded.
    """
    log.info(f"check_quota: tenant={tenant_id} action={action_type} cost={estimated_cost}")

    import asyncio

    async def _check():
        conn = await asyncpg.connect(DB_URL_SYNC)
        try:
            row = await conn.fetchrow(
                """SELECT token_credits_balance, monthly_posts_used, monthly_posts_limit, status
                   FROM subscriptions WHERE tenant_id = $1""",
                uuid.UUID(tenant_id),
            )
            if not row:
                raise ValueError(f"No subscription for tenant {tenant_id}")
            if row["status"] != "active":
                raise ValueError(f"Subscription is {row['status']}")

            if action_type == "post" and row["monthly_posts_used"] >= row["monthly_posts_limit"]:
                raise ValueError(f"Monthly post limit exceeded: {row['monthly_posts_used']}/{row['monthly_posts_limit']}")

            if estimated_cost > 0 and row["token_credits_balance"] < estimated_cost:
                raise ValueError(f"Insufficient token credits: {row['token_credits_balance']} < {estimated_cost}")

            return {"quota_ok": True, "tenant_id": tenant_id}
        finally:
            await conn.close()

    return asyncio.run(_check())


@celery.task(name="app.tasks.billing.deduct_tokens", queue="billing", max_retries=5)
def deduct_tokens(tenant_id: str, service_type: str, quantity: int, cost_usd: float):
    """Deduct token credits and log usage after LLM API call.

    Records to usage_logs and updates subscriptions.token_credits_balance.
    """
    log.info(f"deduct_tokens: tenant={tenant_id} service={service_type} qty={quantity} cost=${cost_usd:.6f}")

    import asyncio

    async def _deduct():
        conn = await asyncpg.connect(DB_URL_SYNC)
        try:
            tenant_uuid = uuid.UUID(tenant_id)

            # Insert usage log
            await conn.execute(
                """INSERT INTO usage_logs (id, tenant_id, service_type, quantity_used, estimated_cost_usd, metadata)
                   VALUES (gen_random_uuid(), $1, $2, $3, $4, '{}')""",
                tenant_uuid, service_type, quantity, cost_usd,
            )

            # Deduct token credits (only if sufficient balance)
            row = await conn.fetchrow(
                """UPDATE subscriptions SET token_credits_balance = token_credits_balance - $1
                   WHERE tenant_id = $2 AND token_credits_balance >= $1
                   RETURNING token_credits_balance""",
                quantity, tenant_uuid,
            )
            if not row:
                log.warning(f"Insufficient token balance for tenant {tenant_id}")
                return {"status": "insufficient_balance"}
            new_balance = row["token_credits_balance"]

            # Invalidate Redis cache
            try:
                r = _get_redis()
                r.delete(f"quota:{tenant_id}")
            except Exception:
                pass

            log.info(f"Deducted {quantity} tokens from {tenant_id}, new balance: {new_balance}")
            return {"deducted": quantity, "tenant_id": tenant_id, "new_balance": new_balance}
        finally:
            await conn.close()

    return asyncio.run(_deduct())


@celery.task(name="app.tasks.billing.daily_summary_emails", queue="billing", max_retries=3)
def daily_summary_emails():
    """Daily at 9am: send summary emails to all tenants with leads today.

    Collects HOT/WARM/COLD counts and sends via notifications.py.
    """
    import asyncio

    async def _run():
        from app.notifications import notify_daily_summary

        conn = await asyncpg.connect(DB_URL_SYNC)
        try:
            # Get all active tenants
            tenants = await conn.fetch(
                "SELECT id FROM tenants WHERE is_active = true"
            )
            for t in tenants:
                tid = str(t["id"])
                row = await conn.fetchrow(
                    """SELECT
                        count(*) FILTER (WHERE intent_score = 'HOT') as hot,
                        count(*) FILTER (WHERE intent_score = 'WARM') as warm,
                        count(*) FILTER (WHERE intent_score = 'COLD') as cold
                       FROM leads WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'""",
                    t["id"],
                )
                stats = {
                    "hot": row["hot"] or 0,
                    "warm": row["warm"] or 0,
                    "cold": row["cold"] or 0,
                }
                if sum(stats.values()) > 0:
                    await notify_daily_summary(tid, stats)
                    log.info(f"Daily summary sent for tenant {tid}: {stats}")
        finally:
            await conn.close()

    return asyncio.run(_run())
