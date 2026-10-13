"""X-API-Key auth — the bot's credential (JWT stays for dashboard).

Covers security.get_current_user_or_api_key on the 4 opted-in endpoints.
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def authed():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post("/api/v1/auth/register", json={
            "email": "keys@example.com",
            "password": "TestPass123",
            "company_name": "Keys Co",
        })
        assert r.status_code == 201, r.text[:200]
        token = r.json()["access_token"]
        yield c, {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def raw_key(authed):
    c, headers = authed
    r = await c.post("/api/v1/settings/api-keys", headers=headers,
                     json={"name": "bot-key"})
    assert r.status_code == 200, r.text[:200]
    return c, headers, r.json()["key"]


@pytest.mark.asyncio
async def test_api_key_authenticates(raw_key):
    c, headers, key = raw_key
    r = await c.get("/api/v1/leads/?limit=1", headers={"X-API-Key": key})
    assert r.status_code == 200, r.text[:200]


@pytest.mark.asyncio
async def test_bad_key_rejected(authed):
    c, _ = authed
    r = await c.get("/api/v1/leads/?limit=1", headers={"X-API-Key": "24go_nope"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_revoked_key_rejected(raw_key):
    c, headers, key = raw_key
    r = await c.get("/api/v1/settings/api-keys", headers=headers)
    key_id = r.json()["keys"][0]["id"]
    await c.delete(f"/api/v1/settings/api-keys/{key_id}", headers=headers)
    r = await c.get("/api/v1/leads/?limit=1", headers={"X-API-Key": key})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_jwt_still_works_and_anon_rejected(authed):
    c, headers = authed
    assert (await c.get("/api/v1/leads/?limit=1", headers=headers)).status_code == 200
    assert (await c.get("/api/v1/leads/?limit=1")).status_code in (401, 403)
