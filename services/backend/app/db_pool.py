"""Shared asyncpg connection pool for raw queries that bypass SQLAlchemy.

ponytail: single pool, max 10 connections. Upgrade to per-service pools
if throughput > 500 req/s.
"""
from contextlib import asynccontextmanager
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


@asynccontextmanager
async def connection():
    """Drop-in replacement for `asyncpg.connect()` — uses the shared pool."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


async def fetch(query: str, *args) -> list[asyncpg.Record]:
    """Execute a SELECT query via the shared pool."""
    pool = await get_pool()
    return await pool.fetch(query, *args)


async def fetchrow(query: str, *args) -> asyncpg.Record | None:
    """Execute a SELECT query returning one row via the shared pool."""
    pool = await get_pool()
    return await pool.fetchrow(query, *args)


async def fetchval(query: str, *args):
    """Execute a query returning a single value via the shared pool."""
    pool = await get_pool()
    return await pool.fetchval(query, *args)


async def execute(query: str, *args) -> str:
    """Execute an INSERT/UPDATE/DELETE via the shared pool."""
    pool = await get_pool()
    return await pool.execute(query, *args)
