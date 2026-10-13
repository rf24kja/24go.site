"""Delete-account completeness — I6: no tenant data (or login) may survive."""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def authed():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post("/api/v1/auth/register", json={
            "email": "gone@example.com",
            "password": "TestPass123",
            "company_name": "Gone Co",
        })
        assert r.status_code == 201, r.text[:200]
        token = r.json()["access_token"]
        yield c, {"Authorization": f"Bearer {token}"}


async def _seed():
    import os
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy.pool import NullPool
    from sqlalchemy import select
    from app.models import Tenant, Target, Proxy, Contact, Lead
    from app.billing_models import BillingTransaction

    # ponytail: own NullPool engine — never share the app pool across test loops
    engine = create_async_engine(
        os.getenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db"),
        poolclass=NullPool,
    )
    try:
        maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with maker() as db:
            tenant = (await db.execute(select(Tenant).limit(1))).scalars().first()
            db.add(Target(tenant_id=tenant.id, platform="telegram",
                          target_id_code="t1", title="T1",
                          geo_tag="ru", niche="tech", access="open_wall"))
            db.add(Proxy(tenant_id=tenant.id, proxy_url="http://127.0.0.1:8080"))
            db.add(Contact(tenant_id=tenant.id, phone="+70000000001"))
            db.add(Lead(tenant_id=tenant.id, user_handle="@gone",
                          message_text="hi", platform="telegram",
                          dialog_url="https://t.me/gone"))
            db.add(BillingTransaction(tenant_id=tenant.id, amount_usd=10,
                                      payment_provider="stripe",
                                      provider_transaction_id="tx_keep_me",
                                      status="paid"))
            await db.commit()
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_delete_account_removes_everything(authed):
    import os
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.pool import NullPool

    c, headers = authed
    await _seed()
    r = await c.post("/api/v1/settings/delete-account", headers=headers,
                     json={"confirm": True})
    assert r.status_code == 200, r.text[:200]
    assert r.json()["status"] == "deleted"

    engine = create_async_engine(
        os.getenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db"),
        poolclass=NullPool,
    )
    try:
        async with engine.connect() as conn:
            async def count(t):
                return (await conn.execute(
                    text(f"SELECT count(*) FROM {t}"))).scalar()
            for t in ("targets", "proxies", "contacts", "leads", "users",
                      "api_keys", "subscriptions", "tenant_settings"):
                assert await count(t) == 0, f"{t} survived deletion"
            # money trail stays for accounting
            assert await count("billing_transactions") == 1
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_delete_account_needs_confirm(authed):
    c, headers = authed
    r = await c.post("/api/v1/settings/delete-account", headers=headers,
                     json={"confirm": False})
    assert r.json().get("error") == "Confirmation required"
