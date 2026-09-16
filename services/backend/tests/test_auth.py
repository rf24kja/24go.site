"""Auth endpoint tests."""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_register_and_login(client):
    # Register
    r = await client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "TestPass123",
        "company": "Test Co",
    })
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["user"]["email"] == "test@example.com"

    # Login
    r2 = await client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "TestPass123",
    })
    assert r2.status_code == 200
    assert "access_token" in r2.json()


@pytest.mark.asyncio
async def test_register_weak_password(client):
    r = await client.post("/api/v1/auth/register", json={
        "email": "weak@example.com",
        "password": "weak",
        "company": "Weak Co",
    })
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    await client.post("/api/v1/auth/register", json={
        "email": "dup@example.com",
        "password": "TestPass123",
        "company": "Dup Co",
    })
    r = await client.post("/api/v1/auth/register", json={
        "email": "dup@example.com",
        "password": "TestPass456",
        "company": "Dup Co 2",
    })
    assert r.status_code in (400, 409, 422)


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await client.post("/api/v1/auth/register", json={
        "email": "wrong@example.com",
        "password": "TestPass123",
        "company": "Wrong Co",
    })
    r = await client.post("/api/v1/auth/login", json={
        "email": "wrong@example.com",
        "password": "WrongPass999",
    })
    assert r.status_code in (401, 400)
