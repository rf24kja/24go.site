"""Group Monitoring API: add, list, start/stop monitoring public groups."""
import logging
import uuid as _uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.audit import log_event
from app.database import get_db
from app.models import MonitoredGroup, AccountPool, User
from app.security import get_current_user

router = APIRouter(prefix="/api/v1/groups", tags=["groups"])
log = logging.getLogger(__name__)

# Track active scanner task IDs per group
_active_scanners: dict[str, str] = {}  # group_id -> task_id


class GroupCreateRequest(BaseModel):
    platform: str  # 'telegram' | 'vkontakte'
    group_identifier: str  # '@username' or 'vk_id:12345'
    account_id: str  # UUID of the account to use for monitoring


@router.get("/")
async def list_groups(
    platform: str | None = None,
    limit: int = Query(default=50, le=200),
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
                        client = TelegramClient(StringSession(session_str), api_id, api_hash)
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
