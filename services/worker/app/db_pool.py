"""Connection helpers for worker modules.

Ponytail: NO shared pools. Celery prefork + per-task new_event_loop() means
any pool object outlives its loop and dies with "Event loop is closed".
Every helper opens what it needs on the current loop and closes it before
return. Cost is one TCP+auth per call — negligible at our task rates, and
structurally leak-proof (no cross-loop close, no private attrs).
"""
import os

import asyncpg
import redis.asyncio as aioredis

from .config import DATABASE_URL

_PG_DSN = DATABASE_URL.replace("+asyncpg", "")
_REDIS_URL = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1")


async def get_pool() -> asyncpg.Pool:
    """Fresh minimal pool on the current loop. Caller must close it.

    Prefer fetchrow/fetch/execute helpers — they manage lifecycle for you.
    """
    return await asyncpg.create_pool(_PG_DSN, min_size=1, max_size=2)


async def get_redis() -> aioredis.Redis:
    """Fresh lazy client. Redis-py resolves connections per operation;
    no loop affinity to track, nothing to close for short uses."""
    return aioredis.from_url(_REDIS_URL, decode_responses=True, max_connections=5)


async def fetchrow(query: str, *args):
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            return await conn.fetchrow(query, *args)
    finally:
        await pool.close()


async def fetch(query: str, *args):
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            return await conn.fetch(query, *args)
    finally:
        await pool.close()


async def fetchval(query: str, *args):
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            return await conn.fetchval(query, *args)
    finally:
        await pool.close()


async def execute(query: str, *args):
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            return await conn.execute(query, *args)
    finally:
        await pool.close()
