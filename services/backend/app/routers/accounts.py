"""Account Pool CRUD + Telegram connection endpoints."""
import logging
import re
import json as _json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import asyncpg
from app.config import settings
from app.audit import log_event
from app.crypto import encrypt, decrypt
from app.database import get_db
from app.models import AccountPool, User
from app.quota import PLAN_LIMITS, get_subscription_plan
from app.security import get_current_user
from app.schemas import AccountCreate, AccountResponse

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])
log = logging.getLogger(__name__)


# ── Proxy helpers ────────────────────────────────────────────────────

async def _resolve_proxy_for_account(account_id: UUID) -> tuple | None:
    """Look up proxy for account from DB. Returns Telethon proxy tuple or None."""
    try:
        import os
        from urllib.parse import urlparse
        db_url = settings.DATABASE_URL.replace("+asyncpg", "")
        conn = await asyncpg.connect(db_url)
        try:
            row = await conn.fetchrow(
                """SELECT p.proxy_url FROM account_pool a
                   JOIN proxies p ON a.proxy_id = p.id
                   WHERE a.id = $1 AND p.is_active = true""",
                account_id,
            )
            if not row:
                return None
            return _parse_proxy(row["proxy_url"])
        finally:
            await conn.close()
    except Exception as e:
        log.warning(f"Proxy lookup failed for {account_id}: {e}")
        return None


def _parse_proxy(url: str) -> tuple | None:
    """Parse socks5://user:pass@host:port into Telethon proxy tuple."""
    if not url:
        return None
    try:
        import socks
        parsed = urlparse(url)
        scheme = parsed.scheme.lower()
        host = parsed.hostname
        port = parsed.port or 1080
        username = parsed.username or None
        password = parsed.password or None
        rdns = True
        if scheme == "socks5":
            return (socks.SOCKS5, host, port, rdns, username, password)
        elif scheme == "socks4":
            return (socks.SOCKS4, host, port, username, password)
        elif scheme in ("http", "https"):
            return (socks.HTTP, host, port, rdns, username, password)
        return None
    except ImportError:
        log.error("pysocks not installed — cannot use proxies")
        return None
    except Exception as e:
        log.error(f"Failed to parse proxy URL: {e}")
        return None


def _mask_phone(phone: str) -> str:
    """Mask phone for logs: +66987654321 → +669****4321."""
    if not phone or len(phone) < 6:
        return "****"
    return phone[:4] + "*" * (len(phone) - 8) + phone[-4:]

# ── Telegram connection request models ────────────────────────────────────

class ConnectPhoneRequest(BaseModel):
    phone: str  # e.g. "+66987654321"

class ConfirmCodeRequest(BaseModel):
    phone: str
    code: str  # Telegram verification code

class ConfirmPasswordRequest(BaseModel):
    password: str  # 2FA cloud password


# ── Bulk Account Operations ─────────────────────────────────────────────

class BulkCreateRequest(BaseModel):
    accounts: list[dict]

class BulkConnectRequest(BaseModel):
    account_ids: list[str]


