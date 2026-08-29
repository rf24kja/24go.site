"""Lead endpoints: list, qualify, dispatch.

The /qualify endpoint lets any client submit a message for LLM classification
without needing a live Telegram listener — useful for testing and manual ops.
"""
from datetime import date

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Lead, Target, User
from app.security import get_current_user
from app.schemas import LeadResponse

router = APIRouter(prefix="/api/v1/leads", tags=["leads"])


@router.get("/{lead_id}")
async def get_lead(
    lead_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full lead detail with audit history."""
    import uuid as _uuid
    from fastapi import HTTPException

    q = select(Lead).where(
        Lead.id == _uuid.UUID(lead_id),
        Lead.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(404, "Lead not found")

    # Fetch audit trail for this lead
    import asyncpg
    from app.config import settings
    db_url = settings.DATABASE_URL.replace("+asyncpg", "")

    events = []
    try:
        conn = await asyncpg.connect(db_url)
        try:
            rows = await conn.fetch(
                "SELECT action, old_value, new_value, user_id, created_at "
                "FROM audit_log WHERE entity_type = 'lead' AND entity_id = $1 "
                "ORDER BY created_at DESC LIMIT 50",
                lead.id,
            )
            events = [
                {
                    "action": r["action"],
                    "old_value": r["old_value"],
                    "new_value": r["new_value"],
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                }
                for r in rows
            ]
        finally:
            await conn.close()
    except Exception:
        pass  # Audit log table may not exist yet

    # Resolve target name if present
    target_name = None
    if lead.target_id:
        target = await db.execute(select(Target).where(Target.id == lead.target_id))
        t = target.scalar_one_or_none()
        if t:
            target_name = t.title

    return {
        "id": str(lead.id),
        "user_handle": lead.user_handle,
        "user_full_name": lead.user_full_name,
        "platform": lead.platform.value if hasattr(lead.platform, "value") else lead.platform,
        "intent_score": lead.intent_score.value if hasattr(lead.intent_score, "value") else lead.intent_score,
        "status": lead.status.value if hasattr(lead.status, "value") else lead.status,
        "source": getattr(lead, "source", "dm") or "dm",
        "post_id": getattr(lead, "post_id", None),
        "geo_tag": lead.geo_tag,
        "message_text": lead.message_text,
        "dialog_url": lead.dialog_url,
        "target_name": target_name,
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
        "events": events,
    }


@router.get("/")
async def list_leads(
    intent_score: str | None = None,
    status_filter: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Lead).where(Lead.tenant_id == current_user.tenant_id)
    if intent_score:
        q = q.where(Lead.intent_score == intent_score)
    if status_filter:
        q = q.where(Lead.status == status_filter)
    
    # Get total count for pagination
    from sqlalchemy import func
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    
    result = await db.execute(q.order_by(Lead.created_at.desc()).limit(limit).offset(offset))
    return {"items": result.scalars().all(), "total": total, "limit": limit, "offset": offset}


class QualifyRequest(BaseModel):
    """Submit a message for LLM qualification without a live listener."""
    platform: str = Field(default="telegram")
    target_id: str | None = None
    account_id: str | None = None
    user_handle: str = Field(..., min_length=1, max_length=255)
    user_full_name: str = Field(default="")
    message_text: str = Field(..., min_length=1, max_length=5000)
    geo_tag: str = Field(default="")


class QualifyResponse(BaseModel):
    status: str
    lead_id: str | None = None
    intent_score: str
    confidence: float | None = None
    summary: str | None = None


@router.post("/qualify", response_model=QualifyResponse)
async def qualify_lead(
    body: QualifyRequest,
    current_user: User = Depends(get_current_user),
):
    """Classify a message for buying intent using LLM.

    Submits a message for AI-powered qualification without needing a live Telegram listener.
    Returns intent score (HOT/WARM/COLD/SPAM), confidence, and summary.
    Use for testing, manual lead entry, or non-Telegram platforms.
    """
    from app.lead_pipeline import process_incoming_message

    result = await process_incoming_message(
        tenant_id=str(current_user.tenant_id),
        platform=body.platform,
        target_id=body.target_id or "",
        account_id=body.account_id or "",
        user_handle=body.user_handle,
        user_full_name=body.user_full_name,
        message_text=body.message_text,
        geo_tag=body.geo_tag,
    )
    return QualifyResponse(**result)


class StatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(new|in_progress|converted|rejected)$")


@router.patch("/{lead_id}", response_model=LeadResponse)
async def update_lead_status(
    lead_id: str,
    body: StatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """Update lead status (for Kanban drag-and-drop)."""
    import uuid
    from fastapi import HTTPException
    from app.config import settings
    from app.audit import log_event
    q = select(Lead).where(
        Lead.id == uuid.UUID(lead_id),
        Lead.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(404, "Lead not found")
    old_status = lead.status
    lead.status = body.status
    await db.commit()
    await db.refresh(lead)
    # Audit log
    if old_status != body.status:
        ip = request.client.host if request else None
        await log_event(
            url=settings.DATABASE_URL.replace("+asyncpg", ""),
            tenant_id=current_user.tenant_id,
            action="status_change",
            entity_type="lead",
            entity_id=lead.id,
            old_value={"status": old_status},
            new_value={"status": body.status},
            user_id=current_user.id,
            ip_address=ip,
        )
    return lead


class BulkStatusRequest(BaseModel):
    lead_ids: list[str] = Field(..., min_length=1, max_length=100)
    status: str = Field(..., pattern="^(new|in_progress|converted|rejected)$")


@router.post("/bulk-status")
async def bulk_update_status(
    body: BulkStatusRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk update lead statuses (for Kanban batch operations)."""
    import uuid
    ids = [uuid.UUID(lid) for lid in body.lead_ids]
    from sqlalchemy import update
    await db.execute(
        update(Lead)
        .where(Lead.id.in_(ids), Lead.tenant_id == current_user.tenant_id)
        .values(status=body.status)
    )
    await db.commit()
    return {"updated": len(ids)}


@router.get("/export")
async def export_leads_csv(
    intent_score: str | None = None,
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export leads as CSV for CRM import."""
    from fastapi.responses import StreamingResponse
    import csv
    import io

    q = select(Lead).where(Lead.tenant_id == current_user.tenant_id)
    if intent_score:
        q = q.where(Lead.intent_score == intent_score)
    if status_filter:
        q = q.where(Lead.status == status_filter)
    result = await db.execute(q.order_by(Lead.created_at.desc()).limit(5000))
    leads = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["handle", "full_name", "platform", "intent", "status", "geo", "message", "dialog_url", "created_at"])
    for lead in leads:
        writer.writerow([
            lead.user_handle,
            lead.user_full_name or "",
            lead.platform.value if hasattr(lead.platform, "value") else lead.platform,
            lead.intent_score.value if hasattr(lead.intent_score, "value") else lead.intent_score,
            lead.status.value if hasattr(lead.status, "value") else lead.status,
            lead.geo_tag or "",
            (lead.message_text or "")[:500],
            lead.dialog_url or "",
            lead.created_at.isoformat() if lead.created_at else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=leads_{date.today().isoformat()}.csv"},
    )


# ── CSV Import ─────────────────────────────────────────────────────────

class ImportResult(BaseModel):
    imported: int
    skipped: int
    errors: list[str]


class ImportRequest(BaseModel):
    file: str = Field(..., description="CSV content as string (max 5000 rows)")
    default_geo: str = Field(default="")
    default_platform: str = Field(default="telegram")


@router.post("/import", response_model=ImportResult)
async def import_leads_csv(
    body: ImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import leads from CSV text. Expected columns: handle, message, [geo], [platform], [full_name].

    Deduplicates by (tenant_id, user_handle). Skips existing handles.
    """
    import csv
    import io
    import uuid

    reader = csv.DictReader(io.StringIO(body.file))
    imported = 0
    skipped = 0
    errors = []

    # Get existing handles for dedup
    result = await db.execute(
        select(Lead.user_handle).where(Lead.tenant_id == current_user.tenant_id)
    )
    existing_handles = {row[0] for row in result.all()}

    for i, row in enumerate(reader, start=2):
        try:
            handle = (row.get("handle") or row.get("user_handle") or "").strip()
            message = (row.get("message") or row.get("message_text") or "").strip()
            if not handle or not message:
                errors.append(f"Row {i}: missing handle or message")
                skipped += 1
                continue

            if handle in existing_handles:
                skipped += 1
                continue

            lead = Lead(
                id=uuid.uuid4(),
                tenant_id=current_user.tenant_id,
                user_handle=handle,
                user_full_name=row.get("full_name") or row.get("name") or "",
                message_text=message,
                geo_tag=row.get("geo") or row.get("geo_tag") or body.default_geo,
                platform=row.get("platform") or body.default_platform,
                intent_score="COLD",  # Will be classified later
                status="new",
            )
            db.add(lead)
            existing_handles.add(handle)
            imported += 1
        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
            skipped += 1

    await db.commit()
    return ImportResult(imported=imported, skipped=skipped, errors=errors[:50])
