"""Group Monitoring API: add, list, start/stop monitoring public groups."""
import logging
import re
from urllib.parse import urlsplit
import uuid as _uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.audit import log_event
from app.database import get_db
from app.models import MonitoredGroup, AccountPool, User
from app.quota import PLAN_LIMITS, get_subscription_plan
from app.security import get_current_user

router = APIRouter(prefix="/api/v1/groups", tags=["groups"])
log = logging.getLogger(__name__)


def _get_redis():
    import redis as _redis
    return _redis.Redis.from_url(
        settings.REDIS_URL.replace("rediss://", "redis://"),
        decode_responses=True,
    )


def _scanner_running(group_id: str) -> bool:
    r = _get_redis()
    return r.get(f"scanner:{group_id}") is not None


def _set_scanner(group_id: str, task_id: str):
    r = _get_redis()
    r.set(f"scanner:{group_id}", task_id, ex=86400)


def _del_scanner(group_id: str):
    r = _get_redis()
    r.delete(f"scanner:{group_id}")


# ── Proxy helpers ────────────────────────────────────────────────────

async def _resolve_proxy_for_account(account_id) -> tuple | None:
    """Look up proxy for account from DB. Returns Telethon proxy tuple or None."""
    try:
        import asyncpg
        from urllib.parse import urlparse
        from app.config import settings
        db_url = settings.DATABASE_URL.replace("+asyncpg", "")
        conn = await asyncpg.connect(db_url)
        try:
            import uuid as _u
            row = await conn.fetchrow(
                """SELECT p.proxy_url FROM account_pool a
                   JOIN proxies p ON a.proxy_id = p.id AND p.tenant_id = a.tenant_id
                   WHERE a.id = $1 AND p.is_active = true""",
                _u.UUID(str(account_id)),
            )
            if not row:
                return None
            url = row["proxy_url"]
            if not url:
                return None
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
        finally:
            await conn.close()
    except Exception as e:
        log.warning(f"Proxy lookup failed for {account_id}: {e}")
        return None


def _validate_group_identifier(platform: str, identifier: str) -> str:
    """Validate the representation consumed by each installed scanner, without repair."""
    if not identifier or identifier != identifier.strip() or any(ord(c) < 32 for c in identifier):
        raise HTTPException(400, "Invalid group identifier")
    if platform == "telegram":
        valid = re.fullmatch(r"@[A-Za-z][A-Za-z0-9_]{3,31}", identifier)
    elif platform == "vkontakte":
        valid = re.fullmatch(r"vk_[1-9][0-9]*", identifier)
    elif platform == "facebook":
        try:
            url = urlsplit(identifier)
            valid = (url.scheme == "https" and url.netloc in {
                "facebook.com", "www.facebook.com", "m.facebook.com", "mbasic.facebook.com"
            } and not url.query and not url.fragment and
                re.fullmatch(r"/groups/[A-Za-z0-9][A-Za-z0-9._-]*/?", url.path) and
                url.path.split("/")[2] not in {".", ".."})
        except ValueError:
            valid = False
    else:
        raise HTTPException(400, "Unsupported monitoring platform")
    if not valid:
        raise HTTPException(400, f"Invalid {platform} group identifier")
    return identifier


class GroupCreateRequest(BaseModel):
    platform: str  # 'telegram' | 'vkontakte'
    group_identifier: str  # '@username' or 'vk_id:12345'
    account_id: str | None = None  # UUID of account; auto-assigned if omitted


