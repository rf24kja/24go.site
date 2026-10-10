"""Worker-side quota enforcement — atomic post/token tracking.

Ponytail: mirrors backend/app/quota.py's record_post/record_usage
using the worker's own asyncpg pool. Same SQL, same guarantees.
"""
import json
import logging
import uuid

from app.db_pool import fetchrow, execute, get_redis

log = logging.getLogger(__name__)


async def record_post(tenant_id: str) -> dict:
    """Increment monthly post counter atomically."""
    row = await fetchrow(
        """UPDATE subscriptions SET monthly_posts_used = monthly_posts_used + 1
           WHERE tenant_id = $1 RETURNING monthly_posts_used, monthly_posts_limit""",
        uuid.UUID(tenant_id),
    )
    if not row:
        return {}
    try:
        r = await get_redis()
        await r.delete(f"quota:{tenant_id}")
    except Exception:
        pass
    log.info(f"record_post: tenant={tenant_id} posts={row['monthly_posts_used']}/{row['monthly_posts_limit']}")
    return {"posts_used": row["monthly_posts_used"], "posts_limit": row["monthly_posts_limit"]}


async def record_usage(tenant_id: str, tokens_used: int) -> dict:
    """Deduct token credits and log usage atomically."""
    if tokens_used <= 0:
        return {}
    cost_usd = tokens_used * 0.14 / 1_000_000  # ponytail: flat rate, match backend LLM_COST_PER_MILLION["prompt"]
    tenant_uuid = uuid.UUID(tenant_id)
    await execute(
        """INSERT INTO usage_logs (id, tenant_id, service_type, quantity_used, estimated_cost_usd, metadata)
           VALUES (gen_random_uuid(), $1, 'classification', $2, $3, '{}')""",
        tenant_uuid, tokens_used, cost_usd,
    )
    row = await fetchrow(
        """UPDATE subscriptions SET token_credits_balance = token_credits_balance - $1
           WHERE tenant_id = $2 AND token_credits_balance >= $1
           RETURNING token_credits_balance""",
        tokens_used, tenant_uuid,
    )
    if not row:
        log.warning(f"record_usage: insufficient credits for tenant={tenant_id}")
        return {"status": "insufficient_balance"}
    try:
        r = await get_redis()
        await r.delete(f"quota:{tenant_id}")
    except Exception:
        pass
    log.info(f"record_usage: tenant={tenant_id} tokens={tokens_used} new_balance={row['token_credits_balance']}")
    return {"tokens_used": tokens_used, "cost_usd": cost_usd, "new_balance": row["token_credits_balance"]}
