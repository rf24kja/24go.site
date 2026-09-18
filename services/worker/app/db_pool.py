"""Shared connection pools (asyncpg + Redis) for all worker modules.

Ponytail: one pool per process, lazy-initialized.
"""
import os

import asyncpg
import redis.asyncio as aioredis

from .config import DATABASE_URL

_pool: asyncpg.Pool | None = None
_redis: aioredis.Redis | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            DATABASE_URL.replace("+asyncpg", ""),
            min_size=2,
            max_size=10,
        )
    return _pool


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1"),
            decode_responses=True,
            max_connections=10,
        )
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
