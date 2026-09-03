"""Group Search API — TgStat-powered group discovery with caching and billing."""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, SearchQueryLog
from app.schemas import (
    SemanticQueryRequest, SemanticQueryResponse,
    GroupSearchRequest, GroupSearchResponse, GroupSearchResult,
)
from app.security import get_current_user
from app.tgstat import (
    search_tgstat, expand_semantic_queries,
    get_cached_results, set_cached_results, parse_tgstat_results,
)
from app.balance import get_or_create_balance, deduct_balance
from app.quota import get_tgstat_cost

router = APIRouter(prefix="/api/v1/group-search", tags=["group-search"])
log = logging.getLogger(__name__)


@router.post("/semantic", response_model=SemanticQueryResponse)
async def semantic_search(
    body: SemanticQueryRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate semantic query combinations from a keyword (FREE)."""
    queries = expand_semantic_queries(body.keyword, body.niche or "general", body.country)
    return SemanticQueryResponse(
        original=body.keyword,
        expanded=queries,
        country=body.country,
    )


@router.post("", response_model=GroupSearchResponse)
async def search_groups(
    body: GroupSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search groups via TgStat API (paid) or return empty (free keyword search)."""
    if not body.use_tgstat:
        return GroupSearchResponse(
            query=body.query,
            results=[],
            total=0,
            cost_kopeks=0,
            cache_hit=False,
            query_type="keyword",
        )

    # Check cache first (24h TTL)
    cached = await get_cached_results(body.query, body.country, db)
    if cached is not None:
        results = cached.get("results", [])
        total = cached.get("total", len(results))
        # Log as cache hit, no deduction
        log_entry = SearchQueryLog(
            tenant_id=current_user.tenant_id,
            query=body.query,
            query_type="tgstat",
            cost_kopeks=0,
            results_count=total,
            cache_hit=True,
        )
        db.add(log_entry)
        await db.flush()
        return GroupSearchResponse(
            query=body.query,
            results=[GroupSearchResult(**r) for r in results],
            total=total,
            cost_kopeks=0,
            cache_hit=True,
            query_type="tgstat",
        )

    # Cache miss — check balance
    from app.models import Tenant
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    plan = tenant.plan.value if tenant else "trial"
    cost = get_tgstat_cost(plan)

    if cost > 0:
        balance = await get_or_create_balance(current_user.tenant_id, db)
        if balance.balance_kopeks < cost:
            raise HTTPException(
                402,
                f"Insufficient balance: need {cost} kopeks, have {balance.balance_kopeks}. "
                "Top up at /api/v1/balance/topup",
            )

    # Call TgStat API
    raw = await search_tgstat(
        query=body.query,
        country=body.country,
        language=body.language,
        peer_type=body.peer_type,
        category=body.category,
        limit=body.limit,
    )

    if raw.get("error"):
        raise HTTPException(502, f"TgStat API error: {raw['error']}")

    parsed = parse_tgstat_results(raw.get("items", []))
    total = raw.get("total", len(parsed))

    # Deduct balance
    if cost > 0:
        ok = await deduct_balance(current_user.tenant_id, cost, db)
        if not ok:
            raise HTTPException(402, "Balance deduction failed")

    # Cache results
    await set_cached_results(body.query, body.country, {"results": parsed, "total": total}, db)

    # Log query
    log_entry = SearchQueryLog(
        tenant_id=current_user.tenant_id,
        query=body.query,
        query_type="tgstat",
        cost_kopeks=cost,
        results_count=total,
        cache_hit=False,
    )
    db.add(log_entry)
    await db.commit()

    return GroupSearchResponse(
        query=body.query,
        results=[GroupSearchResult(**r) for r in parsed],
        total=total,
        cost_kopeks=cost,
        cache_hit=False,
        query_type="tgstat",
    )


@router.get("/stats")
async def search_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search statistics for current tenant."""
    tenant_id = current_user.tenant_id

    # Total queries and spend
    totals = await db.execute(
        select(
            func.count(SearchQueryLog.id).label("total_queries"),
            func.coalesce(func.sum(SearchQueryLog.cost_kopeks), 0).label("total_spent"),
        ).where(SearchQueryLog.tenant_id == tenant_id)
    )
    row = totals.one()

    # Cache hits
    cache_hits = await db.execute(
        select(func.count(SearchQueryLog.id))
        .where(SearchQueryLog.tenant_id == tenant_id, SearchQueryLog.cache_hit == True)
    )
    cache_count = cache_hits.scalar() or 0

    # Breakdown by query_type
    breakdown = await db.execute(
        select(
            SearchQueryLog.query_type,
            func.count(SearchQueryLog.id).label("count"),
            func.coalesce(func.sum(SearchQueryLog.cost_kopeks), 0).label("spent"),
        )
        .where(SearchQueryLog.tenant_id == tenant_id)
        .group_by(SearchQueryLog.query_type)
    )
    by_type = {
        r.query_type: {"count": r.count, "spent_kopeks": r.spent}
        for r in breakdown.all()
    }

    return {
        "total_queries": row.total_queries,
        "total_spent_kopeks": row.total_spent,
        "cache_hits": cache_count,
        "by_type": by_type,
    }
