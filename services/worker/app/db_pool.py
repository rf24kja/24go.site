"""Shared connection pools (asyncpg + Redis) for all worker modules.

Ponytail: one pool per process per event loop, lazy-initialized.
Celery prefork + per-task new_event_loop() means the running loop changes
constantly — a pool bound to a dead loop raises "Event loop is closed".
So we track the owning loop and rebuild when it changes.
"""
import asyncio
import os

import asyncpg
import redis.asyncio as aioredis

from .config import DATABASE_URL

_pool: asyncpg.Pool | None = None
_pool_loop: asyncio.AbstractEventLoop | None = None
_redis: aioredis.Redis | None = None
_redis_loop: asyncio.AbstractEventLoop | None = None


def _running_loop() -> asyncio.AbstractEventLoop | None:
    try:
        return asyncio.get_running_loop()
    except RuntimeError:
        return None


async def get_pool() -> asyncpg.Pool:
    global _pool, _pool_loop
    running = _running_loop()
    if _pool is None or _pool_loop is not running or _pool._closed:
        if _pool is not None:
            try:
                await _pool.close()
            except Exception:
                pass
        _pool = await asyncpg.create_pool(
            DATABASE_URL.replace("+asyncpg", ""),
            min_size=2,
            max_size=10,
        )
        _pool_loop = running
    return _pool


async def get_redis() -> aioredis.Redis:
    global _redis, _redis_loop
    running = _running_loop()
    if _redis is None or _redis_loop is not running:
        try:
            if _redis is not None:
                await _redis.aclose()
        except Exception:
            pass
        _redis = aioredis.from_url(
            os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1"),
            decode_responses=True,
            max_connections=10,
        )
        _redis_loop = running
    return _redis


async def fetchrow(query: str, *args):
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchrow(query, *args)


async def fetch(query: str, *args):
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(query, *args)


async def execute(query: str, *args):
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.execute(query, *args)
