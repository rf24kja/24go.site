"""Time-series analytics endpoint for charts.

ponytail: single GROUP BY queries, fill gaps in Python. 
"""
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import case, func, select, text
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


class SourceBreakdown(BaseModel):
    source: str
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
    source_breakdown: list[SourceBreakdown]
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

    # ── Funnel: 5 queries → 2 ───────────────────────────────────────
    # Combined funnel query (leads + hot + warm in one pass)
    funnel_q = await db.execute(
        select(
            func.count(Lead.id).label("total"),
            func.count(case((Lead.intent_score == LeadIntentLevel.HOT, 1))).label("hot"),
            func.count(case((Lead.intent_score == LeadIntentLevel.WARM, 1))).label("warm"),
        ).where(
            Lead.tenant_id == tenant_id,
            Lead.created_at >= since,
        )
    )
    row = funnel_q.one()
    total_leads = row.total
    hot = row.hot
    warm = row.warm

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

    # ── Geo breakdown: 1 query with FILTER ──────────────────────────
    geo_q = await db.execute(
        select(
            Lead.geo_tag,
            func.count(Lead.id).label("leads"),
            func.count(case((Lead.intent_score == LeadIntentLevel.HOT, 1))).label("hot_leads"),
        )
        .where(
            Lead.tenant_id == tenant_id,
            Lead.created_at >= since,
            Lead.geo_tag != "",
        )
        .group_by(Lead.geo_tag)
        .order_by(func.count(Lead.id).desc())
        .limit(10)
    )
    geo_breakdown = [
        GeoBreakdown(geo_tag=r.geo_tag, leads=r.leads, hot_leads=r.hot_leads)
        for r in geo_q.all()
    ]

    # ── Source breakdown: leads by source (dm, comment, group, etc.) ──
    source_q = await db.execute(
        select(
            Lead.source,
            func.count(Lead.id).label("leads"),
            func.count(case((Lead.intent_score == LeadIntentLevel.HOT, 1))).label("hot_leads"),
        )
        .where(
            Lead.tenant_id == tenant_id,
            Lead.created_at >= since,
        )
        .group_by(Lead.source)
        .order_by(func.count(Lead.id).desc())
    )
    source_breakdown = [
        SourceBreakdown(source=r.source or "dm", leads=r.leads, hot_leads=r.hot_leads)
        for r in source_q.all()
    ]

    # ── Time-series: 2 queries (posts + leads) instead of 3×N ──────
    # Leads per day with hot filter
    ts_leads_q = await db.execute(
        select(
            func.date_trunc("day", Lead.created_at).label("day"),
            func.count(Lead.id).label("leads"),
            func.count(case((Lead.intent_score == LeadIntentLevel.HOT, 1))).label("hot"),
        )
        .where(
            Lead.tenant_id == tenant_id,
            Lead.created_at >= since,
        )
        .group_by(text("day"))
        .order_by(text("day"))
    )
    leads_by_day = {r.day.date().isoformat(): (r.leads, r.hot) for r in ts_leads_q.all()}

    # Posts per day
    ts_posts_q = await db.execute(
        select(
            func.date_trunc("day", PostingLog.executed_at).label("day"),
            func.count(PostingLog.id).label("posts"),
        )
        .where(
            PostingLog.tenant_id == tenant_id,
            PostingLog.executed_at >= since,
        )
        .group_by(text("day"))
        .order_by(text("day"))
    )
    posts_by_day = {r.day.date().isoformat(): r.posts for r in ts_posts_q.all()}

    # Fill gaps
    time_series = []
    for day_offset in range(days, -1, -1):
        day = (date.today() - timedelta(days=day_offset)).isoformat()
        leads, hot_count = leads_by_day.get(day, (0, 0))
        time_series.append(TimeSeriesPoint(
            date=day,
            targets=discovered,
            posts=posts_by_day.get(day, 0),
            leads=leads,
            hot_leads=hot_count,
        ))

    # ── Cost aggregates ──────────────────────────────────────────────
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
        source_breakdown=source_breakdown,
        time_series=time_series,
        total_cost_usd=float(total_cost),
        total_tokens=int(total_tokens),
    )
