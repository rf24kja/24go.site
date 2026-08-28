"""Quota enforcement and token metering for multi-tenant billing.

Ponytail: Redis fast-path for quota checks, PostgreSQL for persistence.
"""
import json
import logging
import time
import uuid
from datetime import datetime, timedelta

import asyncpg
import redis

from app.config import settings

log = logging.getLogger(__name__)

# Plan tier limits (from BILLING_AND_LIMITS.md)
PLAN_LIMITS = {
    "trial": {
        "monthly_posts_limit": 100,
        "token_credits_balance": 100_000,
        "max_accounts": 2,
        "max_targets": 10,
    },
    "starter": {
        "monthly_posts_limit": 1_500,
        "token_credits_balance": 1_000_000,
        "max_accounts": 5,
        "max_targets": 100,
    },
    "pro": {
        "monthly_posts_limit": 7_500,
        "token_credits_balance": 5_000_000,
        "max_accounts": 20,
        "max_targets": 500,
    },
    "enterprise": {
        "monthly_posts_limit": 999_999_999,
        "token_credits_balance": 999_999_999,
        "max_accounts": 999_999_999,
        "max_targets": 999_999_999,
    },
}

# LLM cost basis (per million tokens, USD)
LLM_COST_PER_MILLION = {
    "prompt": 0.14,
    "completion": 0.28,
}


def _get_redis() -> redis.Redis:
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


async def check_quota(
    tenant_id: str,
    action_type: str,
    estimated_tokens: int = 0,
    db_url: str | None = None,
) -> dict:
    """Fast quota check via Redis + DB fallback.

    Returns {"allowed": True/False, "reason": "...", "details": {...}}
    """
    r = _get_redis()
    cache_key = f"quota:{tenant_id}"

    # Try Redis cache first (populated by billing task)
    cached = r.get(cache_key)
    if cached:
        data = json.loads(cached)
        if action_type == "post" and data.get("posts_used", 0) >= data.get("posts_limit", 0):
            return {"allowed": False, "reason": "monthly_post_limit_exceeded", "details": data}
        if estimated_tokens > 0 and data.get("tokens_balance", 0) < estimated_tokens:
            return {"allowed": False, "reason": "insufficient_token_credits", "details": data}
        return {"allowed": True, "reason": "quota_ok", "details": data}

    # DB fallback — ponytail: synchronous connect is fine for quota checks
    url = db_url or settings.DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(url)
    try:
        row = await conn.fetchrow(
            "SELECT plan, status, monthly_posts_limit, monthly_posts_used, "
            "token_credits_balance FROM subscriptions WHERE tenant_id = $1",
            uuid.UUID(tenant_id),
        )
        if not row:
            return {"allowed": False, "reason": "no_subscription"}
        if row["status"] != "active":
            return {"allowed": False, "reason": f"subscription_{row['status']}"}

        data = {
            "plan": row["plan"],
            "posts_limit": row["monthly_posts_limit"],
            "posts_used": row["monthly_posts_used"],
            "tokens_balance": row["token_credits_balance"],
        }

        # Cache for 60s
        r.setex(cache_key, 60, json.dumps(data))

        if action_type == "post" and data["posts_used"] >= data["posts_limit"]:
            return {"allowed": False, "reason": "monthly_post_limit_exceeded", "details": data}
        if estimated_tokens > 0 and data["tokens_balance"] < estimated_tokens:
            return {"allowed": False, "reason": "insufficient_token_credits", "details": data}

        return {"allowed": True, "reason": "quota_ok", "details": data}
    finally:
        await conn.close()


async def record_usage(
    tenant_id: str,
    service_type: str,
    prompt_tokens: int,
    completion_tokens: int,
    db_url: str | None = None,
) -> dict:
    """Record LLM usage and deduct token credits.

    Returns {"tokens_used": int, "cost_usd": float, "new_balance": int}
    """
    total_tokens = prompt_tokens + completion_tokens
    cost_usd = (
        prompt_tokens * LLM_COST_PER_MILLION["prompt"]
        + completion_tokens * LLM_COST_PER_MILLION["completion"]
    ) / 1_000_000

    url = db_url or settings.DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(url)
    try:
        tenant_uuid = uuid.UUID(tenant_id)

        # Insert usage log
        await conn.execute(
            """INSERT INTO usage_logs (id, tenant_id, service_type, quantity_used, estimated_cost_usd, metadata)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)""",
            tenant_uuid, service_type, total_tokens, cost_usd,
            json.dumps({"prompt": prompt_tokens, "completion": completion_tokens}),
        )

        # Deduct token credits
        row = await conn.fetchrow(
            """UPDATE subscriptions SET token_credits_balance = token_credits_balance - $1
               WHERE tenant_id = $2 RETURNING token_credits_balance""",
            total_tokens, tenant_uuid,
        )
        new_balance = row["token_credits_balance"] if row else 0

        # Invalidate Redis cache
        try:
            _get_redis().delete(f"quota:{tenant_id}")
        except Exception:
            pass

        log.info(f"Usage recorded: tenant={tenant_id} tokens={total_tokens} cost=${cost_usd:.6f} balance={new_balance}")
        return {"tokens_used": total_tokens, "cost_usd": cost_usd, "new_balance": new_balance}
    finally:
        await conn.close()


async def record_post(tenant_id: str, db_url: str | None = None) -> dict:
    """Increment monthly post counter for a tenant.

    Returns {"posts_used": int, "posts_limit": int}
    """
    url = db_url or settings.DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(url)
    try:
        tenant_uuid = uuid.UUID(tenant_id)
        row = await conn.fetchrow(
            """UPDATE subscriptions SET monthly_posts_used = monthly_posts_used + 1
               WHERE tenant_id = $1 RETURNING monthly_posts_used, monthly_posts_limit""",
            tenant_uuid,
        )

        # Invalidate Redis cache
        try:
            _get_redis().delete(f"quota:{tenant_id}")
        except Exception:
            pass

        return {"posts_used": row["monthly_posts_used"], "posts_limit": row["monthly_posts_limit"]}
    finally:
        await conn.close()


def get_plan_limits(plan: str) -> dict:
    """Return resource limits for a given plan tier."""
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])
