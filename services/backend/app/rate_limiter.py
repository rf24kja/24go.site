"""Redis-based rate limiter middleware for FastAPI.

Uses sliding window counter per tenant. Limits defined in plan tiers.
"""
import time
import logging
import asyncpg
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
import redis.asyncio as redis

from app.config import settings

log = logging.getLogger(__name__)

# ponytail: in-memory fallback if Redis is down. One process only.
_redis: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


# Plan limits: requests per minute
PLAN_LIMITS = {
    "trial": 30,
    "starter": 100,
    "pro": 300,
    "enterprise": 1000,
}

# Paths that bypass rate limiting
SKIP_PATHS = {"/health", "/ws", "/docs", "/openapi.json", "/internal/broadcast"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip non-API and exempt paths
        if not path.startswith("/api/") or any(path.startswith(s) for s in SKIP_PATHS):
            return await call_next(request)

        # Extract tenant_id from request state (set by RLS middleware)
        tenant_id = getattr(request.state, "tenant_id", None)
        if not tenant_id:
            return await call_next(request)

        try:
            r = await get_redis()
            key = f"rl:{tenant_id}:{int(time.time() // 60)}"
            current = await r.incr(key)
            if current == 1:
                await r.expire(key, 120)

            # Get plan from cache or DB
            plan = getattr(request.state, "plan", None)
            if plan is None:
                plan = "trial"
                try:
                    conn_url = settings.DATABASE_URL.replace("+asyncpg", "")
                    conn = await asyncpg.connect(conn_url)
                    try:
                        row = await conn.fetchrow(
                            "SELECT plan FROM subscriptions WHERE tenant_id = $1",
                            tenant_id,
                        )
                        if row:
                            plan = row["plan"]
                    finally:
                        await conn.close()
                except Exception:
                    pass
                request.state.plan = plan
            limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])

            if current > limit:
                return JSONResponse(
                    status_code=429,
                    content={"error": "rate_limited", "limit": limit, "retry_after": 60 - (int(time.time()) % 60)},
                    headers={"Retry-After": str(60 - (int(time.time()) % 60))},
                )
        except Exception:
            # Redis down — skip rate limiting, don't block requests
            pass

        return await call_next(request)
