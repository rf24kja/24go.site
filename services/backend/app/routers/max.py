"""MAX messenger integration: bot connect, status, webhook receiver.

Bot API: https://platform-api2.max.ru (TLS: Russian Trusted Root CA).
Auth: Authorization: <bot_token> header.
Docs: https://dev.max.ru/docs-api
"""
import hmac
import logging
import os
import uuid as _uuid
from datetime import datetime, timezone

import asyncpg
import httpx
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.config import settings
from app.crypto import encrypt, decrypt
from app.database import get_db
from app.models import AccountPool, Lead, LeadIntentLevel, LeadStatus, PlatformType, User
from app.security import get_current_user

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/max", tags=["max"])

MAX_API = "https://platform-api2.max.ru"


def _verify_bundle() -> str | bool:
    """TLS bundle with Russian Trusted Root CA. Falls back to system certs."""
    for candidate in (
        os.getenv("MAX_CA_BUNDLE", ""),
        "/app/certs/ru-bundle.pem",
        "certs/ru-bundle.pem",
    ):
        if candidate and os.path.isfile(candidate):
            return candidate
    return True


def _max_client(token: str) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=MAX_API,
        headers={"Authorization": token},
        timeout=30,
        verify=_verify_bundle(),
    )


class MaxConnectRequest(BaseModel):
    bot_token: str = Field(..., min_length=10, max_length=500)


@router.post("/connect")
async def max_connect(
    body: MaxConnectRequest,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Validate bot token via GET /me, store encrypted in account_sessions."""
    async with _max_client(body.bot_token) as client:
        try:
            resp = await client.get("/me")
        except Exception as e:
            raise HTTPException(502, f"MAX API unreachable: {e}")
    if resp.status_code == 401:
        raise HTTPException(401, "Invalid MAX bot token")
    if resp.status_code != 200:
        raise HTTPException(502, f"MAX API error: {resp.status_code}")
    try:
        me = resp.json()
    except Exception:
        raise HTTPException(502, "MAX API returned non-JSON")
    bot_name = str(me.get("name") or me.get("username") or "max_bot")

    account = AccountPool(
        tenant_id=current_user.tenant_id,
        platform="max",
        account_identifier=bot_name,
        session_data="max_token",  # placeholder, real token in account_sessions
        device_fingerprint={"bot_name": bot_name},
        status="warming_up",
    )
    # get_db dependency injected below via Depends; session bound here
    return await _store_account(db, current_user, account, body.bot_token)


async def _store_account(db, current_user, account, token: str):
    db.add(account)
    await db.flush()
    encrypted = encrypt(token)
    conn_url = settings.DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(conn_url)
    try:
        existing = await conn.fetchrow(
            "SELECT id FROM account_sessions WHERE account_id = $1",
            _uuid.UUID(str(account.id)),
        )
        if existing:
            await conn.execute(
                "UPDATE account_sessions SET session_data = $1, updated_at = NOW() WHERE account_id = $2",
                encrypted, _uuid.UUID(str(account.id)),
            )
        else:
            await conn.execute(
                """INSERT INTO account_sessions (id, account_id, session_data, created_at, updated_at)
                   VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())""",
                _uuid.UUID(str(account.id)), encrypted,
            )
    finally:
        await conn.close()
    await db.commit()
    return {"id": str(account.id), "bot_name": account.account_identifier, "status": account.status}


@router.get("/accounts")
async def max_list_accounts(
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List tenant MAX bots (tokens never exposed)."""
    result = await db.execute(
        select(AccountPool).where(
            AccountPool.tenant_id == current_user.tenant_id,
            AccountPool.platform == "max",
        )
    )
    return {"items": [
        {"id": str(a.id), "bot_name": a.account_identifier, "status": a.status,
         "created_at": a.created_at}
        for a in result.scalars().all()
    ]}


