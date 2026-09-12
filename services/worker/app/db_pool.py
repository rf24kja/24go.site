"""Shared asyncpg connection pool for all worker modules.

Ponytail: one pool per process, lazy-initialized, max 10 connections.
Eliminates per-query connection churn that exhausts PostgreSQL max_connections.
"""
import asyncpg
from .config import DATABASE_URL

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            DATABASE_URL.replace("+asyncpg", ""),
            min_size=2,
            max_size=10,
        )
    return _pool


async def fetchrow(query: str, *args):
    pool = await get_pool()
    return await pool.fetchrow(query, *args)


async def fetch(query: str, *args):
    pool = await get_pool()
    return await pool.fetch(query, *args)


async def execute(query: str, *args):
    pool = await get_pool()
    return await pool.execute(query, *args)
