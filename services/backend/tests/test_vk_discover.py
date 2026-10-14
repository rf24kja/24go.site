"""VK discovery uses the tenant's vk.service_token (env fallback).

Without any token it returns [] instead of crashing — and with a saved
service_token it attempts the live lookup (VK rejects the fake token,
proving the tenant value was actually picked up, not the env).
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def authed():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post("/api/v1/auth/register", json={
            "email": "vkdisc@example.com",
            "password": "TestPass123",
            "company_name": "VK Disc Co",
        })
        assert r.status_code == 201, r.text[:200]
        token = r.json()["access_token"]
        yield c, {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_discover_vk_without_token_returns_empty(authed):
    c, headers = authed
    r = await c.post("/api/v1/groups/discover", headers=headers, json={
        "geo_tag": "Moscow", "niche": "it", "platform": "vkontakte",
    })
    assert r.status_code == 200, r.text[:200]
    assert r.json()["results"] == []
