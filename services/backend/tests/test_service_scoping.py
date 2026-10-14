"""Per-service data isolation: accounts/campaigns/mailings/leaderboard
honor ?platform=, campaigns carry their service, scheduler reads it.
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def authed():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post("/api/v1/auth/register", json={
            "email": "scoping@example.com",
            "password": "TestPass123",
            "company_name": "Scoping Co",
        })
        assert r.status_code == 201, r.text[:200]
        token = r.json()["access_token"]
        yield c, {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_campaign_platform_scoping(authed):
    c, headers = authed
    for platform in ("telegram", "vkontakte"):
        r = await c.post("/api/v1/campaigns/", headers=headers, json={
            "name": f"{platform} promo", "base_text": "hi",
            "target_geos": [], "target_niches": [], "platform": platform,
        })
        assert r.status_code == 201, r.text[:200]
        assert r.json()["platform"] == platform
    r = await c.get("/api/v1/campaigns/?platform=telegram", headers=headers)
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["name"] == "telegram promo"
    r = await c.get("/api/v1/campaigns/?platform=vkontakte", headers=headers)
    assert r.json()["total"] == 1
    r = await c.get("/api/v1/campaigns/", headers=headers)
    assert r.json()["total"] == 2
    # leaderboard follows the same scoping
    r = await c.get("/api/v1/analytics/leaderboard?platform=telegram", headers=headers)
    assert r.status_code == 200, r.text[:200]
    names = [row["name"] for row in r.json()["leaderboard"]]
    assert any("telegram" in n for n in names)
    assert not any("vkontakte" in n for n in names)


@pytest.mark.asyncio
async def test_mailing_platform_scoping(authed):
    c, headers = authed
    r = await c.post("/api/v1/mailings/", headers=headers, json={
        "name": "tg blast", "message_text": "hi", "platform": "telegram",
    })
    assert r.status_code == 200, r.text[:200]
    r = await c.get("/api/v1/mailings/?platform=vkontakte", headers=headers)
    assert r.json()["total"] == 0
    r = await c.get("/api/v1/mailings/?platform=telegram", headers=headers)
    assert r.json()["total"] == 1


@pytest.mark.asyncio
async def test_accounts_platform_param_accepted(authed):
    c, headers = authed
    # no accounts seeded — guards the param contract, not data
    r = await c.get("/api/v1/accounts/?platform=whatsapp", headers=headers)
    assert r.status_code == 200, r.text[:200]
    assert r.json()["total"] == 0