@router.post("/bulk", status_code=201)
async def bulk_create_accounts(
    body: BulkCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk create accounts. Max 50 per request."""
    if len(body.accounts) > 50:
        raise HTTPException(400, "Max 50 accounts per request")

    # Check account limit
    plan = await get_subscription_plan(str(current_user.tenant_id))
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])
    from sqlalchemy import func as _func
    count = (await db.execute(
        _func.count()).select_from(
        select(AccountPool).where(AccountPool.tenant_id == current_user.tenant_id).subquery()
    )).scalar() or 0
    # Account limit removed — users can add unlimited accounts

    created = 0
    errors: list[str] = []

    # Fetch existing identifiers for dedup
    existing_result = await db.execute(
        select(AccountPool.account_identifier).where(
            AccountPool.tenant_id == current_user.tenant_id
        )
    )
    existing_ids = {row[0] for row in existing_result.all()}

    for i, acct in enumerate(body.accounts):
        platform = acct.get("platform", "")
        identifier = acct.get("account_identifier", "").strip()

        if platform not in ("telegram", "vkontakte"):
            errors.append(f"[{i}] Invalid platform: {platform}")
            continue
        if not identifier:
            errors.append(f"[{i}] Empty account_identifier")
            continue
        if identifier in existing_ids:
            errors.append(f"[{i}] Duplicate: {identifier}")
            continue

        account = AccountPool(
            tenant_id=current_user.tenant_id,
            platform=platform,
            account_identifier=identifier,
            session_data="",  # populated on connect
            device_fingerprint={},  # populated on connect
        )
        db.add(account)
        existing_ids.add(identifier)
        created += 1

    if created:
        await db.commit()

    return {"created": created, "errors": errors}


@router.post("/bulk-import")
async def bulk_import_accounts(
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import Telegram accounts from .json + .session file pairs.

    Matches files by prefix (e.g. +66920004002.json + +66920004002.session).
    For each pair: stores encrypted session, creates AccountPool record,
    dispatches async validation task.
    """
    # Check account limit
    plan = await get_subscription_plan(str(current_user.tenant_id))
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])
    from sqlalchemy import func as _func
    count = (await db.execute(
        _func.count()).select_from(
        select(AccountPool).where(AccountPool.tenant_id == current_user.tenant_id).subquery()
    )).scalar() or 0

    # Separate json and session files
    json_files: dict[str, UploadFile] = {}
    session_files: dict[str, UploadFile] = {}

    for f in files:
        name = f.filename or ""
        if name.endswith(".json"):
            prefix = name[:-5]  # strip .json
            json_files[prefix] = f
        elif name.endswith(".session"):
            prefix = name[:-8]  # strip .session
            session_files[prefix] = f

    # Match pairs by prefix
    matched_prefixes = set(json_files.keys()) & set(session_files.keys())

    results = []
    imported = 0
    failed = 0

    for prefix in sorted(matched_prefixes):
        # Account limit removed — users can add unlimited accounts

        try:
            # Read .json config
            json_content = await json_files[prefix].read()
            config = _json.loads(json_content)
            phone = config.get("phone", "")
            api_id = config.get("api_id")
            api_hash = config.get("api_hash", "")

            if not phone:
                raise ValueError("Missing 'phone' in JSON config")
            if not api_id or not api_hash:
                raise ValueError("Missing 'api_id' or 'api_hash' in JSON config")

            # Read .session file (binary) and base64-encode for storage
            import base64
            session_bytes = await session_files[prefix].read()
            session_string = base64.b64encode(session_bytes).decode()

            # Encrypt and store session
            encrypted_session = encrypt(session_string)
            account = AccountPool(
                tenant_id=current_user.tenant_id,
                platform="telegram",
                account_identifier=phone,
                session_data=encrypted_session,
                device_fingerprint={"api_id": api_id, "api_hash": api_hash},
                status="warming_up",
            )
            db.add(account)
            await db.flush()  # get the ID

            # Insert session into account_sessions table
            import uuid as _uuid
            conn_url = settings.DATABASE_URL.replace("+asyncpg", "")
            conn = await asyncpg.connect(conn_url)
            try:
                await conn.execute(
                    """INSERT INTO account_sessions (id, account_id, session_data, created_at, updated_at)
                       VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())""",
                    _uuid.UUID(str(account.id)), encrypted_session,
                )
            finally:
                await conn.close()

            # Dispatch validation task
            try:
                from app.celery_app import celery
                celery.send_task(
                    "app.tasks.account_validator.validate_imported_account",
                    args=[str(current_user.tenant_id), str(account.id)],
                    queue="warmup",
                )
            except Exception as dispatch_err:
                log.warning(f"Failed to dispatch validator for {account.id}: {dispatch_err}")

            imported += 1
            results.append({
                "id": str(account.id),
                "identifier": phone,
                "status": "warming_up",
                "error": None,
            })

        except Exception as e:
            failed += 1
            results.append({
                "identifier": prefix,
                "status": "failed",
                "error": str(e)[:200],
            })
            log.error(f"bulk_import failed for {prefix}: {e}")

    if imported:
        await db.commit()

    return {"imported": imported, "failed": failed, "accounts": results}


# ── VK Bulk Import ──────────────────────────────────────────────────