@router.get("/")
async def list_groups(
    platform: str | None = None,
    limit: int = Query(default=settings.DEFAULT_PAGE_SIZE, le=settings.MAX_PAGE_SIZE),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(MonitoredGroup).where(
        MonitoredGroup.tenant_id == current_user.tenant_id,
        MonitoredGroup.is_active == True,
    )
    if platform:
        q = q.where(MonitoredGroup.platform == platform)

    from sqlalchemy import func
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    result = await db.execute(q.order_by(MonitoredGroup.created_at.desc()).limit(limit).offset(offset))
    groups = result.scalars().all()

    # Enrich with scanner status
    items = []
    for g in groups:
        items.append({
            "id": str(g.id),
            "platform": g.platform,
            "group_identifier": g.group_identifier,
            "title": g.title or g.group_identifier,
            "members_count": g.members_count or 0,
            "status": "scanning" if _scanner_running(str(g.id)) else g.status,
            "account_id": str(g.account_id) if g.account_id else None,
            "last_scan_at": g.last_scan_at.isoformat() if g.last_scan_at else None,
            "created_at": g.created_at.isoformat() if g.created_at else None,
        })

    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("/", status_code=201)
async def add_group(
    body: GroupCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a public group for monitoring."""
    _validate_group_identifier(body.platform, body.group_identifier)
    # Check target limit
    plan = await get_subscription_plan(str(current_user.tenant_id))
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])
    from sqlalchemy import func as _func
    count_q = select(_func.count()).select_from(
        select(MonitoredGroup).where(
            MonitoredGroup.tenant_id == current_user.tenant_id,
            MonitoredGroup.is_active == True,
        ).subquery()
    )
    count = (await db.execute(count_q)).scalar() or 0
    if count >= limits["max_targets"]:
        raise HTTPException(403, f"Target limit reached ({limits['max_targets']}) for {plan} plan")

    # Auto-assign least-loaded account if none provided
    if not body.account_id:
        auto_id = await _get_least_loaded_account(db, str(current_user.tenant_id), body.platform)
        if not auto_id:
            raise HTTPException(400, "No active accounts available")
        body.account_id = auto_id

    try:
        account_uuid = _uuid.UUID(body.account_id)
    except ValueError:
        raise HTTPException(400, "Invalid account ID")

    # Explicit and automatic accounts share the same admission constraints.
    acct_result = await db.execute(
        select(AccountPool).where(
            AccountPool.id == account_uuid,
            AccountPool.tenant_id == current_user.tenant_id,
            AccountPool.platform == body.platform,
            AccountPool.status.in_(["active", "warming_up"]),
        )
    )
    account = acct_result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")

    # For Telegram, try to get group title via Telethon
    title = None
    members_count = 0
    if body.platform == "telegram" and body.group_identifier.startswith("@"):
        try:
            from telethon import TelegramClient
            from telethon.sessions import StringSession
            import os

            api_id = int(os.getenv("TG_API_ID", "0"))
            api_hash = os.getenv("TG_API_HASH", "")
            if api_id and api_hash:
                # Get session from DB
                import asyncpg
                conn_url = settings.DATABASE_URL.replace("+asyncpg", "")
                conn = await asyncpg.connect(conn_url)
                try:
                    from app.crypto import decrypt as dec
                    row = await conn.fetchrow(
                        "SELECT session_data FROM account_sessions WHERE account_id = $1",
                        _uuid.UUID(body.account_id),
                    )
                    if row:
                        session_str = dec(row["session_data"])
                        proxy = await _resolve_proxy_for_account(body.account_id)
                        client = TelegramClient(StringSession(session_str), api_id, api_hash, proxy=proxy)
                        await client.connect()
                        try:
                            entity = await client.get_entity(body.group_identifier)
                            title = getattr(entity, 'title', None)
                            members_count = getattr(entity, 'participants_count', 0) or 0
                        except Exception:
                            pass
                        finally:
                            await client.disconnect()
                finally:
                    await conn.close()
        except Exception as e:
            log.debug(f"Could not fetch group info: {e}")

    # For VK, fetch group info via VK API
    if body.platform == "vkontakte" and body.group_identifier.startswith("vk_"):
        try:
            import vk_api
            group_id_str = body.group_identifier.replace("vk_", "")
            # Get VK service token from account
            import asyncpg
            conn_url = settings.DATABASE_URL.replace("+asyncpg", "")
            conn = await asyncpg.connect(conn_url)
            try:
                from app.crypto import decrypt as dec
                row = await conn.fetchrow(
                    "SELECT session_data FROM account_sessions WHERE account_id = $1",
                    _uuid.UUID(body.account_id),
                )
                if row:
                    token = dec(row["session_data"])
                    session = vk_api.VkApi(token=token, api_version="5.199")
                    vk = session.get_api()
                    groups = vk.groups.getById(group_id=int(group_id_str))
                    if groups:
                        g = groups[0]
                        title = g.get("name")
                        members_count = g.get("members_count", 0)
            finally:
                await conn.close()
        except Exception as e:
            log.debug(f"Could not fetch VK group info: {e}")

    # Create monitored group
    group = MonitoredGroup(
        tenant_id=current_user.tenant_id,
        account_id=_uuid.UUID(body.account_id),
        platform=body.platform,
        group_identifier=body.group_identifier,
        title=title,
        members_count=members_count,
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)

    log.info(f"Group added: {body.group_identifier} ({body.platform})")
    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="created", entity_type="group",
        entity_id=str(group.id),
        new_value={"platform": body.platform, "group_identifier": body.group_identifier},
        user_id=current_user.id, ip_address=request.client.host if request else None,
    )
    return {
        "id": str(group.id),
        "platform": group.platform,
        "group_identifier": group.group_identifier,
        "title": title or group.group_identifier,
        "members_count": members_count,
        "status": "idle",
    }


# ── Bulk Import ─────────────────────────────────────────────────────

class BulkGroupItem(BaseModel):
    group_identifier: str
    platform: str = "telegram"

class BulkImportRequest(BaseModel):
    groups: list[BulkGroupItem]


async def _get_least_loaded_account(db: AsyncSession, tenant_id: str, platform: str) -> str | None:
    """Find the active account with fewest monitored groups."""
    subq = (
        select(
            MonitoredGroup.account_id,
            func.count().label("group_count"),
        )
        .where(
            MonitoredGroup.tenant_id == tenant_id,
            MonitoredGroup.is_active == True,
        )
        .group_by(MonitoredGroup.account_id)
        .subquery()
    )
    result = await db.execute(
        select(AccountPool.id, func.coalesce(subq.c.group_count, 0).label("cnt"))
        .outerjoin(subq, AccountPool.id == subq.c.account_id)
        .where(
            AccountPool.tenant_id == tenant_id,
            AccountPool.platform == platform,
            AccountPool.status.in_(["active", "warming_up"]),
        )
        .order_by("cnt")
        .limit(1)
    )
    row = result.first()
    return str(row[0]) if row else None


@router.post("/bulk-import")
async def bulk_import_groups(
    body: BulkImportRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk import groups with auto-assignment of least-loaded account."""
    imported = 0
    skipped = 0
    errors: list[str] = []

    plan = await get_subscription_plan(str(current_user.tenant_id))
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])

    count_q = select(func.count()).select_from(
        select(MonitoredGroup).where(
            MonitoredGroup.tenant_id == current_user.tenant_id,
            MonitoredGroup.is_active == True,
        ).subquery()
    )
    count = (await db.execute(count_q)).scalar() or 0

    for item in body.groups:
        if count >= limits["max_targets"]:
            errors.append(f"Target limit reached ({limits['max_targets']})")
            break

        try:
            _validate_group_identifier(item.platform, item.group_identifier)
        except HTTPException as exc:
            errors.append(str(exc.detail))
            continue

        # Skip duplicates
        existing = await db.execute(
            select(MonitoredGroup).where(
                MonitoredGroup.tenant_id == current_user.tenant_id,
                MonitoredGroup.group_identifier == item.group_identifier,
                MonitoredGroup.platform == item.platform,
                MonitoredGroup.is_active == True,
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        account_id = await _get_least_loaded_account(db, str(current_user.tenant_id), item.platform)
        if not account_id:
            errors.append(f"No active {item.platform} accounts available")
            continue

        group = MonitoredGroup(
            tenant_id=current_user.tenant_id,
            account_id=_uuid.UUID(account_id),
            platform=item.platform,
            group_identifier=item.group_identifier,
        )
        db.add(group)
        count += 1
        imported += 1

    await db.commit()
    return {"imported": imported, "skipped": skipped, "errors": errors}


@router.post("/{group_id}/start")
async def start_group_scanner(
    group_id: _uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start monitoring a group."""
    result = await db.execute(
        select(MonitoredGroup).where(
            MonitoredGroup.id == group_id,
            MonitoredGroup.tenant_id == current_user.tenant_id,
        )
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(404, "Group not found")

    _validate_group_identifier(group.platform, group.group_identifier)

    if group.platform == "facebook":
        if not group.is_active:
            raise HTTPException(400, "Group is inactive")
        account = (await db.execute(select(AccountPool).where(
            AccountPool.id == group.account_id,
            AccountPool.tenant_id == current_user.tenant_id,
            AccountPool.platform == "facebook",
            AccountPool.status.in_(["active", "warming_up"]),
        ))).scalar_one_or_none()
        if not account:
            raise HTTPException(400, "Active Facebook account required")
        # Existing Beat scanner consumes this opt-in; no per-group task is queued.
        group.status = "scanning"
        await db.commit()
        return {"status": "scheduled", "group_id": str(group.id)}

    if _scanner_running(str(group_id)):
        return {"status": "already_running", "group_id": str(group_id)}

    # Dispatch scanner task
    from app.celery_app import celery

    if group.platform == "telegram":
        task = celery.send_task(
            "app.tasks.group_scanner.start_group_scanner",
            args=[
                str(current_user.tenant_id),
                str(group.account_id),
                group.group_identifier,
                str(group_id),
            ],
            queue="scanner",
        )
    elif group.platform == "vkontakte":
        # Extract group_id from identifier
        vk_gid = int(group.group_identifier.replace("vk_", ""))
        task = celery.send_task(
            "app.tasks.vk_group_scanner.start_vk_group_scanner",
            args=[
                str(current_user.tenant_id),
                str(group.account_id),
                vk_gid,
                str(group_id),
            ],
            queue="scanner",
        )
    else:
        raise HTTPException(400, f"Unsupported platform: {group.platform}")

    _set_scanner(str(group_id), task.id)
    group.status = "scanning"
    group.last_scan_at = datetime.now(timezone.utc)
    await db.commit()

    log.info(f"Group scanner queued: {group.group_identifier} (task={task.id})")
    return {"status": "queued", "group_id": str(group_id), "task_id": task.id}


@router.post("/{group_id}/stop")
async def stop_group_scanner(
    group_id: _uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stop monitoring a group."""
    result = await db.execute(
        select(MonitoredGroup).where(
            MonitoredGroup.id == group_id,
            MonitoredGroup.tenant_id == current_user.tenant_id,
        )
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(404, "Group not found")

    if group.platform == "facebook":
        # Disables future Beat selection; an in-flight scrape may finish.
        group.status = "idle"
        await db.commit()
        return {"status": "stopped", "group_id": str(group.id)}

    task_id = None
    r = _get_redis()
    raw = r.get(f"scanner:{group_id}")
    if raw:
        task_id = raw
        _del_scanner(str(group_id))

    from app.celery_app import celery
    if task_id:
        celery.control.revoke(task_id, terminate=True, signal="SIGTERM")

    group.status = "idle"
    await db.commit()

    return {"status": "stopped", "group_id": str(group_id)}


@router.delete("/{group_id}", status_code=204)
async def remove_group(
    group_id: _uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a group from monitoring."""
    result = await db.execute(
        select(MonitoredGroup).where(
            MonitoredGroup.id == group_id,
            MonitoredGroup.tenant_id == current_user.tenant_id,
        )
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(404, "Group not found")

    # Stop scanner first (same pattern as stop_group_scanner)
    task_id = None
    r = _get_redis()
    raw = r.get(f"scanner:{group_id}")
    if raw:
        task_id = raw
        _del_scanner(str(group_id))

    if task_id:
        from app.celery_app import celery
        celery.control.revoke(task_id, terminate=True, signal="SIGTERM")

    group.is_active = False
    await db.commit()

    log.info(f"Group removed: {group.group_identifier}")
    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="deleted", entity_type="group",
        entity_id=str(group_id), user_id=current_user.id,
        ip_address=request.client.host if request else None,
    )


# ── Auto-Discovery ────────────────────────────────────────────────────

class DiscoverRequest(BaseModel):
    geo_tag: str  # e.g. "Phuket", "Moscow"
    niche: str    # e.g. "real_estate", "tourism"
    platform: str = "telegram"
    account_id: str | None = None  # optional: use this account to search
    limit: int = Field(default=20, ge=1, le=20)


@router.post("/discover")
async def discover_groups(
    body: DiscoverRequest,
    current_user: User = Depends(get_current_user),
):
    """Auto-discover public groups by GEO and niche.

    Uses Telegram search (via Telethon) or VK groups.search.
    Returns recommended groups with metadata.
    Filters by tenant settings (min_members_count, prefer_open_comments).
    """
    if body.platform not in ("telegram", "vkontakte"):
        raise HTTPException(422, "Discovery supports telegram or vkontakte only")
    # Check target limit
    plan = await get_subscription_plan(str(current_user.tenant_id))
    _limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])

    from app.tenant_settings import get_section
    from app.config import settings as app_settings
    db_url = app_settings.DATABASE_URL.replace("+asyncpg", "")
    groups_cfg = await get_section(db_url, str(current_user.tenant_id), "groups", service=body.platform)

    min_members = groups_cfg.get("min_members_count", 100)
    prefer_open = groups_cfg.get("prefer_open_comments", True)

    results = []

    if body.platform == "telegram":
        results = await _discover_telegram_groups(body.geo_tag, body.niche, body.account_id, tenant_id=current_user.tenant_id)
    elif body.platform == "vkontakte":
        results = await _discover_vk_groups(body.geo_tag, body.niche,
                                            tenant_id=str(current_user.tenant_id), account_id=body.account_id)

    # Apply tenant filters
    filtered = []
    for r in results:
        members = r.get("members_count", 0)
        if members > 0 and members < min_members:
            log.info(f"Filtering out {r.get('group_identifier')}: {members} < {min_members} members")
            continue
        if prefer_open and r.get("access") == "closed":
            log.info(f"Filtering out {r.get('group_identifier')}: closed access")
            continue
        filtered.append(r)
    log.info(f"Filter results: {len(results)} → {len(filtered)} (min_members={min_members}, prefer_open={prefer_open})")

    filtered = filtered[:body.limit]
    # Persist discovered results as targets so the frontend can list them
    from app.config import settings as _s
    import asyncpg as _asyncpg
    conn_url = _s.DATABASE_URL.replace("+asyncpg", "")
    conn = await _asyncpg.connect(conn_url)
    try:
        for r in filtered[:20]:
            target_code = r.get("group_identifier", "")
            existing = await conn.fetchval(
                "SELECT id FROM targets WHERE tenant_id = $1 AND platform = $2 AND target_id_code = $3",
                current_user.tenant_id, body.platform, target_code,
            )
            if existing:
                await conn.execute(
                    "UPDATE targets SET title = $1, members_count = $2 WHERE id = $3",
                    r.get("title", ""), r.get("members_count", 0), existing,
                )
            else:
                    # Map search access to DB enum: open_wall|open_comments|suggested_news|admin_dm_only
                    raw_access = r.get("access", "public")
                    access_map = {"public": "open_wall", "open": "open_wall", "closed": "admin_dm_only", "private": "admin_dm_only"}
                    db_access = access_map.get(raw_access, "open_wall")
                    await conn.execute(
                        """INSERT INTO targets (id, tenant_id, platform, target_id_code, title, geo_tag, niche, access, members_count)
                           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)""",
                        current_user.tenant_id, body.platform, target_code,
                        r.get("title", target_code), body.geo_tag, body.niche,
                        db_access, r.get("members_count", 0),
                    )
    finally:
        await conn.close()

    return {"results": filtered, "total": len(filtered), "filters": {"min_members": min_members, "prefer_open": prefer_open}}


async def _discover_telegram_groups(geo_tag: str, niche: str, account_id: str | None, tenant_id=None) -> list:
    """Search Telegram for public groups matching GEO + niche."""
    import os

    api_id = int(os.getenv("TG_API_ID", "0"))
    api_hash = os.getenv("TG_API_HASH", "")
    if not api_id or not api_hash:
        raise HTTPException(503, "Telegram search configuration unavailable")

    # Build search queries from GEO + niche keywords
    queries = [
        f"{geo_tag} {niche}",
        f"{geo_tag}",
        niche.replace("_", " "),
    ]

    results = []
    seen = set()

    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession

        # Get a session to search with
        client = None
        if account_id:
            import asyncpg
            from app.crypto import decrypt as dec
            conn_url = settings.DATABASE_URL.replace("+asyncpg", "")
            conn = await asyncpg.connect(conn_url)
            try:
                row = await conn.fetchrow(
                    """SELECT s.session_data FROM account_sessions s JOIN account_pool a ON a.id = s.account_id
                       WHERE a.id = $1 AND a.tenant_id = $2 AND a.platform = 'telegram' AND a.status = 'active'""",
                    __import__('uuid').UUID(account_id), tenant_id,
                )
                if row:
                    session_str = dec(row["session_data"])
                    proxy = await _resolve_proxy_for_account(account_id)
                    client = TelegramClient(StringSession(session_str), api_id, api_hash, proxy=proxy)
                    await client.connect()
            finally:
                await conn.close()

        if not client and account_id:
            raise HTTPException(400, "Selected active Telegram account unavailable")
        if not client and tenant_id:
            # Fallback: pick any active account for this tenant
            import asyncpg
            from app.crypto import decrypt as dec
            conn_url = settings.DATABASE_URL.replace("+asyncpg", "")
            conn = await asyncpg.connect(conn_url)
            try:
                row = await conn.fetchrow(
                    """SELECT a.id, s.session_data FROM account_pool a
                       JOIN account_sessions s ON s.account_id = a.id
                        WHERE a.tenant_id = $1 AND a.platform = 'telegram' AND a.status = 'active'
                       ORDER BY a.created_at LIMIT 1""",
                    tenant_id,
                )
                if row:
                    session_str = dec(row["session_data"])
                    proxy = await _resolve_proxy_for_account(row["id"])
                    client = TelegramClient(StringSession(session_str), api_id, api_hash, proxy=proxy)
                    await client.connect()
            finally:
                await conn.close()

        if not client:
            log.warning("No active Telegram session found for discovery")
            raise HTTPException(400, "Active Telegram search account required")

        try:
            from telethon.tl.functions.contacts import SearchRequest as ContactsSearchRequest

            successful_queries = 0
            for query in queries:
                try:
                    log.info(f"Searching Telegram for query: {query!r}")
                    entity_count = 0

                    # contacts.search returns users, chats, and channels globally
                    result = await client(ContactsSearchRequest(q=query, limit=50))
                    successful_queries += 1
                    chats = getattr(result, 'chats', []) or []

                    for entity in chats:
                        username = getattr(entity, 'username', '') or ''
                        name = getattr(entity, 'title', '').lower()

                        if not username or username in seen:
                            continue

                        is_channel = getattr(entity, 'megagroup', False) or getattr(entity, 'broadcast', False)
                        if not is_channel:
                            continue

                        entity_count += 1

                        # Filter out very small channels (likely spam)
                        try:
                            from telethon.tl.functions.channels import GetFullChannelRequest
                            full = await client(GetFullChannelRequest(entity))
                            members = getattr(full.full_chat, 'participants_count', 0) or 0
                        except Exception:
                            members = 0

                        relevance = 0
                        geo_lower = geo_tag.lower()
                        niche_lower = niche.lower().replace("_", " ")

                        if geo_lower in name or geo_lower in username.lower():
                            relevance += 10
                        if niche_lower in name or niche_lower in username.lower():
                            relevance += 10

                        for word in niche_lower.split():
                            if word in name:
                                relevance += 3

                        seen.add(username)
                        results.append({
                            "platform": "telegram",
                            "group_identifier": f"@{username}",
                            "title": getattr(entity, 'title', username),
                            "members_count": members,
                            "relevance": relevance,
                        })
                    log.info(f"Query {query!r}: found {entity_count} channels, {len(results)} total results")
                except Exception as e:
                    log.warning(f"Search query '{query}' failed: {e}")
                    continue
            if not successful_queries:
                raise HTTPException(502, "Telegram discovery unavailable")
        finally:
            await client.disconnect()

        # Sort by relevance
        results.sort(key=lambda x: x["relevance"], reverse=True)
        return results[:20]

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(502, "Telegram discovery unavailable")


async def _resolve_vk_service_token(tenant_id: str) -> str:
    """Tenant's VK service token from settings, "" if unset.

    ponytail: pure lookup split out for tests — the vk-settings page saves
    service_token into the vk section, previously read by nothing.
    """
    try:
        from app.tenant_settings import get_section
        from app.config import settings as app_settings
        db_url = app_settings.DATABASE_URL.replace("+asyncpg", "")
        cfg = await get_section(db_url, tenant_id, "vk")
        return (cfg.get("service_token") or "").strip()
    except Exception:
        return ""


async def _discover_vk_groups(geo_tag: str, niche: str, tenant_id: str | None = None, account_id: str | None = None) -> list:
    # account_id is a legacy sender selector; discovery never reads campaign sessions.
    from app.vk_discovery import credential, _vk_call
    if not tenant_id:
        raise HTTPException(400, "Tenant required")
    token = await credential(tenant_id, secret=True)
    response = await _vk_call('groups.search', token, q=f"{geo_tag} {niche}".replace('_', ' '), count=20)
    if 'error' in response:
        raise HTTPException(409, detail={'code': 'vk_reconnect_required'})
    items = response.get('response', {}).get('items')
    if not isinstance(items, list):
        raise HTTPException(502, detail={'code': 'vk_invalid_response'})
    if not items:
        return []
    details = await _vk_call('groups.getById', token, group_ids=','.join(str(i['id']) for i in items), fields='members_count')
    if 'error' in details:
        raise HTTPException(502, detail={'code': 'vk_details_unavailable'})
    envelope = details.get('response', {})
    groups = envelope.get('groups', []) if isinstance(envelope, dict) else envelope
    counts = {i['id']: i for i in groups}
    return [{'platform': 'vkontakte', 'group_identifier': str(i['id']),
             'title': i.get('name', ''), 'members_count': counts.get(i['id'], {}).get('members_count', 0),
             'access': 'closed' if i.get('is_closed', 0) else 'public', 'relevance': 5}
            for i in items][:20]
