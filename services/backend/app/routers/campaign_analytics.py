"""Campaign analytics: per-campaign stats + posting logs."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Campaign, Lead, PostingLog, User
from app.security import get_current_user
from app.config import settings

router = APIRouter(prefix="/api/v1/campaigns", tags=["campaigns"])


@router.get("/{campaign_id}/stats")
async def campaign_stats(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get stats for a specific campaign: posting count, leads, intent breakdown."""
    import uuid

    # Verify campaign belongs to tenant
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == uuid.UUID(campaign_id),
            Campaign.tenant_id == current_user.tenant_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Campaign not found")

    # Posts count
    posts_count = await db.execute(
        select(func.count()).select_from(PostingLog).where(
            PostingLog.campaign_id == uuid.UUID(campaign_id),
            PostingLog.tenant_id == current_user.tenant_id,
        )
    )
    total_posts = posts_count.scalar() or 0

    # Posts last 7 days (for chart)
    from datetime import datetime, timezone, timedelta
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    daily_posts = await db.execute(
        select(
            func.date(PostingLog.executed_at).label("day"),
            func.count().label("cnt"),
        ).where(
            PostingLog.campaign_id == uuid.UUID(campaign_id),
            PostingLog.tenant_id == current_user.tenant_id,
            PostingLog.executed_at >= week_ago,
        ).group_by(func.date(PostingLog.executed_at)).order_by(func.date(PostingLog.executed_at))
    )
    posts_by_day = [{"date": str(r.day), "count": r.cnt} for r in daily_posts.all()]

    # Leads matched by campaign geos
    lead_q = select(Lead).where(Lead.tenant_id == current_user.tenant_id)
    if campaign.target_geos:
        lead_q = lead_q.where(Lead.geo_tag.in_(campaign.target_geos))

    lead_result = await db.execute(lead_q)
    leads = lead_result.scalars().all()

    intent_counts = {}
    geo_counts = {}
    for lead in leads:
        intent = lead.intent_score.value if hasattr(lead.intent_score, "value") else str(lead.intent_score)
        intent_counts[intent] = intent_counts.get(intent, 0) + 1
        geo = lead.geo_tag or "unknown"
        geo_counts[geo] = geo_counts.get(geo, 0) + 1

    return {
        "campaign_id": campaign_id,
        "campaign_name": campaign.name,
        "is_active": campaign.is_active,
        "schedule_cron": campaign.schedule_cron,
        "timezone": campaign.timezone,
        "last_posted_at": campaign.last_posted_at.isoformat() if campaign.last_posted_at else None,
        "total_posts": total_posts,
        "posts_by_day": posts_by_day,
        "total_leads": len(leads),
        "intent_breakdown": intent_counts,
        "geo_breakdown": [{"geo": k, "count": v} for k, v in sorted(geo_counts.items(), key=lambda x: -x[1])],
        "hot_leads": intent_counts.get("HOT", 0),
        "warm_leads": intent_counts.get("WARM", 0),
    }


@router.get("/{campaign_id}/logs")
async def campaign_logs(
    campaign_id: str,
    limit: int = Query(default=20, le=settings.MAX_PAGE_SIZE),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get recent posting logs for a campaign."""
    import uuid

    # Verify ownership
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == uuid.UUID(campaign_id),
            Campaign.tenant_id == current_user.tenant_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Campaign not found")

    q = (
        select(PostingLog)
        .where(
            PostingLog.campaign_id == uuid.UUID(campaign_id),
            PostingLog.tenant_id == current_user.tenant_id,
        )
        .order_by(PostingLog.executed_at.desc())
        .limit(limit)
        .offset(offset)
    )
    logs_result = await db.execute(q)
    logs = logs_result.scalars().all()

    return {
        "items": [
            {
                "id": str(log.id),
                "rendered_text": (log.rendered_text or "")[:200],
                "utm_url": log.utm_url,
                "status": log.status,
                "message_id": log.message_id,
                "error_trace": log.error_trace,
                "executed_at": log.executed_at.isoformat() if log.executed_at else None,
            }
            for log in logs
        ],
        "total": limit,
        "limit": limit,
        "offset": offset,
    }
