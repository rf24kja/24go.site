"""Account Pool CRUD + Telegram connection endpoints."""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.audit import log_event
from app.crypto import encrypt, decrypt
from app.database import get_db
from app.models import AccountPool, User
from app.security import get_current_user
from app.schemas import AccountCreate, AccountResponse

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])
log = logging.getLogger(__name__)

# ── Telegram connection request models ────────────────────────────────────

class ConnectPhoneRequest(BaseModel):
    phone: str  # e.g. "+66987654321"

class ConfirmCodeRequest(BaseModel):
    phone: str
    code: str  # Telegram verification code


@router.get("/")
async def list_accounts(
    status_filter: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(AccountPool).where(AccountPool.tenant_id == current_user.tenant_id)
    if status_filter:
        q = q.where(AccountPool.status == status_filter)
    
    from sqlalchemy import func
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    
    result = await db.execute(q.order_by(AccountPool.created_at.desc()).limit(limit).offset(offset))
    accounts = result.scalars().all()
    for a in accounts:
        a.session_data = decrypt(a.session_data)
    return {"items": accounts, "total": total, "limit": limit, "offset": offset}


@router.post("/", response_model=AccountResponse, status_code=201)
async def create_account(
    body: AccountCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = AccountPool(
        tenant_id=current_user.tenant_id,
        platform=body.platform,
        account_identifier=body.account_identifier,
        session_data=encrypt(body.session_data),
        device_fingerprint=body.device_fingerprint,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    account.session_data = decrypt(account.session_data)
    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="created", entity_type="account",
        entity_id=account.id, new_value={"account_identifier": body.account_identifier, "platform": body.platform},
        user_id=current_user.id, ip_address=request.client.host if request else None,
    )
    return account


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AccountPool).where(
            AccountPool.id == account_id,
            AccountPool.tenant_id == current_user.tenant_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    account.session_data = decrypt(account.session_data)
    return account


# ── Telegram Account Connection ───────────────────────────────────────────

@router.post("/{account_id}/connect")
async def connect_telegram(
    account_id: UUID,
    body: ConnectPhoneRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Initiate Telegram authorization — sends verification code to phone.

    Returns: { status: "code_sent", account_id }
    After receiving the code, call POST /accounts/{id}/confirm.
    """
    result = await db.execute(
        select(AccountPool).where(
            AccountPool.id == account_id,
            AccountPool.tenant_id == current_user.tenant_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")

    import os
    api_id = int(os.getenv("TG_API_ID", "0"))
    api_hash = os.getenv("TG_API_HASH", "")
    if not api_id or not api_hash:
        raise HTTPException(500, "Telegram API credentials not configured on server")

    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession

        client = TelegramClient(StringSession(), api_id, api_hash)
        await client.connect()
        await client.send_code_request(body.phone)
        # Disconnect but don't destroy — we'll reconnect in confirm step
        await client.disconnect()

        log.info(f"Code request sent to {body.phone} for account {account_id}")
        await log_event(
            url=settings.DATABASE_URL.replace("+asyncpg", ""),
            tenant_id=current_user.tenant_id, action="connected", entity_type="account",
            entity_id=str(account_id),
            new_value={"phone": body.phone},
            user_id=current_user.id, ip_address=request.client.host if request else None,
        )
        return {"status": "code_sent", "account_id": str(account_id)}
    except Exception as e:
        log.error(f"connect_telegram failed: {e}")
        raise HTTPException(502, f"Telegram connection failed: {str(e)[:200]}")


@router.post("/{account_id}/confirm")
async def confirm_telegram(
    account_id: UUID,
    body: ConfirmCodeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Complete Telegram authorization with verification code.

    Saves encrypted session to DB. Account becomes ready for listener/poster.
    """
    result = await db.execute(
        select(AccountPool).where(
            AccountPool.id == account_id,
            AccountPool.tenant_id == current_user.tenant_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")

    import os
    api_id = int(os.getenv("TG_API_ID", "0"))
    api_hash = os.getenv("TG_API_HASH", "")
    if not api_id or not api_hash:
        raise HTTPException(500, "Telegram API credentials not configured")

    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession

        client = TelegramClient(StringSession(), api_id, api_hash)
        await client.connect()
        await client.sign_in(body.phone, body.code)

        session_string = await client.export_session_string()
        await client.disconnect()

        # Save session to DB (account_sessions table)
        import uuid as _uuid
        conn_url = settings.DATABASE_URL.replace("+asyncpg", "")
        import asyncpg
        conn = await asyncpg.connect(conn_url)
        try:
            # Upsert into account_sessions
            from app.crypto import encrypt as enc
            encrypted_session = enc(session_string)
            existing = await conn.fetchrow(
                "SELECT id FROM account_sessions WHERE account_id = $1",
                _uuid.UUID(str(account_id)),
            )
            if existing:
                await conn.execute(
                    "UPDATE account_sessions SET session_data = $1, updated_at = NOW() WHERE account_id = $2",
                    encrypted_session, _uuid.UUID(str(account_id)),
                )
            else:
                await conn.execute(
                    """INSERT INTO account_sessions (id, account_id, session_data, created_at, updated_at)
                       VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())""",
                    _uuid.UUID(str(account_id)), encrypted_session,
                )
        finally:
            await conn.close()

        # Update account status to active
        account.status = "active"
        await db.commit()

        log.info(f"Telegram authorized for account {account_id}")
        await log_event(
            url=settings.DATABASE_URL.replace("+asyncpg", ""),
            tenant_id=current_user.tenant_id, action="confirmed", entity_type="account",
            entity_id=str(account_id), user_id=current_user.id,
            ip_address=request.client.host if request else None,
        )
        return {"status": "connected", "account_id": str(account_id)}
    except Exception as e:
        log.error(f"confirm_telegram failed: {e}")
        raise HTTPException(502, f"Authorization failed: {str(e)[:200]}")


@router.post("/{account_id}/disconnect")
async def disconnect_telegram(
    account_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disconnect Telegram client and delete session."""
    result = await db.execute(
        select(AccountPool).where(
            AccountPool.id == account_id,
            AccountPool.tenant_id == current_user.tenant_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")

    # Stop listener if running
    from app.celery_app import celery
    celery.control.revoke(f"listener-{account_id}", terminate=True, signal="SIGTERM")

    # Delete session from DB
    import uuid as _uuid
    import asyncpg
    conn = await asyncpg.connect(settings.DATABASE_URL.replace("+asyncpg", ""))
    try:
        await conn.execute(
            "DELETE FROM account_sessions WHERE account_id = $1",
            _uuid.UUID(str(account_id)),
        )
    finally:
        await conn.close()

    account.status = "paused"
    await db.commit()

    log.info(f"Telegram disconnected for account {account_id}")
    return {"status": "disconnected", "account_id": str(account_id)}


@router.get("/{account_id}/tg-status")
async def telegram_status(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get Telegram connection status for an account.

    Returns: { connected: bool, status: str, has_session: bool }
    """
    result = await db.execute(
        select(AccountPool).where(
            AccountPool.id == account_id,
            AccountPool.tenant_id == current_user.tenant_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")

    # Check if session exists in DB
    import uuid as _uuid
    import asyncpg
    conn = await asyncpg.connect(settings.DATABASE_URL.replace("+asyncpg", ""))
    try:
        row = await conn.fetchrow(
            "SELECT id FROM account_sessions WHERE account_id = $1",
            _uuid.UUID(str(account_id)),
        )
        has_session = row is not None
    finally:
        await conn.close()

    # Check Redis status
    import redis
    import json
    r = redis.Redis.from_url(
        settings.REDIS_URL.replace("rediss://", "redis://"),
        decode_responses=True,
    )
    raw = r.get(f"tg_status:{account_id}")
    tg_status = json.loads(raw) if raw else {"status": "unknown"}

    return {
        "account_id": str(account_id),
        "has_session": has_session,
        "connected": tg_status.get("status") == "online",
        "tg_status": tg_status.get("status", "unknown"),
        "updated_at": tg_status.get("updated_at", 0),
    }
