"""Campaign CRUD, scheduling, and manual posting endpoints."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.audit import log_event
from app.database import get_db
from app.models import Campaign, User
from app.security import get_current_user
from app.schemas import CampaignCreate, CampaignResponse

router = APIRouter(prefix="/api/v1/campaigns", tags=["campaigns"])


@router.get("/")
async def list_campaigns(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Campaign).where(Campaign.tenant_id == current_user.tenant_id, Campaign.is_active == True)
    
    from sqlalchemy import func
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    
    result = await db.execute(q.order_by(Campaign.created_at.desc()).limit(limit).offset(offset))
    return {"items": result.scalars().all(), "total": total, "limit": limit, "offset": offset}


@router.post("/", response_model=CampaignResponse, status_code=201)
async def create_campaign(
    body: CampaignCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = Campaign(
        tenant_id=current_user.tenant_id,
        **body.model_dump(),
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="created", entity_type="campaign",
        entity_id=campaign.id, new_value=body.model_dump(),
        user_id=current_user.id, ip_address=request.client.host if request else None,
    )
    return campaign


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.tenant_id == current_user.tenant_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.delete("/{campaign_id}", status_code=204)
async def delete_campaign(
    campaign_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.tenant_id == current_user.tenant_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.is_active = False
    await db.commit()
    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="deleted", entity_type="campaign",
        entity_id=campaign.id, user_id=current_user.id,
        ip_address=request.client.host if request else None,
    )


class CampaignUpdateRequest(BaseModel):
    name: str | None = None
    base_text: str | None = None
    target_geos: list[str] | None = None
    target_niches: list[str] | None = None
    is_active: bool | None = None
    schedule_cron: str | None = None
    posts_per_day: int | None = None


@router.patch("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: UUID,
    body: CampaignUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a campaign (name, text, geos, niches, schedule)."""
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.tenant_id == current_user.tenant_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Campaign not found")

    old_data = {"name": campaign.name, "is_active": campaign.is_active}
    update_data = body.model_dump(exclude_unset=True)

    # Handle list fields separately (SQLAlchemy column assignment)
    for key, val in update_data.items():
        if key in ("target_geos", "target_niches", "is_active", "schedule_cron", "posts_per_day"):
            setattr(campaign, key, val)
        elif key in ("name", "base_text"):
            setattr(campaign, key, val)

    await db.commit()
    await db.refresh(campaign)

    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="updated", entity_type="campaign",
        entity_id=campaign.id, old_value=old_data, new_value=update_data,
        user_id=current_user.id, ip_address=request.client.host if request else None,
    )
    return campaign


@router.post("/{campaign_id}/run")
async def run_campaign_now(
    campaign_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger a campaign post right now (ignoring cron schedule)."""
    import app.models as _models
    from sqlalchemy import func as _func

    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.tenant_id == current_user.tenant_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Campaign not found")

    # Find a matching target
    target = await db.execute(
        select(_models.Target).where(
            _models.Target.tenant_id == current_user.tenant_id,
            _models.Target.is_active == True,
        ).order_by(_func.random()).limit(1)
    )
    t = target.scalar_one_or_none()
    if not t:
        raise HTTPException(400, "No active targets found. Add targets first.")

    # Find an available account
    acc = await db.execute(
        select(_models.AccountPool).where(
            _models.AccountPool.tenant_id == current_user.tenant_id,
            _models.AccountPool.status == "active",
        ).order_by(_func.random()).limit(1)
    )
    a = acc.scalar_one_or_none()
    if not a:
        raise HTTPException(400, "No active accounts. Connect an account first.")

    # Dispatch to poster worker
    from app.celery_app import celery
    celery.send_task(
        "app.tasks.poster.publish_post",
        args=[
            str(current_user.tenant_id),
            str(campaign.id),
            str(t.id),
            str(a.id),
            campaign.base_text,
            f"https://t.me/{t.target_id_code}?utm_source=leadgen&utm_medium=post&utm_campaign={campaign.id}",
            f"@{t.target_id_code}",
        ],
        queue="poster",
    )

    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="manual_run", entity_type="campaign",
        entity_id=campaign.id, user_id=current_user.id,
        ip_address=request.client.host if request else None,
    )

    return {"status": "dispatched", "campaign_id": str(campaign.id), "target": t.title, "account": a.account_identifier}


class CronPreviewRequest(BaseModel):
    cron: str
    timezone: str = "UTC"


@router.post("/cron-preview")
async def cron_preview(
    body: CronPreviewRequest,
    current_user: User = Depends(get_current_user),
):
    """Preview next 5 cron fire times for a given cron expression + timezone."""
    from zoneinfo import ZoneInfo
    from datetime import datetime, timezone

    if not body.cron:
        return {"runs": []}

    try:
        from croniter import croniter
    except ImportError:
        return {"runs": [], "error": "croniter not installed"}

    try:
        tz = ZoneInfo(body.timezone)
    except Exception:
        tz = ZoneInfo("UTC")

    now = datetime.now(timezone.utc).astimezone(tz)
    cron = croniter(body.cron, now)
    runs = []
    for _ in range(5):
        next_run = cron.get_next(datetime)
        runs.append(next_run.isoformat())

    return {"runs": runs, "timezone": body.timezone, "cron": body.cron}