class VKBulkImportRequest(BaseModel):
    accounts: list[dict]  # [{"group_id": 123, "token": "..."}]


@router.post("/bulk-import-vk")
async def bulk_import_vk_accounts(
    body: VKBulkImportRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import VK community accounts in bulk.

    Validates each token via VK API, creates AccountPool + account_sessions.
    """
    if len(body.accounts) > 50:
        raise HTTPException(400, "Max 50 accounts per import request")

    results = []
    imported = 0
    failed = 0

    for i, acc in enumerate(body.accounts):
        group_id = acc.get("group_id")
        token = acc.get("token", "")

        if not group_id or not token:
            failed += 1
            results.append({"identifier": str(group_id or i), "status": "failed", "error": "Missing group_id or token"})
            continue

        try:
            # Validate token via VK API
            import vk_api
            session = vk_api.VkApi(token=token, api_version="5.199")
            vk = session.get_api()
            groups = vk.groups.getById()
            if not groups:
                raise ValueError("Token does not belong to any community")
            g = groups[0]
            if g["id"] != int(group_id):
                raise ValueError(f"Token belongs to {g['id']}, not {group_id}")

            # Create AccountPool entry
            account = AccountPool(
                tenant_id=current_user.tenant_id,
                platform="vkontakte",
                account_identifier=str(group_id),
                session_data="vk_token",  # placeholder, real token in account_sessions
                device_fingerprint={"group_name": g["name"], "members_count": g.get("members_count", 0)},
                status="warming_up",
            )
            db.add(account)
            await db.flush()

            # Store encrypted token in account_sessions
            import uuid as _uuid
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

            imported += 1
            results.append({
                "id": str(account.id),
                "identifier": f"vk_{group_id}",
                "group_name": g["name"],
                "members_count": g.get("members_count", 0),
                "status": "warming_up",
                "error": None,
            })

        except Exception as e:
            failed += 1
            results.append({"identifier": str(group_id or i), "status": "failed", "error": str(e)[:200]})

    if imported:
        await db.commit()

    return {"imported": imported, "failed": failed, "accounts": results}


@router.post("/connect-all")
async def bulk_connect_accounts(
    body: BulkConnectRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk send connection codes. Max 10 per request. 2s delay between sends."""
    if len(body.account_ids) > 10:
        raise HTTPException(400, "Max 10 accounts per connect-all request")

    import asyncio

    sent = 0
    failed: list[str] = []

    for account_id_str in body.account_ids:
        try:
            account_id = UUID(account_id_str)
        except ValueError:
            failed.append(f"{account_id_str}: invalid UUID")
            continue

        result = await db.execute(
            select(AccountPool).where(
                AccountPool.id == account_id,
                AccountPool.tenant_id == current_user.tenant_id,
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            failed.append(f"{account_id_str}: not found")
            continue

        import os
        api_id = int(os.getenv("TG_API_ID", "0"))
        api_hash = os.getenv("TG_API_HASH", "")
        if not api_id or not api_hash:
            failed.append(f"{account_id_str}: TG API not configured")
            continue

        try:
            from telethon import TelegramClient
            from telethon.sessions import StringSession

            proxy = await _resolve_proxy_for_account(account_id)
            client = TelegramClient(StringSession(), api_id, api_hash, proxy=proxy)
            await client.connect()
            sent_code = await client.send_code_request(account.account_identifier)
            session_string = client.session.save()
            await client.disconnect()

            import redis, json as _json
            r = redis.Redis.from_url(settings.REDIS_URL.replace("rediss://", "redis://"))
            r.setex(f"tg_code:{account_id}", 600, _json.dumps({
                "phone": account.account_identifier,
                "phone_code_hash": str(sent_code.phone_code_hash),
                "session_string": session_string,
            }))
            sent += 1
            log.info(f"bulk_connect: code sent to {_mask_phone(account.account_identifier)} for {account_id}")

        except Exception as e:
            log.error(f"bulk_connect failed for {account_id}: {e}")
            failed.append(f"{account_id_str}: {str(e)[:100]}")

        # 2-second delay between requests
        if body.account_ids.index(account_id_str) < len(body.account_ids) - 1:
            await asyncio.sleep(2)

    return {"sent": sent, "failed": failed}


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
    # Check account limit
    plan = await get_subscription_plan(str(current_user.tenant_id))
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])
    from sqlalchemy import func as _func
    count = (await db.execute(
        _func.count()).select_from(
        select(AccountPool).where(AccountPool.tenant_id == current_user.tenant_id).subquery()
    )).scalar() or 0
    # Account limit removed — users can add unlimited accounts

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
    conn_url = settings.DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(conn_url)
    try:
        await log_event(
            tenant_id=current_user.tenant_id, action="created", entity_type="account",
            entity_id=account.id, new_value={"account_identifier": body.account_identifier, "platform": body.platform},
            user_id=current_user.id, ip_address=request.client.host if request else None,
            conn=conn,
        )
    finally:
        await conn.close()
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

        # Resolve proxy for this account
        proxy = await _resolve_proxy_for_account(account_id)

        # Create client, send code request, and save SESSION STATE (not just hash)
        # This keeps the same DC connection for the confirm step
        client = TelegramClient(StringSession(), api_id, api_hash, proxy=proxy)
        await client.connect()
        sent_code = await client.send_code_request(body.phone)

        # Export session state BEFORE disconnecting (preserves DC + auth_key)
        session_string = client.session.save()
        await client.disconnect()

        log.info(f"connect_telegram: phone={_mask_phone(body.phone)} has_hash=True")

        # Store BOTH session string and phone_code_hash in Redis
        import redis, json
        r = redis.Redis.from_url(settings.REDIS_URL.replace("rediss://", "redis://"))
        r.setex(f"tg_code:{account_id}", 600, json.dumps({
            "phone": body.phone,
            "phone_code_hash": str(sent_code.phone_code_hash),
            "session_string": session_string,
        }))

        log.info(f"Code request sent to {_mask_phone(body.phone)} for account {account_id}")
        conn_url = settings.DATABASE_URL.replace("+asyncpg", "")
        conn = await asyncpg.connect(conn_url)
        try:
            await log_event(
                tenant_id=current_user.tenant_id, action="connected", entity_type="account",
                entity_id=str(account_id),
                new_value={"phone": body.phone},
                user_id=current_user.id, ip_address=request.client.host if request else None,
                conn=conn,
            )
        finally:
            await conn.close()
        return {"status": "code_sent", "account_id": str(account_id)}
    except Exception as e:
        log.error(f"connect_telegram failed: {e}")
        raise HTTPException(502, "Telegram connection failed — check account credentials")


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
        from telethon.errors import SessionPasswordNeededError, PhoneCodeInvalidError, PhoneCodeExpiredError

        # Retrieve phone_code_hash from Redis
        import redis as _redis, json as _json
        r = _redis.Redis.from_url(settings.REDIS_URL.replace("rediss://", "redis://"))
        raw = r.get(f"tg_code:{account_id}")
        if not raw:
            raise HTTPException(400, "Code expired. Please request a new code via /connect.")
        stored = _json.loads(raw)
        phone_code_hash = stored["phone_code_hash"]
        session_string = stored.get("session_string", "")
        stored_phone = stored.get("phone", "unknown")

        log.info(f"confirm_telegram: account={account_id} stored_phone={_mask_phone(stored_phone)} submitted_phone={_mask_phone(body.phone)} has_hash=True has_session={bool(session_string)}")

        # Resolve proxy for this account
        proxy = await _resolve_proxy_for_account(account_id)

        # Reuse session from connect step to keep same DC connection
        if session_string:
            client = TelegramClient(StringSession(session_string), api_id, api_hash, proxy=proxy)
        else:
            client = TelegramClient(StringSession(), api_id, api_hash, proxy=proxy)
        await client.connect()
        log.info(f"confirm_telegram: calling sign_in for {_mask_phone(body.phone)}")

        try:
            await client.sign_in(stored_phone, code=body.code, phone_code_hash=phone_code_hash)
        except SessionPasswordNeededError:
            # 2FA is enabled — save session state to Redis, ask frontend for password
            pending_session = client.session.save()
            r.setex(f"tg_2fa:{account_id}", 600, _json.dumps({
                "phone": body.phone,
                "session_string": pending_session,
            }))
            await client.disconnect()
            log.info(f"confirm_telegram: 2FA required for account {account_id}, awaiting password")
            return {"status": "password_required", "account_id": str(account_id)}
        except PhoneCodeInvalidError:
            await client.disconnect()
            raise HTTPException(400, "Invalid code. Please check and try again.")
        except PhoneCodeExpiredError:
            await client.disconnect()
            raise HTTPException(400, "Code expired. Click 'Resend Code' to get a new one.")

        session_string = client.session.save()
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
            # tg_status will be set by the Celery worker after successful connection
            log.info(f"Auto-dispatched listener + warmup for account {account_id}")
        except Exception as dispatch_err:
            log.warning(f"Failed to auto-dispatch tasks: {dispatch_err}")

        log.info(f"Telegram authorized for account {account_id}")
        conn_url = settings.DATABASE_URL.replace("+asyncpg", "")
        conn = await asyncpg.connect(conn_url)
        try:
            await log_event(
                tenant_id=current_user.tenant_id, action="confirmed", entity_type="account",
                entity_id=str(account_id), user_id=current_user.id,
                ip_address=request.client.host if request else None,
                conn=conn,
            )
        finally:
            await conn.close()
        return {"status": "connected", "account_id": str(account_id)}
    except Exception as e:
        log.error(f"confirm_telegram failed: {e}")
        raise HTTPException(502, "Authorization failed — invalid confirmation code")


@router.post("/{account_id}/confirm-password")
async def confirm_password(
    account_id: UUID,
    body: ConfirmPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Complete 2FA: submit cloud password after code was accepted."""
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

        import redis as _redis, json as _json
        r = _redis.Redis.from_url(settings.REDIS_URL.replace("rediss://", "redis://"))
        raw = r.get(f"tg_2fa:{account_id}")
        if not raw:
            raise HTTPException(400, "2FA session expired. Please start over from Connect.")

        stored = _json.loads(raw)
        pending_session = stored["session_string"]
        phone = stored["phone"]

        proxy = await _resolve_proxy_for_account(account_id)
        client = TelegramClient(StringSession(pending_session), api_id, api_hash, proxy=proxy)
        await client.connect()
        await client.sign_in(password=body.password)

        session_string = client.session.save()
        await client.disconnect()
        r.delete(f"tg_2fa:{account_id}")
        r.delete(f"tg_code:{account_id}")

        # Save session to DB (same as confirm_telegram)
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
            raise HTTPException(500, f"Session authorized but save failed: {db_err}")
        finally:
            await conn.close()

        if not account.status or account.status == "warming_up":
            account.status = "warming_up"
        else:
            account.status = "active"
        account.warmup_stage = account.warmup_stage or 1
        await db.commit()

        # Auto-dispatch listener + warmup
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
            import redis as _r2
            r2 = _r2.Redis.from_url(settings.REDIS_URL.replace("rediss://", "redis://"))
            import time as _t
            r2.setex(
                f"tg_status:{account_id}", 300,
                _json.dumps({"status": "online", "platform": "telegram", "updated_at": _t.time()}),
            )
            log.info(f"Auto-dispatched listener + warmup for account {account_id} (via 2FA)")
        except Exception as dispatch_err:
            log.warning(f"Failed to auto-dispatch tasks: {dispatch_err}")

        log.info(f"Telegram 2FA authorized for account {account_id}")
        conn_url = settings.DATABASE_URL.replace("+asyncpg", "")
        conn = await asyncpg.connect(conn_url)
        try:
            await log_event(
                tenant_id=current_user.tenant_id, action="confirmed_2fa", entity_type="account",
                entity_id=str(account_id), user_id=current_user.id,
                ip_address=request.client.host if request else None,
                conn=conn,
            )
        finally:
            await conn.close()
        return {"status": "connected", "account_id": str(account_id)}
    except Exception as e:
        log.error(f"confirm_password failed: {e}")
        raise HTTPException(502, "2FA authorization failed — check your authenticator code")


@router.delete("/{account_id}")
async def delete_account(
    account_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete account and all associated data."""
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

    # Delete session and proxy from DB
    import uuid as _uuid
    import asyncpg
    conn = await asyncpg.connect(settings.DATABASE_URL.replace("+asyncpg", ""))
    try:
        await conn.execute(
            "DELETE FROM account_sessions WHERE account_id = $1",
            _uuid.UUID(str(account_id)),
        )
        await conn.execute(
            "DELETE FROM account_proxies WHERE account_id = $1",
            _uuid.UUID(str(account_id)),
        )
    finally:
        await conn.close()

    # Delete account record
    await db.delete(account)
    await db.commit()

    log.info(f"Account {account_id} deleted")
    return {"status": "deleted", "account_id": str(account_id)}


@router.post("/{account_id}/disconnect")
async def disconnect_account(
    account_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disconnect account (Telegram or VK) and delete session."""
    result = await db.execute(
        select(AccountPool).where(
            AccountPool.id == account_id,
            AccountPool.tenant_id == current_user.tenant_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")

    platform = account.platform.value if hasattr(account.platform, 'value') else str(account.platform)

    # Stop listener if running
    from app.celery_app import celery
    celery.control.revoke(f"listener-{account_id}", terminate=True, signal="SIGTERM")

    # Also revoke VK listener by task name
    if platform == "vkontakte":
        import redis as _redis, json as _json
        r = _redis.Redis.from_url(settings.REDIS_URL.replace("rediss://", "redis://"), decode_responses=True)
        vk_task_id = r.get(f"listener_task:{account_id}")
        if vk_task_id:
            celery.control.revoke(vk_task_id, terminate=True, signal="SIGTERM")
            r.delete(f"listener_task:{account_id}")
        # Clear VK status
        r.delete(f"vk_status:{account_id}")

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

    log.info(f"{platform} disconnected for account {account_id}")
    return {"status": "disconnected", "account_id": str(account_id), "platform": platform}


@router.get("/{account_id}/tg-status")
async def telegram_status(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get connection status for an account (Telegram or VK).

    Returns: { connected: bool, status: str, has_session: bool, platform: str }
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

    platform = account.platform.value if hasattr(account.platform, 'value') else str(account.platform)

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

    # Check Redis status — VK uses vk_status, Telegram uses tg_status
    import redis
    import json
    r = redis.Redis.from_url(
        settings.REDIS_URL.replace("rediss://", "redis://"),
        decode_responses=True,
    )
    status_key = f"vk_status:{account_id}" if platform == "vkontakte" else f"tg_status:{account_id}"
    raw = r.get(status_key)
    platform_status = json.loads(raw) if raw else {"status": "unknown"}

    # If Redis has no status but DB has session, consider connected
    connected = platform_status.get("status") == "online" or (has_session and platform_status.get("status") == "unknown")

    return {
        "account_id": str(account_id),
        "platform": platform,
        "has_session": has_session,
        "connected": connected,
        "tg_status": platform_status.get("status", "unknown") if has_session else "no_session",
        "updated_at": platform_status.get("updated_at", 0),
    }


# ── Reconnect Account ───────────────────────────────────────────────────

@router.post("/{account_id}/reconnect")
async def reconnect_account(
    account_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reconnect a paused account — restarts listener task (Telegram or VK)."""
    result = await db.execute(
        select(AccountPool).where(
            AccountPool.id == account_id,
            AccountPool.tenant_id == current_user.tenant_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")

    platform = account.platform.value if hasattr(account.platform, 'value') else str(account.platform)

    # Check session exists
    import uuid as _uuid
    import asyncpg
    conn = await asyncpg.connect(settings.DATABASE_URL.replace("+asyncpg", ""))
    try:
        row = await conn.fetchrow(
            "SELECT id FROM account_sessions WHERE account_id = $1",
            _uuid.UUID(str(account_id)),
        )
        if not row:
            raise HTTPException(400, "No session found — connect first")
    finally:
        await conn.close()

    # Resume status
    if account.status in ("paused", "banned"):
        account.status = "active"
        await db.commit()

    # Start appropriate listener
    from app.celery_app import celery
    celery.control.revoke(f"listener-{account_id}", terminate=True)

    if platform == "vkontakte":
        # VK: dispatch vk_listener with group_id from account_identifier
        from app.tasks.vk_listener import start_vk_listener
        vk_gid = int(account.account_identifier) if account.account_identifier else 0
        task = start_vk_listener.apply_async(
            args=[str(current_user.tenant_id), str(account_id), vk_gid],
        )
        # Set VK status
        import redis as _redis, json as _json
        r = _redis.Redis.from_url(settings.REDIS_URL.replace("rediss://", "redis://"), decode_responses=True)
        r.set(f"vk_status:{account_id}", _json.dumps({"status": "online", "updated_at": time.time()}), ex=300)
    else:
        # Telegram: dispatch listener via Celery
        task = celery.send_task(
            "app.tasks.listener.start_lead_listener",
            args=[str(current_user.tenant_id), str(account_id)],
            queue="listener",
        )
        # Set TG status
        import redis as _redis, json as _json
        r = _redis.Redis.from_url(settings.REDIS_URL.replace("rediss://", "redis://"), decode_responses=True)
        r.set(f"tg_status:{account_id}", _json.dumps({"status": "online", "updated_at": time.time()}), ex=300)

    log.info(f"Account {account_id} reconnected ({platform}, task={task.id})")
    return {"status": "reconnected", "account_id": str(account_id), "platform": platform, "task_id": task.id}


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
    """Connect VKontakte community via group token.

    Validates the token against VK API before storing.
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
    if account.platform != "vkontakte":
        raise HTTPException(400, "Account platform must be 'vkontakte'")

    # Validate token against VK API before storing
    import vk_api
    try:
        session = vk_api.VkApi(token=body.group_token, api_version="5.199")
        vk = session.get_api()
        groups = vk.groups.getById()
        if not groups:
            raise HTTPException(400, "Token does not belong to any VK community")
        g = groups[0]
        # Verify the group_id matches
        if g["id"] != body.group_id:
            raise HTTPException(400, f"Token belongs to community {g['id']} ({g['name']}), not {body.group_id}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Invalid VK token: {str(e)[:200]}")

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
    finally:
        await conn.close()

    account.status = "active"
    await db.commit()

    # Auto-dispatch VK listener
    try:
        from app.tasks.vk_listener import start_vk_listener
        start_vk_listener.apply_async(
            args=[str(current_user.tenant_id), str(account_id), body.group_id],
        )
    except Exception as e:
        log.warning(f"Failed to auto-dispatch VK listener: {e}")

    log.info(f"VK connected for account {account_id}, group={body.group_id} ({g['name']})")
    conn = await asyncpg.connect(conn_url)
    try:
        await log_event(
            tenant_id=current_user.tenant_id, action="connected_vk", entity_type="account",
            entity_id=str(account_id),
            new_value={"group_id": body.group_id, "group_name": g["name"]},
            user_id=current_user.id, ip_address=request.client.host if request else None,
            conn=conn,
        )
    finally:
        await conn.close()
    return {"status": "connected", "account_id": str(account_id), "platform": "vkontakte",
            "group_name": g["name"], "members_count": g.get("members_count", 0)}


# ── Proxy assignment ─────────────────────────────────────────────────

class ProxyAssignRequest(BaseModel):
    proxy_id: str | None = None  # UUID or null to unassign


@router.post("/{account_id}/assign-proxy")
async def assign_proxy(
    account_id: UUID,
    body: ProxyAssignRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Assign or unassign a proxy to/from an account."""
    from app.models import Proxy

    result = await db.execute(
        select(AccountPool).where(
            AccountPool.id == account_id,
            AccountPool.tenant_id == current_user.tenant_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")

    if body.proxy_id:
        proxy_result = await db.execute(
            select(Proxy).where(
                Proxy.id == UUID(body.proxy_id),
                Proxy.tenant_id == current_user.tenant_id,
                Proxy.is_active == True,
            )
        )
        proxy = proxy_result.scalar_one_or_none()
        if not proxy:
            raise HTTPException(404, "Proxy not found or inactive")
        account.proxy_id = proxy.id
    else:
        account.proxy_id = None

    await db.commit()
    return {"status": "updated", "proxy_id": body.proxy_id}
