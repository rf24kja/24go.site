"""Campaign analytics: per-campaign stats."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Campaign, Lead, User
from app.security import get_current_user

router = APIRouter(prefix="/api/v1/campaigns", tags=["campaigns"])


@router.get("/{campaign_id}/stats")
async def campaign_stats(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get stats for a specific campaign: lead count, intent breakdown, geo breakdown."""
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

    # Get leads for this campaign (matched by geo + niche tags)
    lead_q = select(Lead).where(Lead.tenant_id == current_user.tenant_id)

    # Filter by campaign geos if set
    if campaign.target_geos:
        lead_q = lead_q.where(Lead.geo_tag.in_(campaign.target_geos))

    lead_result = await db.execute(lead_q)
    leads = lead_result.scalars().all()

    # Intent breakdown
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
        "total_leads": len(leads),
        "intent_breakdown": intent_counts,
        "geo_breakdown": [{"geo": k, "count": v} for k, v in sorted(geo_counts.items(), key=lambda x: -x[1])],
        "hot_leads": intent_counts.get("HOT", 0),
        "warm_leads": intent_counts.get("WARM", 0),
    }
