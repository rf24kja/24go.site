"""Audit log endpoints: view change history."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.security import get_current_user
from app.config import settings
from app.audit import get_audit_log

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


@router.get("/")
async def list_audit_entries(
    entity_type: str | None = None,
    limit: int = Query(default=50, le=200),
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
