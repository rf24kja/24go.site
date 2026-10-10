"""MAX messenger integration: bot connect, status, webhook receiver.

Bot API: https://platform-api2.max.ru (TLS: Russian Trusted Root CA).
Auth: Authorization: <bot_token> header.
Docs: https://dev.max.ru/docs-api
"""
import hashlib
import hmac
import logging
import os
import secrets
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
            log.warning(f"max /me unreachable: {e}")
            raise HTTPException(502, "MAX API unreachable")
    if resp.status_code == 401:
        # ponytail: 400, not 401 — a mistyped bot token must not nuke the login session
        raise HTTPException(400, "Invalid MAX bot token")
    if resp.status_code != 200:
        raise HTTPException(502, f"MAX API error: {resp.status_code}")
    try:
        me = resp.json()
    except Exception:
        raise HTTPException(502, "MAX API returned non-JSON")
    bot_name = str(me.get("name") or me.get("username") or "max_bot")

    # ponytail: plan gate — MAX bots capped per plan (trial 2, starter 5, pro 20, enterprise ∞)
    from app.quota import get_subscription_plan
    plan = await get_subscription_plan(str(current_user.tenant_id))
    max_allowed = {"trial": 2, "starter": 5, "pro": 20}.get(plan, 10**9)
    existing = await db.execute(
        select(AccountPool).where(
            AccountPool.tenant_id == current_user.tenant_id,
            AccountPool.platform == "max",
        )
    )
    if len(existing.scalars().all()) >= max_allowed:
        raise HTTPException(403, f"MAX bot limit reached ({max_allowed}) for {plan} plan")

    # ponytail: webhook secret generated server-side at connect, stored as hash.
    # Returned once — operator registers it with MAX via /subscribe.
    webhook_secret = secrets.token_urlsafe(32)
    account = AccountPool(
        tenant_id=current_user.tenant_id,
        platform="max",
        account_identifier=bot_name,
        session_data="max_token",  # placeholder, real token in account_sessions
        device_fingerprint={"bot_name": bot_name,
                            "webhook_secret_sha": hashlib.sha256(webhook_secret.encode()).hexdigest()},
        status="warming_up",
    )
    # get_db dependency injected below via Depends; session bound here
    result = await _store_account(db, current_user, account, body.bot_token)
    result["webhook_secret"] = webhook_secret
    return result


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
            AccountPool.id == _parse_uuid(account_id),
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
            AccountPool.id == _parse_uuid(account_id),
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
    if resp.status_code == 200 and account.status != "active":
        # ponytail: bots have no warmup pipeline — first good check activates
        account.status = "active"
        await db.commit()
    return {"connected": resp.status_code == 200}


def _parse_uuid(value: str) -> _uuid.UUID:
    # ponytail: malformed UUIDs are 404s, not 500s
    try:
        return _uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        from fastapi import HTTPException as _HE
        raise _HE(404, "MAX account not found")


class MaxSubscribeRequest(BaseModel):
    url: str = Field(..., min_length=12, max_length=500)
    # Optional override; default is the server-generated secret from /connect.
    secret: str | None = Field(default=None, min_length=32, max_length=256)


def _validate_webhook_url(url: str) -> None:
    # ponytail: https + public host only. Server never fetches this URL today,
    # but stored junk becomes SSRF the day anything does.
    import ipaddress
    from urllib.parse import urlparse
    try:
        parts = urlparse(url)
        if parts.scheme != "https" or not parts.hostname:
            raise ValueError("need https + hostname")
        try:
            is_private = ipaddress.ip_address(parts.hostname).is_private
        except ValueError:
            is_private = False  # hostname, not IP — fine
        if is_private or parts.hostname == "localhost":
            raise ValueError("need public host")
    except ValueError:
        raise HTTPException(400, "Webhook URL must be a public https URL")


