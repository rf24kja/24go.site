"""Missing purpose-scoped VK discovery credentials fail explicitly, offline."""
from unittest.mock import AsyncMock, patch
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
async def test_discover_vk_without_token_requires_connection(authed):
    c, headers = authed
    with patch("app.vk_discovery._vk_call", new_callable=AsyncMock) as provider:
        r = await c.post("/api/v1/groups/discover", headers=headers, json={
            "geo_tag": "Moscow", "niche": "it", "platform": "vkontakte",
        })
    assert r.status_code == 409, r.text[:200]
    assert r.json()["detail"] == {"code": "vk_discovery_not_connected"}
    provider.assert_not_awaited()
