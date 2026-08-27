"""Distributed lock for account/proxy concurrency control (Redlock pattern).

Uses Redis SET NX with TTL. Per spec: workers MUST acquire lock before
executing actions on an account to prevent race conditions.
"""
import os
import time
from contextlib import contextmanager

import redis

_redis = None


def _get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.Redis.from_url(
            os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1"),
            decode_responses=True,
        )
    return _redis


@contextmanager
def acquire_account_lock(tenant_id: str, account_id: str, lock_timeout: int = 60):
    """Acquire a per-account distributed lock. Yields True if acquired, False otherwise."""
    r = _get_redis()
    lock_key = f"lock:tenant:{tenant_id}:account:{account_id}"
    acquired = r.set(lock_key, "locked", nx=True, ex=lock_timeout)
    try:
        yield acquired
    finally:
        if acquired:
            r.delete(lock_key)


@contextmanager
def acquire_proxy_lock(tenant_id: str, proxy_id: str, lock_timeout: int = 120):
    """Acquire a per-proxy distributed lock."""
    r = _get_redis()
    lock_key = f"lock:tenant:{tenant_id}:proxy:{proxy_id}"
    acquired = r.set(lock_key, "locked", nx=True, ex=lock_timeout)
    try:
        yield acquired
    finally:
        if acquired:
            r.delete(lock_key)


def get_daily_action_count(tenant_id: str, account_id: str) -> int:
    """Get today's action count for an account from Redis counter."""
    r = _get_redis()
    key = f"daily_actions:{tenant_id}:{account_id}:{time.strftime('%Y-%m-%d')}"
    count = r.get(key)
    return int(count) if count else 0


def increment_daily_actions(tenant_id: str, account_id: str, ttl: int = 86400) -> int:
    """Atomically increment daily action counter. Returns new count."""
    r = _get_redis()
    key = f"daily_actions:{tenant_id}:{account_id}:{time.strftime('%Y-%m-%d')}"
    count = r.incr(key)
    if count == 1:
        r.expire(key, ttl)
    return count
