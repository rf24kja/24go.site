"""Time-series analytics endpoint for charts."""
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import DailyAnalytic, Lead, LeadIntentLevel, PostingLog, Target, User
from app.security import get_current_user

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


class FunnelResponse(BaseModel):
    discovered_targets: int
    published_posts: int
    leads_captured: int
    hot_leads: int
    warm_leads: int


class GeoBreakdown(BaseModel):
    geo_tag: str
    leads: int
    hot_leads: int


class TimeSeriesPoint(BaseModel):
    date: str
    targets: int
    posts: int
    leads: int
    hot_leads: int


class AnalyticsResponse(BaseModel):
    funnel: FunnelResponse
    geo_breakdown: list[GeoBreakdown]
    time_series: list[TimeSeriesPoint]
    total_cost_usd: float
    total_tokens: int


@router.get("/", response_model=AnalyticsResponse)
async def get_analytics(
    days: int = Query(default=30, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregate analytics for the dashboard charts."""
    tenant_id = current_user.tenant_id
    since = date.today() - timedelta(days=days)

    # Funnel metrics
    targets_q = await db.execute(
        select(func.count(Target.id)).where(
            Target.tenant_id == tenant_id, Target.is_active == True
        )
    )
    discovered = targets_q.scalar() or 0

    posts_q = await db.execute(
        select(func.count(PostingLog.id)).where(
            PostingLog.tenant_id == tenant_id,
            PostingLog.executed_at >= since,
        )
    )
    published = posts_q.scalar() or 0

    leads_q = await db.execute(
        select(func.count(Lead.id)).where(
            Lead.tenant_id == tenant_id,
            Lead.created_at >= since,
        )
    )
    total_leads = leads_q.scalar() or 0

    hot_q = await db.execute(
        select(func.count(Lead.id)).where(
            Lead.tenant_id == tenant_id,
            Lead.intent_score == LeadIntentLevel.HOT,
            Lead.created_at >= since,
        )
    )
    hot = hot_q.scalar() or 0

    warm_q = await db.execute(
        select(func.count(Lead.id)).where(
            Lead.tenant_id == tenant_id,
            Lead.intent_score == LeadIntentLevel.WARM,
            Lead.created_at >= since,
        )
    )
    warm = warm_q.scalar() or 0

    # Geo breakdown
    geo_q = await db.execute(
        select(Lead.geo_tag, func.count(Lead.id).label("leads"))
        .where(
            Lead.tenant_id == tenant_id,
            Lead.created_at >= since,
            Lead.geo_tag != "",
        )
        .group_by(Lead.geo_tag)
        .order_by(func.count(Lead.id).desc())
        .limit(10)
    )
    geo_rows = geo_q.all()

    geo_breakdown = []
    for row in geo_rows:
        hot_geo_q = await db.execute(
            select(func.count(Lead.id)).where(
                Lead.tenant_id == tenant_id,
                Lead.geo_tag == row.geo_tag,
                Lead.intent_score == LeadIntentLevel.HOT,
                Lead.created_at >= since,
            )
        )
        geo_breakdown.append(GeoBreakdown(
            geo_tag=row.geo_tag,
            leads=row.leads,
            hot_leads=hot_geo_q.scalar() or 0,
        ))

    # Time-series: daily aggregation
    time_series = []
    for day_offset in range(days, -1, -1):
        day = date.today() - timedelta(days=day_offset)
        next_day = day + timedelta(days=1)

        day_posts_q = await db.execute(
            select(func.count(PostingLog.id)).where(
                PostingLog.tenant_id == tenant_id,
                PostingLog.executed_at >= day,
                PostingLog.executed_at < next_day,
            )
        )
        day_leads_q = await db.execute(
            select(func.count(Lead.id)).where(
                Lead.tenant_id == tenant_id,
                Lead.created_at >= day,
                Lead.created_at < next_day,
            )
        )
        day_hot_q = await db.execute(
            select(func.count(Lead.id)).where(
                Lead.tenant_id == tenant_id,
                Lead.intent_score == LeadIntentLevel.HOT,
                Lead.created_at >= day,
                Lead.created_at < next_day,
            )
        )
        time_series.append(TimeSeriesPoint(
            date=day.isoformat(),
            targets=discovered,
            posts=day_posts_q.scalar() or 0,
            leads=day_leads_q.scalar() or 0,
            hot_leads=day_hot_q.scalar() or 0,
        ))

    # Cost aggregates
    cost_q = await db.execute(
        select(
            func.coalesce(func.sum(DailyAnalytic.llm_tokens_spent), 0),
        ).where(
            DailyAnalytic.tenant_id == tenant_id,
            DailyAnalytic.date >= since,
        )
    )
    total_tokens = cost_q.scalar() or 0

    try:
        from sqlalchemy import text
        usage_q = await db.execute(
            text("SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM usage_logs WHERE tenant_id = :tid AND created_at >= :since"),
            {"tid": tenant_id, "since": str(since)},
        )
        total_cost = usage_q.scalar() or 0
    except Exception:
        total_cost = 0

    return AnalyticsResponse(
        funnel=FunnelResponse(
            discovered_targets=discovered,
            published_posts=published,
            leads_captured=total_leads,
            hot_leads=hot,
            warm_leads=warm,
        ),
        geo_breakdown=geo_breakdown,
        time_series=time_series,
        total_cost_usd=float(total_cost),
        total_tokens=int(total_tokens),
    )
