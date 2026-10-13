"""Mailings endpoints — table + enum regression tests.

020 created the mailings tables in the alembic chain (were legacy-only);
021 added whatsapp/max to platform_type (001 created it with 3 values).
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def authed():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post("/api/v1/auth/register", json={
            "email": "mailings@example.com",
            "password": "TestPass123",
            "company_name": "Mailings Co",
        })
        assert r.status_code == 201, r.text[:200]
        token = r.json()["access_token"]
        yield c, {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_and_list_mailing(authed):
    c, headers = authed
    r = await c.post("/api/v1/mailings/", headers=headers, json={
        "name": "promo", "message_text": "hello", "platform": "telegram",
    })
    assert r.status_code == 200, r.text[:200]
    r = await c.get("/api/v1/mailings/", headers=headers)
    assert r.status_code == 200
    assert r.json()["total"] == 1


@pytest.mark.asyncio
async def test_whatsapp_platform_enum_value(authed):
    """021 guard: inserting platform='whatsapp' must not raise
    'invalid input value for enum platform_type'."""
    import os
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.pool import NullPool

    # ponytail: own NullPool engine — never share the app pool across test loops
    engine = create_async_engine(
        os.getenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db"),
        poolclass=NullPool,
    )
    try:
        async with engine.connect() as conn:
            tenant_id = (await conn.execute(text("SELECT id FROM tenants LIMIT 1"))).scalar()
            await conn.execute(text(
                "INSERT INTO mailings (tenant_id, name, message_text, platform) "
                "VALUES (:t, 'wa-test', 'hi', 'whatsapp')"
            ), {"t": tenant_id})
            await conn.commit()
            n = (await conn.execute(text(
                "SELECT count(*) FROM mailings WHERE platform = 'whatsapp'"))).scalar()
            assert n == 1
            await conn.execute(text("DELETE FROM mailings WHERE name = 'wa-test'"))
            await conn.commit()
    finally:
        await engine.dispose()
