"""Contacts endpoints — regression tests.

Covers the 2026-10 audit finding: contacts handlers referenced a
nonexistent Contact.metadata_ column (every filtered list, stats,
export, bulk-tag and update crashed with 500).
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.models import Contact


@pytest.fixture
async def authed():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post("/api/v1/auth/register", json={
            "email": "contacts@example.com",
            "password": "TestPass123",
            "company_name": "Contacts Co",
        })
        assert r.status_code == 201, r.text[:200]
        token = r.json()["access_token"]
        yield c, {"Authorization": f"Bearer {token}"}


async def _seed_contacts(n_tg=2, n_plain=1):
    import os
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.pool import NullPool

    # ponytail: own NullPool engine — never share the app pool across test loops
    engine = create_async_engine(
        os.getenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db"),
        poolclass=NullPool,
    )
    try:
        from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
        maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with maker() as db:
            from app.models import Tenant
            from sqlalchemy import select
            tenant = (await db.execute(select(Tenant).limit(1))).scalars().first()
            ids = []
            for i in range(n_tg):
                c = Contact(tenant_id=tenant.id, phone=f"+7000000000{i}",
                            has_tg=True, tags=["whatsapp"])
                db.add(c)
                await db.flush()
                ids.append(str(c.id))
            for i in range(n_plain):
                c = Contact(tenant_id=tenant.id, phone=f"+7111111111{i}",
                            has_tg=False, tags=[])
                db.add(c)
                await db.flush()
                ids.append(str(c.id))
            await db.commit()
            return ids
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_stats_no_crash(authed):
    c, headers = authed
    await _seed_contacts()
    r = await c.get("/api/v1/contacts/stats", headers=headers)
    assert r.status_code == 200, r.text[:200]
    data = r.json()
    assert data["total"] == 3
    assert data["with_tg"] == 2


@pytest.mark.asyncio
async def test_list_filters(authed):
    c, headers = authed
    await _seed_contacts()
    r = await c.get("/api/v1/contacts?has_tg=true", headers=headers)
    assert r.status_code == 200, r.text[:200]
    assert r.json()["total"] == 2
    r = await c.get("/api/v1/contacts?tags=whatsapp", headers=headers)
    assert r.status_code == 200
    assert r.json()["total"] == 2
    r = await c.get("/api/v1/contacts?search=70000000001", headers=headers)
    assert r.json()["total"] == 1


@pytest.mark.asyncio
async def test_bulk_tag_and_update(authed):
    c, headers = authed
    ids = await _seed_contacts(n_tg=1, n_plain=0)
    r = await c.post("/api/v1/contacts/bulk-tag", headers=headers,
                     json={"contact_ids": ids, "tags": ["vip"], "action": "add"})
    assert r.status_code == 200, r.text[:200]
    assert r.json()["updated"] == 1
    r = await c.put(f"/api/v1/contacts/{ids[0]}", headers=headers,
                    json={"notes": "called back"})
    assert r.status_code == 200, r.text[:200]


@pytest.mark.asyncio
async def test_export_csv(authed):
    c, headers = authed
    await _seed_contacts(n_tg=1, n_plain=0)
    r = await c.get("/api/v1/contacts/export", headers=headers)
    assert r.status_code == 200, r.text[:200]
    assert "phone" in r.text.splitlines()[0]
    assert "+70000000000" in r.text