@router.delete("/accounts/{account_id}")
async def max_delete_account(
    account_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove bot + encrypted token."""
    result = await db.execute(
        select(AccountPool).where(
            AccountPool.id == _uuid.UUID(account_id),
            AccountPool.tenant_id == current_user.tenant_id,
            AccountPool.platform == "max",
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "MAX account not found")
    await db.delete(account)
    await db.commit()
    return {"deleted": True}


@router.get("/status/{account_id}")
async def max_status(
    account_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-validate token via GET /me. Returns connected true/false."""
    result = await db.execute(
        select(AccountPool).where(
            AccountPool.id == _uuid.UUID(account_id),
            AccountPool.tenant_id == current_user.tenant_id,
            AccountPool.platform == "max",
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "MAX account not found")
    conn_url = settings.DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(conn_url)
    try:
        row = await conn.fetchrow(
            "SELECT session_data FROM account_sessions WHERE account_id = $1",
            _uuid.UUID(str(account.id)),
        )
    finally:
        await conn.close()
    if not row:
        return {"connected": False}
    try:
        token = decrypt(row["session_data"])
    except Exception:
        return {"connected": False}
    try:
        async with _max_client(token) as client:
            resp = await client.get("/me")
    except Exception as e:
        log.warning(f"max status check failed: {e}")
        return {"connected": False}
    return {"connected": resp.status_code == 200}


class MaxSubscribeRequest(BaseModel):
    url: str = Field(..., min_length=12, max_length=500)
    secret: str = Field(..., min_length=5, max_length=256)


@router.post("/subscribe/{account_id}")
async def max_subscribe(
    account_id: str,
    body: MaxSubscribeRequest,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Subscribe webhook URL for bot updates. Secret stored for validation."""
    result = await db.execute(
        select(AccountPool).where(
            AccountPool.id == _uuid.UUID(account_id),
            AccountPool.tenant_id == current_user.tenant_id,
            AccountPool.platform == "max",
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "MAX account not found")
    conn_url = settings.DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(conn_url)
    try:
        row = await conn.fetchrow(
            "SELECT session_data FROM account_sessions WHERE account_id = $1",
            _uuid.UUID(str(account.id)),
        )
    finally:
        await conn.close()
    if not row:
        raise HTTPException(400, "No token stored for account")
    token = decrypt(row["session_data"])
    async with _max_client(token) as client:
        try:
            resp = await client.post("/subscriptions", json={
                "url": body.url,
                "update_types": ["message_created", "bot_started"],
                "secret": body.secret,
            })
        except Exception as e:
            raise HTTPException(502, f"MAX API unreachable: {e}")
    if resp.status_code != 200:
        raise HTTPException(502, f"MAX subscribe failed: {resp.status_code} {resp.text[:200]}")
    fp = dict(account.device_fingerprint or {})
    fp["webhook_secret"] = body.secret
    fp["webhook_url"] = body.url
    account.device_fingerprint = fp
    await db.commit()
    return {"subscribed": True}


@router.post("/webhooks/{account_id}")
async def max_webhook(
    account_id: str,
    request: Request,
    db=Depends(get_db),
    x_max_bot_api_secret: str = Header(default=""),
):
    """Receive MAX bot updates. Validates per-bot secret, stores lead."""
    try:
        update = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")
    result = await db.execute(
        select(AccountPool).where(AccountPool.id == _uuid.UUID(account_id))
    )
    account = result.scalar_one_or_none()
    if not account or account.platform != "max":
        raise HTTPException(404, "Unknown bot")
    secret = (account.device_fingerprint or {}).get("webhook_secret", "")
    if secret and not hmac.compare_digest(x_max_bot_api_secret, secret):
        raise HTTPException(403, "Invalid webhook secret")

    update_type = update.get("update_type", "")
    if update_type not in ("message_created", "bot_started"):
        return {"ignored": update_type}

    msg = update.get("message") or {}
    sender = msg.get("sender") or update.get("user") or {}
    user_id = str(sender.get("user_id") or msg.get("sender_id") or "unknown")
    text = (msg.get("text") or "")[:2000]
    chat = msg.get("chat") or {}
    chat_id = str(chat.get("chat_id") or update.get("chat_id") or "")
    message_id = str(msg.get("message_id") or msg.get("id") or "")

    lead = Lead(
        tenant_id=account.tenant_id,
        platform=PlatformType.max,
        account_id=account.id,
        user_handle=f"max_{user_id}"[:255],
        user_full_name=str(sender.get("name") or "")[:255],
        message_text=text,
        intent_score=LeadIntentLevel.COLD,
        status=LeadStatus.new,
        source="max_chat" if chat_id else "max_dm",
        post_id=(message_id or chat_id)[:255] or None,
        dialog_url="",
    )
    db.add(lead)
    await db.commit()
    return {"lead_id": str(lead.id)}
