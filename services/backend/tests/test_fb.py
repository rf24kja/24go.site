"""FB module: connect validation, platform plumbing, job lifecycle."""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def authed():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post("/api/v1/auth/register", json={
            "email": "fb@example.com",
            "password": "TestPass123",
            "company_name": "FB Co",
        })
        assert r.status_code == 201, r.text[:200]
        token = r.json()["access_token"]
        yield c, {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_connect_rejects_bad_cookies(authed):
    c, headers = authed
    r = await c.post("/api/v1/fb/connect", headers=headers, json={
        "profile_name": "x", "c_user": "abcde", "xs": "0123456789",
    })
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_connect_stores_session(authed):
    c, headers = authed
    body = {"profile_name": "scraper-1", "c_user": "1234567890",
            "xs": "abcdefghijklmnopqrstuvwxyz012345"}
    r = await c.post("/api/v1/fb/connect", headers=headers, json=body)
    assert r.status_code == 201, r.text[:200]
    first_id = r.json()["id"]
    # reconnect same profile updates, no duplicate
    r = await c.post("/api/v1/fb/connect", headers=headers, json=body)
    assert r.json()["id"] == first_id
    r = await c.get("/api/v1/accounts/?platform=facebook", headers=headers)
    assert r.json()["total"] == 1


@pytest.mark.asyncio
async def test_facebook_lists_and_settings(authed):
    c, headers = authed
    r = await c.get("/api/v1/leads/?platform=facebook&limit=1", headers=headers)
    assert r.status_code == 200
    r = await c.get("/api/v1/settings/warmup?service=facebook", headers=headers)
    assert r.status_code == 200
    r = await c.post("/api/v1/campaigns/", headers=headers, json={
        "name": "fb promo", "base_text": "hi",
        "target_geos": [], "target_niches": [], "platform": "facebook",
    })
    assert r.status_code == 201, r.text[:200]
    assert r.json()["platform"] == "facebook"


@pytest.mark.asyncio
async def test_marketplace_job_lifecycle(authed):
    c, headers = authed
    # no account yet
    r = await c.post("/api/v1/fb/marketplace/search", headers=headers,
                     json={"query": "villa"})
    assert r.status_code == 400
    await c.post("/api/v1/fb/connect", headers=headers, json={
        "profile_name": "mp-1", "c_user": "1234567890",
        "xs": "abcdefghijklmnopqrstuvwxyz012345"})
    r = await c.post("/api/v1/fb/marketplace/search", headers=headers,
                     json={"query": "villa pool"})
    assert r.status_code == 202, r.text[:200]
    assert r.json()["job_id"]
    r = await c.get("/api/v1/fb/marketplace/status/nope", headers=headers)
    assert r.status_code == 404
    r = await c.get("/api/v1/fb/marketplace/results?query=villa%20pool",
                    headers=headers)
    assert r.status_code == 200
    assert r.json()["items"] == []
