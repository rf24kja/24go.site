"""Time-series analytics endpoint for charts.

ponytail: single GROUP BY queries, fill gaps in Python.
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import DailyAnalytic, Lead, LeadIntentLevel, PostingLog, Target, User, AccountPool
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
    platform: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregate analytics for the dashboard charts."""
    tenant_id = current_user.tenant_id
    since = date.today() - timedelta(days=days)

    def _pf():
        # ponytail: dashboard sends platform=; honor it or per-platform numbers lie
        if platform in ("telegram", "vkontakte", "whatsapp", "max"):
            return [Lead.platform == platform]
        return []

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
            *_pf(),
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
            *_pf(),
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
            *_pf(),
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
            *_pf(),
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


@router.get("/leaderboard")
async def leaderboard(
    days: int = Query(default=30, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Top campaigns by lead count and HOT conversion rate."""
    from app.models import Campaign

    tenant_id = current_user.tenant_id
    since = date.today() - timedelta(days=days)

    # Get campaigns with lead counts
    result = await db.execute(
        select(
            Campaign.id,
            Campaign.name,
            Campaign.is_active,
            Campaign.schedule_cron,
            Campaign.timezone,
            Campaign.last_posted_at,
        ).where(Campaign.tenant_id == tenant_id, Campaign.is_active == True)
    )
    campaigns = result.all()

    leaderboard = []
    for c in campaigns:
        # Count leads matching this campaign's geos
        # ponytail: per-campaign view stays unfiltered by platform by design
        lead_q = select(
            func.count(Lead.id).label("total"),
            func.count(case((Lead.intent_score == LeadIntentLevel.HOT, 1))).label("hot"),
            func.count(case((Lead.intent_score == LeadIntentLevel.WARM, 1))).label("warm"),
        ).where(
            Lead.tenant_id == tenant_id,
            Lead.created_at >= since,
        )

        # If campaign has target_geos, filter by geo
        geo_result = await db.execute(select(Campaign.target_geos).where(Campaign.id == c.id))
        geos = geo_result.scalar()
        if geos:
            lead_q = lead_q.where(Lead.geo_tag.in_(geos))

        row = (await db.execute(lead_q)).one()
        total = row.total or 0
        hot = row.hot or 0
        warm = row.warm or 0
        conversion = round(hot / total * 100, 1) if total > 0 else 0

        # Posts count
        posts_q = await db.execute(
            select(func.count(PostingLog.id)).where(
                PostingLog.campaign_id == c.id,
                PostingLog.executed_at >= since,
            )
        )
        posts = posts_q.scalar() or 0

        leaderboard.append({
            "campaign_id": str(c.id),
            "name": c.name,
            "is_active": c.is_active,
            "schedule_cron": c.schedule_cron,
            "timezone": c.timezone,
            "last_posted_at": c.last_posted_at.isoformat() if c.last_posted_at else None,
            "total_leads": total,
            "hot_leads": hot,
            "warm_leads": warm,
            "conversion_rate": conversion,
            "total_posts": posts,
        })

    # Sort by total_leads desc, then by hot_leads desc
    leaderboard.sort(key=lambda x: (-x["total_leads"], -x["hot_leads"]))

    return {"leaderboard": leaderboard[:10], "period_days": days}


# ── VK Overview ─────────────────────────────────────────────────────

@router.get("/vk-overview")
async def get_vk_overview(
    days: int = Query(default=30, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """VK-specific overview: account health, lead funnel, recent leads, community performance."""
    tenant_id = current_user.tenant_id
    since = date.today() - timedelta(days=days)

    # Summary stats (VK only)
    leads_q = await db.execute(
        select(
            func.count(Lead.id).label("total"),
            func.count(case((Lead.intent_score == LeadIntentLevel.HOT, 1))).label("hot"),
            func.count(case((Lead.intent_score == LeadIntentLevel.WARM, 1))).label("warm"),
            func.count(case((Lead.status == "converted", 1))).label("converted"),
        ).where(
            Lead.tenant_id == tenant_id,
            Lead.platform == "vkontakte",
            Lead.created_at >= since,
        )
    )
    row = leads_q.one()
    total_leads = row.total or 0
    hot_leads = row.hot or 0
    converted = row.converted or 0
    conversion_rate = round(converted / total_leads * 100, 1) if total_leads > 0 else 0

    # Account health
    accounts_q = await db.execute(
        select(AccountPool).where(
            AccountPool.tenant_id == tenant_id,
            AccountPool.platform == "vkontakte",
        )
    )
    accounts = accounts_q.scalars().all()
    active_accounts = sum(1 for a in accounts if a.status == "active")

    account_health = []
    for a in accounts:
        fp = a.device_fingerprint or {}
        account_health.append({
            "id": str(a.id),
            "group_name": fp.get("group_name", f"Group {a.account_identifier}"),
            "group_id": a.account_identifier,
            "members_count": fp.get("members_count", 0),
            "status": a.status,
            "warmup_stage": a.warmup_stage or 1,
            "actions_today": a.actions_today or 0,
            "daily_action_limit": a.daily_action_limit or 30,
        })

    # Recent leads (last 10)
    recent_q = await db.execute(
        select(Lead).where(
            Lead.tenant_id == tenant_id,
            Lead.platform == "vkontakte",
        ).order_by(Lead.created_at.desc()).limit(10)
    )
    recent_leads = [
        {
            "id": str(lead.id),
            "user_handle": lead.user_handle,
            "intent_score": lead.intent_score,
            "source": lead.source,
            "status": lead.status,
            "created_at": lead.created_at.isoformat() if lead.created_at else None,
        }
        for lead in recent_q.scalars().all()
    ]

    # Community performance (group by target)
    # Community performance (group by target).
    # ponytail: Lead has no target_name column — join Target for the title.
    community_q = await db.execute(
        select(
            Target.title.label("target_name"),
            func.count(Lead.id).label("leads"),
            func.count(case((Lead.intent_score == LeadIntentLevel.HOT, 1))).label("hot"),
        ).where(
            Lead.tenant_id == tenant_id,
            Lead.platform == "vkontakte",
            Lead.created_at >= since,
            Lead.target_id.isnot(None),
        ).join(Target, Target.id == Lead.target_id)
        .group_by(Target.title)
        .order_by(func.count(Lead.id).desc())
        .limit(10)
    )
    communities = [
        {"name": r.target_name, "leads": r.leads, "hot": r.hot}
        for r in community_q.all()
    ]

    return {
        "summary": {
            "total_leads": total_leads,
            "hot_leads": hot_leads,
            "warm_leads": row.warm or 0,
            "active_accounts": active_accounts,
            "total_accounts": len(accounts),
            "conversion_rate": conversion_rate,
        },
        "account_health": account_health,
        "recent_leads": recent_leads,
        "communities": communities,
    }
