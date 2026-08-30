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
    limit: int = Query(default=settings.DEFAULT_PAGE_SIZE, le=settings.MAX_PAGE_SIZE),
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
    # Strip session_data from list response (sensitive)
    for a in accounts:
        a.session_data = None
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
    account.session_data = None  # Never expose session in API
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
    account.session_data = None  # Never expose session in API
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
        sent_code = await client.send_code_request(body.phone)
        await client.disconnect()

        # Store phone_code_hash in Redis for confirm step (expires in 5 min)
        import redis, json
        r = redis.Redis.from_url(settings.REDIS_URL.replace("rediss://", "redis://"))
        r.setex(f"tg_code:{account_id}", 300, json.dumps({
            "phone": body.phone,
            "phone_code_hash": sent_code.phone_code_hash,
        }))

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

        # Retrieve phone_code_hash from Redis
        import redis as _redis, json as _json
        r = _redis.Redis.from_url(settings.REDIS_URL.replace("rediss://", "redis://"))
        raw = r.get(f"tg_code:{account_id}")
        if not raw:
            raise HTTPException(400, "Code expired. Please request a new code via /connect.")
        stored = _json.loads(raw)
        phone_code_hash = stored["phone_code_hash"]

        client = TelegramClient(StringSession(), api_id, api_hash)
        await client.connect()
        await client.sign_in(body.phone, code=body.code, phone_code_hash=phone_code_hash)

        session_string = await client.export_session_string()
        await client.disconnect()
        r.delete(f"tg_code:{account_id}")

        # Save session to DB (account_sessions table)
        import uuid as _uuid
        conn_url = settings.DATABASE_URL.replace("+asyncpg", "")
        import asyncpg
        conn = await asyncpg.connect(conn_url)
        try:
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
        except Exception as db_err:
            log.error(f"Failed to save session for {account_id}: {db_err}")
            raise HTTPException(500, f"Session authorized but save failed: {db_err}. Please reconnect.")
        finally:
            await conn.close()

        # Update account status — warming_up if first connect, active if reconnect
        if not account.status or account.status == "warming_up":
            account.status = "warming_up"
        else:
            account.status = "active"
        account.warmup_stage = account.warmup_stage or 1
        await db.commit()

        # Auto-dispatch listener + first warmup cycle via Celery
        try:
            from app.celery_app import celery
            celery.send_task(
                "app.tasks.listener.start_lead_listener",
                args=[str(current_user.tenant_id), account_id],
                queue="listener",
            )
            celery.send_task(
                "app.tasks.warmup.run_warmup_cycle",
                args=[str(current_user.tenant_id), str(account_id)],
                queue="warmup",
            )
            # Set tg_status in Redis so dashboard shows online
            import redis as _r2
            r2 = _r2.Redis.from_url(settings.REDIS_URL.replace("rediss://", "redis://"))
            import time as _t
            r2.setex(
                f"tg_status:{account_id}", 300,
                _json.dumps({"status": "online", "platform": "telegram", "updated_at": _t.time()}),
            )
            log.info(f"Auto-dispatched listener + warmup for account {account_id}")
        except Exception as dispatch_err:
            log.warning(f"Failed to auto-dispatch tasks: {dispatch_err}")

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


# ── VKontakte Connection ───────────────────────────────────────────────

class VKConnectRequest(BaseModel):
    group_token: str  # VK community token
    group_id: int     # VK community ID


@router.post("/{account_id}/connect-vk")
async def connect_vk(
    account_id: UUID,
    body: VKConnectRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Connect VKontakte community via group token."""
    result = await db.execute(
        select(AccountPool).where(
            AccountPool.id == account_id,
            AccountPool.tenant_id == current_user.tenant_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")
    if account.platform != "vkontakte":
        raise HTTPException(400, "Account platform must be 'vkontakte'")

    # Store group token encrypted in session_data
    import uuid as _uuid
    import asyncpg
    from app.crypto import encrypt as enc
    conn_url = settings.DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(conn_url)
    try:
        encrypted = enc(body.group_token)
        existing = await conn.fetchrow(
            "SELECT id FROM account_sessions WHERE account_id = $1",
            _uuid.UUID(str(account_id)),
        )
        if existing:
            await conn.execute(
                "UPDATE account_sessions SET session_data = $1, updated_at = NOW() WHERE account_id = $2",
                encrypted, _uuid.UUID(str(account_id)),
            )
        else:
            await conn.execute(
                """INSERT INTO account_sessions (id, account_id, session_data, created_at, updated_at)
                   VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())""",
                _uuid.UUID(str(account_id)), encrypted,
            )
        # Also store group_id as meta
        await conn.execute(
            "UPDATE account_sessions SET updated_at = NOW() WHERE account_id = $1",
            _uuid.UUID(str(account_id)),
        )
    finally:
        await conn.close()

    account.status = "active"
    await db.commit()

    log.info(f"VK connected for account {account_id}, group={body.group_id}")
    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="connected_vk", entity_type="account",
        entity_id=str(account_id),
        new_value={"group_id": body.group_id},
        user_id=current_user.id, ip_address=request.client.host if request else None,
    )
    return {"status": "connected", "account_id": str(account_id), "platform": "vkontakte"}
