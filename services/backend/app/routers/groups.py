"""Group Monitoring API: add, list, start/stop monitoring public groups."""
import logging
import uuid as _uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.audit import log_event
from app.database import get_db
from app.models import MonitoredGroup, AccountPool, User, Target
from app.quota import PLAN_LIMITS, get_subscription_plan
from app.security import get_current_user

router = APIRouter(prefix="/api/v1/groups", tags=["groups"])
log = logging.getLogger(__name__)

# Track active scanner task IDs per group
_active_scanners: dict[str, str] = {}  # group_id -> task_id


# ── Proxy helpers ────────────────────────────────────────────────────

async def _resolve_proxy_for_account(account_id) -> tuple | None:
    """Look up proxy for account from DB. Returns Telethon proxy tuple or None."""
    try:
        import os, asyncpg
        from urllib.parse import urlparse
        from app.config import settings
        db_url = settings.DATABASE_URL.replace("+asyncpg", "")
        conn = await asyncpg.connect(db_url)
        try:
            import uuid as _u
            row = await conn.fetchrow(
                """SELECT p.proxy_url FROM account_pool a
                   JOIN proxies p ON a.proxy_id = p.id
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
            "status": _active_scanners.get(str(g.id), g.status),
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
        auto_id = await _get_least_loaded_account(db, str(current_user.tenant_id))
        if not auto_id:
            raise HTTPException(400, "No active accounts available")
        body.account_id = auto_id

    # Verify account exists and belongs to this tenant
    acct_result = await db.execute(
        select(AccountPool).where(
            AccountPool.id == _uuid.UUID(body.account_id),
            AccountPool.tenant_id == current_user.tenant_id,
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


async def _get_least_loaded_account(db: AsyncSession, tenant_id: str) -> str | None:
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

        # Skip duplicates
        existing = await db.execute(
            select(MonitoredGroup).where(
                MonitoredGroup.tenant_id == current_user.tenant_id,
                MonitoredGroup.group_identifier == item.group_identifier,
                MonitoredGroup.is_active == True,
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        account_id = await _get_least_loaded_account(db, str(current_user.tenant_id))
        if not account_id:
            errors.append("No active accounts available")
            break

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

    if str(group_id) in _active_scanners:
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
            queue="listener",
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
            queue="listener",
        )
    else:
        raise HTTPException(400, f"Unsupported platform: {group.platform}")

    _active_scanners[str(group_id)] = task.id
    group.status = "scanning"
    group.last_scan_at = datetime.now(timezone.utc)
    await db.commit()

    log.info(f"Group scanner started: {group.group_identifier} (task={task.id})")
    return {"status": "started", "group_id": str(group_id), "task_id": task.id}


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

    task_id = _active_scanners.pop(str(group_id), None)

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

    # Stop scanner first
    task_id = _active_scanners.pop(str(group_id), None)
    if task_id:
        from app.celery_app import celery
        celery.control.revoke(task_id, terminate=True)

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
    # Check target limit
    plan = await get_subscription_plan(str(current_user.tenant_id))
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])

    from app.tenant_settings import get_section
    from app.config import settings as app_settings
    db_url = app_settings.DATABASE_URL.replace("+asyncpg", "")
    groups_cfg = await get_section(db_url, str(current_user.tenant_id), "groups")

    min_members = groups_cfg.get("min_members_count", 100)
    prefer_open = groups_cfg.get("prefer_open_comments", True)

    results = []

    if body.platform == "telegram":
        results = await _discover_telegram_groups(body.geo_tag, body.niche, body.account_id, tenant_id=current_user.tenant_id)
    elif body.platform == "vkontakte":
        results = await _discover_vk_groups(body.geo_tag, body.niche)

    # Apply tenant filters
    filtered = []
    for r in results:
        if r.get("members_count", 0) < min_members:
            continue
        if prefer_open and r.get("access") == "closed":
            continue
        filtered.append(r)

    # Persist discovered results as targets so the frontend can list them
    from app.models import Target
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
                await conn.execute(
                    """INSERT INTO targets (id, tenant_id, platform, target_id_code, title, geo_tag, niche, access, members_count)
                       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)""",
                    current_user.tenant_id, body.platform, target_code,
                    r.get("title", target_code), body.geo_tag, body.niche,
                    r.get("access", "public"), r.get("members_count", 0),
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
        return []

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
                from app.models import AccountPool
                row = await conn.fetchrow(
                    "SELECT s.session_data FROM account_sessions s WHERE s.account_id = $1",
                    __import__('uuid').UUID(account_id),
                )
                if row:
                    session_str = dec(row["session_data"])
                    proxy = await _resolve_proxy_for_account(account_id)
                    client = TelegramClient(StringSession(session_str), api_id, api_hash, proxy=proxy)
                    await client.connect()
            finally:
                await conn.close()

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
                        WHERE a.tenant_id = $1 AND a.status IN ('active', 'warming_up')
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
            return []

        try:
            for query in queries:
                try:
                    # search_global discovers public groups/channels, not just joined ones
                    async for entity in client.search_global(query, limit=20):
                        name = getattr(entity, 'title', '').lower()
                        username = getattr(entity, 'username', '') or ''

                        if not username or username in seen:
                            continue
                        if not getattr(entity, 'megagroup', False) and not getattr(entity, 'broadcast', False):
                            continue

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

                        if relevance > 0:
                            seen.add(username)
                            try:
                                full = await client.get_entity(entity)
                                members = getattr(full, 'participants_count', 0) or 0
                            except Exception:
                                members = 0
                            results.append({
                                "platform": "telegram",
                                "group_identifier": f"@{username}",
                                "title": getattr(entity, 'title', username),
                                "members_count": members,
                                "relevance": relevance,
                            })
                except Exception as e:
                    log.debug(f"Search query '{query}' failed: {e}")
                    continue
        finally:
            await client.disconnect()

        # Sort by relevance
        results.sort(key=lambda x: x["relevance"], reverse=True)
        return results[:20]

    except Exception as e:
        log.error(f"Telegram group discovery failed: {e}")
        return []


async def _discover_vk_groups(geo_tag: str, niche: str) -> list:
    """Search VK for communities matching GEO + niche."""
    import os
    import vk_api

    service_token = os.getenv("VK_SERVICE_TOKEN", "")
    if not service_token:
        return []

    try:
        session = vk_api.VkApi(token=service_token)
        vk = session.get_api()

        query = f"{geo_tag} {niche}".replace("_", " ")
        response = vk.groups.search(q=query, count=20, type="group")

        results = []
        for item in response.get("items", []):
            results.append({
                "platform": "vkontakte",
                "group_identifier": f"vk_{item['id']}",
                "title": item.get("name", ""),
                "members_count": item.get("members_count", 0),
                "relevance": 5,  # Default relevance for VK
            })

        return results[:20]
    except Exception as e:
        log.error(f"VK group discovery failed: {e}")
        return []
