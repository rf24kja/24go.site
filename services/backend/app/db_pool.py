"""Shared asyncpg connection pool for raw queries that bypass SQLAlchemy.

ponytail: single pool, max 10 connections. Upgrade to per-service pools
if throughput > 500 req/s.
"""
import asyncpg
from app.config import settings

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        url = settings.DATABASE_URL.replace("+asyncpg", "")
        _pool = await asyncpg.create_pool(url, min_size=2, max_size=10)
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
