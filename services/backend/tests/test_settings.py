"""Settings endpoints — shadow-route regression tests.

Precedent: /api-keys and /export were shadowed by /{section} for months
(every call returned "Unknown section"). Contacts export had the same
class of bug with /{contact_id}. These tests pin the registration order.
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def authed():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post("/api/v1/auth/register", json={
            "email": "settings@example.com",
            "password": "TestPass123",
            "company_name": "Settings Co",
        })
        assert r.status_code == 201, r.text[:200]
        token = r.json()["access_token"]
        yield c, {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_api_keys_not_shadowed(authed):
    c, headers = authed
    r = await c.get("/api/v1/settings/api-keys", headers=headers)
    assert r.status_code == 200, r.text[:200]
    assert "keys" in r.json(), r.text[:200]  # shadowed route returns {"error": ...}


@pytest.mark.asyncio
async def test_api_key_lifecycle(authed):
    c, headers = authed
    r = await c.post("/api/v1/settings/api-keys", headers=headers,
                     json={"name": "ci-key"})
    assert r.status_code == 200, r.text[:200]
    assert r.json()["key"].startswith("24go_")
    r = await c.get("/api/v1/settings/api-keys", headers=headers)
    keys = r.json()["keys"]
    assert len(keys) == 1 and keys[0]["name"] == "ci-key"
    r = await c.delete(f"/api/v1/settings/api-keys/{keys[0]['id']}", headers=headers)
    assert r.status_code == 200
    r = await c.get("/api/v1/settings/api-keys", headers=headers)
    assert r.json()["keys"] == []


@pytest.mark.asyncio
async def test_export_not_shadowed(authed):
    c, headers = authed
    r = await c.get("/api/v1/settings/export", headers=headers)
    assert r.status_code == 200, r.text[:200]
    assert "exported_at" in r.text


@pytest.mark.asyncio
async def test_section_get_put(authed):
    c, headers = authed
    r = await c.get("/api/v1/settings/warmup", headers=headers)
    assert r.status_code == 200, r.text[:200]
    assert r.json()["section"] == "warmup"
    r = await c.put("/api/v1/settings/warmup", headers=headers,
                    json={"settings": {"enabled": False}})
    assert r.status_code == 200, r.text[:200]
    assert r.json()["status"] == "saved"
    r = await c.get("/api/v1/settings/nope", headers=headers)
    assert "error" in r.json()
