"""Audit log endpoints: view change history."""
import os
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.security import get_current_user
from app.config import settings
from app.audit import get_audit_log

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])

OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "rf24krsk@gmail.com")


@router.get("/")
async def list_audit_entries(
    entity_type: str | None = None,
    limit: int = Query(default=settings.DEFAULT_PAGE_SIZE, le=settings.MAX_PAGE_SIZE),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get audit log entries for the current tenant."""
    url = settings.DATABASE_URL.replace("+asyncpg", "")
    entries = await get_audit_log(url, current_user.tenant_id, entity_type, limit)
    # Serialize datetime objects
    for e in entries:
        if hasattr(e.get("created_at"), "isoformat"):
            e["created_at"] = e["created_at"].isoformat()
        if e.get("entity_id"):
            e["entity_id"] = str(e["entity_id"])
        e["id"] = str(e["id"])
    return entries


@router.get("/owner")
async def owner_audit_log(
    entity_type: str | None = None,
    user_id: str | None = None,
    tenant_id: str | None = None,
    action: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = Query(default=200, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Owner-only: cross-tenant audit log with full activity tracking."""
    if current_user.email != OWNER_EMAIL:
        # Check role field too
        role = getattr(current_user, "role", None)
        if role != "owner":
            from fastapi import HTTPException
            raise HTTPException(403, "Owner access required")

    conditions = []
    params: dict = {"limit": limit}

    if entity_type and entity_type != "all":
        conditions.append("al.entity_type = :entity_type")
        params["entity_type"] = entity_type
    if user_id:
        conditions.append("al.user_id = :user_id")
        params["user_id"] = user_id
    if tenant_id:
        conditions.append("al.tenant_id = :tenant_id")
        params["tenant_id"] = tenant_id
    if action:
        conditions.append("al.action = :action")
        params["action"] = action
    if date_from:
        conditions.append("al.created_at >= :date_from")
        params["date_from"] = date_from
    if date_to:
        conditions.append("al.created_at <= :date_to")
        params["date_to"] = date_to

    where = " AND ".join(conditions) if conditions else "1=1"

    query = text(f"""
        SELECT
            al.id, al.tenant_id, al.user_id, al.action, al.entity_type, al.entity_id,
            al.old_value, al.new_value, al.ip_address, al.created_at,
            u.email as user_email, u.full_name as user_name,
            t.name as tenant_name
        FROM audit_log al
        LEFT JOIN users u ON u.id = al.user_id
        LEFT JOIN tenants t ON t.id = al.tenant_id
        WHERE {where}
        ORDER BY al.created_at DESC
        LIMIT :limit
    """)

    result = await db.execute(query, params)
    rows = result.mappings().all()

    entries = []
    for r in rows:
        entry = dict(r)
        if hasattr(entry.get("created_at"), "isoformat"):
            entry["created_at"] = entry["created_at"].isoformat()
        if entry.get("entity_id"):
            entry["entity_id"] = str(entry["entity_id"])
        if entry.get("id"):
            entry["id"] = str(entry["id"])
        if entry.get("tenant_id"):
            entry["tenant_id"] = str(entry["tenant_id"])
        if entry.get("user_id"):
            entry["user_id"] = str(entry["user_id"])
        entries.append(entry)

    return entries


@router.get("/owner/users")
async def owner_list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Owner-only: list all users across all tenants."""
    if current_user.email != OWNER_EMAIL:
        from fastapi import HTTPException
        raise HTTPException(403, "Owner access required")

    query = text("""
        SELECT
            u.id, u.email, u.role, u.created_at,
            t.id as tenant_id, t.company_name, t.plan, t.is_active
        FROM users u
        LEFT JOIN tenants t ON t.id = u.tenant_id
        ORDER BY u.created_at DESC
    """)
    result = await db.execute(query)
    rows = result.mappings().all()

    users = []
    for r in rows:
        u = dict(r)
        for k in ("id", "tenant_id"):
            if u.get(k):
                u[k] = str(u[k])
        if hasattr(u.get("created_at"), "isoformat"):
            u["created_at"] = u["created_at"].isoformat()
        users.append(u)
    return users


@router.get("/owner/subscriptions")
async def owner_list_subscriptions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Owner-only: list all subscriptions with usage and billing info."""
    if current_user.email != OWNER_EMAIL:
        from fastapi import HTTPException
        raise HTTPException(403, "Owner access required")

    query = text("""
        SELECT
            s.id, s.tenant_id, s.plan, s.status,
            s.current_period_start, s.current_period_end,
            s.monthly_posts_limit, s.monthly_posts_used,
            s.token_credits_balance, s.created_at,
            t.company_name,
            (SELECT u.email FROM users u WHERE u.tenant_id = s.tenant_id AND u.role = 'owner' LIMIT 1) as owner_email
        FROM subscriptions s
        LEFT JOIN tenants t ON t.id = s.tenant_id
        ORDER BY s.created_at DESC
    """)
    result = await db.execute(query)
    rows = result.mappings().all()

    subs = []
    for r in rows:
        s = dict(r)
        for k in ("id", "tenant_id"):
            if s.get(k):
                s[k] = str(s[k])
        for k in ("current_period_start", "current_period_end", "created_at"):
            if hasattr(s.get(k), "isoformat"):
                s[k] = s[k].isoformat()
        subs.append(s)
    return subs
