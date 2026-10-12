"""Shared test fixtures."""
import os

# ponytail: test env must be set BEFORE app imports (config.py raises without keys)
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("ENCRYPTION_KEY", "test-encryption-key-for-pytest-only")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-pytest-only")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://app_user:test_pw@localhost:5434/app_db")

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool


@pytest_asyncio.fixture(autouse=True)
async def _clean_auth_tables():
    """Isolation: truncate auth tables before each test (no cross-test users).

    ponytail: own NullPool engine per run — the app's shared pool binds
    connections to one event loop, and fixture runs get fresh loops.
    Reusing it here dies with 'Event loop is closed'.
    """
    import os

    url = os.getenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
    engine = create_async_engine(url, poolclass=NullPool)
    try:
        async with engine.connect() as conn:
            await conn.execute(
                text("TRUNCATE users, tenants, subscriptions RESTART IDENTITY CASCADE")
            )
            await conn.commit()
    finally:
        await engine.dispose()
    # ponytail: flush Redis too — register/login rate limits would bleed across tests
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(
            os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=True
        )
        await r.flushdb()
        await r.aclose()
    except Exception:
        pass
    yield