@router.post("/subscribe/{account_id}")
async def max_subscribe(
    account_id: str,
    body: MaxSubscribeRequest,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Subscribe webhook URL for bot updates. Secret stored for validation."""
    _validate_webhook_url(body.url)
    result = await db.execute(
        select(AccountPool).where(
            AccountPool.id == _parse_uuid(account_id),
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
    try:
        token = decrypt(row["session_data"])
    except Exception:
        raise HTTPException(400, "Stored token unreadable, reconnect the bot")
    # Secret: explicit override wins, else the operator must supply one
    # (the auto-generated secret from /connect is shown once and not recoverable).
    secret = body.secret
    if not secret:
        raise HTTPException(400, "Pass secret (≥32 chars): the one from /connect response, or a new one")
    async with _max_client(token) as client:
        try:
            resp = await client.post("/subscriptions", json={
                "url": body.url,
                "update_types": ["message_created", "bot_started"],
                "secret": secret,
            })
        except Exception as e:
            log.warning(f"max subscribe unreachable: {e}")
            raise HTTPException(502, "MAX API unreachable")
    if resp.status_code != 200:
        log.warning(f"max subscribe failed: {resp.status_code} {resp.text[:200]}")
        raise HTTPException(502, "MAX subscribe failed")
    fp = dict(account.device_fingerprint or {})
    fp.pop("webhook_secret", None)  # ponytail: hash-only, never plaintext
    fp["webhook_secret_sha"] = hashlib.sha256(secret.encode()).hexdigest()
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
        select(AccountPool).where(AccountPool.id == _parse_uuid(account_id))
    )
    account = result.scalar_one_or_none()
    if not account or account.platform != "max":
        raise HTTPException(404, "Unknown bot")
    # ponytail: closed by default — no stored secret means no access, never open
    fp = account.device_fingerprint or {}
    stored_hash = fp.get("webhook_secret_sha", "")
    provided = x_max_bot_api_secret or ""
    authed = bool(stored_hash) and hmac.compare_digest(
        hashlib.sha256(provided.encode()).hexdigest(), stored_hash)
    if not authed:
        # legacy plaintext rows (pre-hash era): accept once, still require match
        legacy = fp.get("webhook_secret", "")
        if not legacy or not hmac.compare_digest(provided, legacy):
            raise HTTPException(403, "Invalid webhook secret")

    update_type = update.get("update_type", "") if isinstance(update, dict) else ""
    if update_type not in ("message_created", "bot_started"):
        return {"ignored": update_type if isinstance(update_type, str) else "malformed"}

    msg = update.get("message")
    if not isinstance(msg, dict):
        return {"ignored": "malformed"}
    sender = msg.get("sender") or update.get("user")
    if not isinstance(sender, dict):
        sender = {}
    user_id = str(sender.get("user_id") or msg.get("sender_id") or "")
    if not user_id or user_id == "unknown":
        # ponytail: a lead without an identity can't be replied to — skip, don't store junk
        return {"ignored": "no_user"}
    raw_text = msg.get("text")
    text = (raw_text if isinstance(raw_text, str) else "")[:2000]
    chat = msg.get("chat")
    chat_id = str(chat.get("chat_id") or "") if isinstance(chat, dict) else ""
    message_id = msg.get("message_id") or msg.get("id")
    message_id = str(message_id)[:255] if message_id else None

    # ponytail: idempotency — MAX retries deliveries; same message must not clone leads
    if message_id:
        dup = await db.execute(
            select(Lead.id).where(
                Lead.account_id == account.id,
                Lead.post_id == message_id,
            )
        )
        existing_id = dup.scalar_one_or_none()
        if existing_id:
            return {"lead_id": str(existing_id), "deduped": True}

    # ponytail: classify through the shared heuristic (no LLM spend without tenant keys),
    # so MAX leads can trigger HOT/WARM flows like every other platform.
    try:
        from app.llm_classifier import classify_message
        intent_raw = (await classify_message(text)).get("intent_score", "COLD")
        intent = LeadIntentLevel(intent_raw) if intent_raw in ("HOT", "WARM", "COLD") else LeadIntentLevel.COLD
    except Exception:
        intent = LeadIntentLevel.COLD

    lead = Lead(
        tenant_id=account.tenant_id,
        platform=PlatformType.max,
        account_id=account.id,
        user_handle=f"max_{user_id}"[:255],
        user_full_name=str(sender.get("name") or "")[:255],
        message_text=text,
        intent_score=intent,
        status=LeadStatus.new,
        source="max_chat" if chat_id else "max_dm",
        post_id=message_id,
        dialog_url="",
    )
    db.add(lead)
    await db.commit()
    return {"lead_id": str(lead.id)}
