"""Mailing (broadcasting) endpoints: CRUD, import recipients, start/pause/stop."""
import csv
import io
import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Mailing, MailingRecipient, MailingStatus, User
from app.security import get_current_user
from app.schemas import MailingCreate, MailingImportRequest

router = APIRouter(prefix="/api/v1/mailings", tags=["mailings"])


@router.post("/", response_model=dict)
async def create_mailing(
    body: MailingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mailing = Mailing(
        id=_uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        name=body.name,
        message_text=body.message_text,
        platform=body.platform,
        delay_seconds=body.delay_seconds,
    )
    db.add(mailing)
    await db.commit()
    await db.refresh(mailing)
    return _mailing_to_dict(mailing)


@router.get("/", response_model=dict)
async def list_mailings(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Mailing).where(Mailing.tenant_id == current_user.tenant_id)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(q.order_by(Mailing.created_at.desc()).limit(limit).offset(offset))
    items = [_mailing_to_dict(m) for m in result.scalars().all()]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/{mailing_id}")
async def get_mailing(
    mailing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Mailing).where(
        Mailing.id == _uuid.UUID(mailing_id),
        Mailing.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    mailing = result.scalar_one_or_none()
    if not mailing:
        raise HTTPException(404, "Mailing not found")

    rq = select(
        MailingRecipient.status,
        func.count().label("count"),
    ).where(MailingRecipient.mailing_id == mailing.id).group_by(MailingRecipient.status)
    r_result = await db.execute(rq)
    counts = {row[0].value if hasattr(row[0], "value") else row[0]: row[1] for row in r_result.all()}

    d = _mailing_to_dict(mailing)
    d["recipient_counts"] = counts
    return d


@router.post("/import")
async def import_recipients(
    body: MailingImportRequest,
    mailing_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if mailing_id:
        q = select(Mailing).where(
            Mailing.id == _uuid.UUID(mailing_id),
            Mailing.tenant_id == current_user.tenant_id,
        )
        result = await db.execute(q)
        mailing = result.scalar_one_or_none()
        if not mailing:
            raise HTTPException(404, "Mailing not found")
    else:
        mailing = Mailing(
            id=_uuid.uuid4(),
            tenant_id=current_user.tenant_id,
            name="Imported Mailing",
            message_text="",
            platform=body.platform if hasattr(body, 'platform') else "telegram",
        )
        db.add(mailing)
        await db.flush()

    # Parse plain text: 1 username per line
    # Supports: @username, username, https://t.me/username
    # Ignores: empty lines, comments (#)
    lines = body.file.strip().splitlines()
    imported = 0
    skipped = 0
    errors = []

    for i, line in enumerate(lines, start=1):
        try:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            
            # Extract username from various formats
            username = line
            if "t.me/" in line:
                # Extract from URL: https://t.me/username or https://t.me/+invite
                username = line.split("t.me/")[-1].split("/")[0].split("?")[0]
            username = username.lstrip("@").strip()
            
            if not username or len(username) < 3:
                errors.append(f"Line {i}: invalid username '{line}'")
                skipped += 1
                continue

            recipient = MailingRecipient(
                id=_uuid.uuid4(),
                mailing_id=mailing.id,
                username=username,
                first_name=None,
            )
            db.add(recipient)
            imported += 1
        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
            skipped += 1

    mailing.total_count += imported
    await db.commit()

    return {
        "mailing_id": str(mailing.id),
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:50],
    }


@router.post("/{mailing_id}/start")
async def start_mailing(
    mailing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Mailing).where(
        Mailing.id == _uuid.UUID(mailing_id),
        Mailing.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    mailing = result.scalar_one_or_none()
    if not mailing:
        raise HTTPException(404, "Mailing not found")

    if mailing.status not in (MailingStatus.draft, MailingStatus.paused):
        raise HTTPException(400, f"Cannot start mailing in {mailing.status} status")

    from datetime import datetime, timezone
    mailing.status = MailingStatus.running
    mailing.started_at = datetime.now(timezone.utc)
    await db.commit()

    from app.tasks.mailer import process_mailing
    process_mailing.delay(str(mailing.id), str(current_user.tenant_id))

    return {"status": "started", "mailing_id": str(mailing.id)}


@router.post("/{mailing_id}/pause")
async def pause_mailing(
    mailing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Mailing).where(
        Mailing.id == _uuid.UUID(mailing_id),
        Mailing.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    mailing = result.scalar_one_or_none()
    if not mailing:
        raise HTTPException(404, "Mailing not found")

    if mailing.status != MailingStatus.running:
        raise HTTPException(400, "Can only pause running mailings")

    mailing.status = MailingStatus.paused
    await db.commit()
    return {"status": "paused"}


@router.post("/{mailing_id}/stop")
async def stop_mailing(
    mailing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Mailing).where(
        Mailing.id == _uuid.UUID(mailing_id),
        Mailing.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    mailing = result.scalar_one_or_none()
    if not mailing:
        raise HTTPException(404, "Mailing not found")

    mailing.status = MailingStatus.completed
    await db.commit()
    return {"status": "completed"}


@router.post("/{mailing_id}/check-read")
async def check_read(
    mailing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger read status check for a completed mailing."""
    from app.celery_app import celery as celery_app

    q = select(Mailing).where(
        Mailing.id == _uuid.UUID(mailing_id),
        Mailing.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    mailing = result.scalar_one_or_none()
    if not mailing:
        raise HTTPException(404, "Mailing not found")

    celery_app.send_task("app.tasks.mailer.check_read_status", args=[mailing_id])
    return {"status": "check_scheduled"}


@router.delete("/{mailing_id}")
async def delete_mailing(
    mailing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Mailing).where(
        Mailing.id == _uuid.UUID(mailing_id),
        Mailing.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    mailing = result.scalar_one_or_none()
    if not mailing:
        raise HTTPException(404, "Mailing not found")

    # Delete recipients first
    from sqlalchemy import delete as sa_delete
    await db.execute(sa_delete(MailingRecipient).where(MailingRecipient.mailing_id == mailing.id))
    await db.delete(mailing)
    await db.commit()
    return {"status": "deleted"}


def _mailing_to_dict(m: Mailing) -> dict:
    return {
        "id": str(m.id),
        "name": m.name,
        "message_text": m.message_text,
        "platform": m.platform.value if hasattr(m.platform, "value") else m.platform,
        "status": m.status.value if hasattr(m.status, "value") else m.status,
        "total_count": m.total_count,
        "sent_count": m.sent_count,
        "read_count": m.read_count,
        "failed_count": m.failed_count,
        "delay_seconds": m.delay_seconds,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "started_at": m.started_at.isoformat() if m.started_at else None,
    }
