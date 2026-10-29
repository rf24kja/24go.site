"""Task dispatch API: trigger Celery workers from the Control Plane.

Uses celery.send_task() to dispatch by name — no import of worker code needed.
"""
import uuid as _uuid
import asyncio
from typing import Annotated, Literal
import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, StringConstraints, model_validator
from celery import Celery

from app.config import settings
from app.models import User
from app.security import get_current_user

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])

# Client-only Celery instance for dispatching (no worker logic loaded)
_celery = Celery(
    "dispatcher",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)


class ParseRequest(BaseModel):
    platforms: list[Literal["telegram", "vkontakte"]] = Field(default=["telegram"], min_length=1, max_length=2)
    target_geos: list[Annotated[str, StringConstraints(min_length=1, max_length=100, pattern=r"\S")]] = Field(..., min_length=1, max_length=3)
    niches: list[Annotated[str, StringConstraints(min_length=1, max_length=100, pattern=r"\S")]] = Field(..., min_length=1, max_length=3)
    max_results_per_niche: int = Field(default=20, ge=1, le=20)

    @model_validator(mode="after")
    def bounded_matrix(self):
        for values in [self.platforms, self.target_geos, self.niches]:
            if len(set(values)) != len(values):
                raise ValueError("Duplicate batch dimensions are not supported")
        if len(self.platforms) * len(self.target_geos) * len(self.niches) > 6:
            raise ValueError("At most six discovery queries per batch")
        return self


class PostRequest(BaseModel):
    campaign_id: str
    target_id: str
    account_id: str


class WarmupRequest(BaseModel):
    account_id: str


@router.post("/parser/discover")
async def dispatch_parser(
    body: ParseRequest,
    current_user: User = Depends(get_current_user),
):
    """Run a bounded synchronous matrix through the accepted discovery path.

    Each query persists independently; no background task or atomic batch is claimed.
    Uses existing free account search, not the separately opted-in paid TGStat path.
    """
    from app.routers.groups import DiscoverRequest, discover_groups

    queries = []
    for platform in body.platforms:
        for geo in body.target_geos:
            for niche in body.niches:
                item = {"platform": platform, "geo_tag": geo, "niche": niche}
                try:
                    found = await asyncio.wait_for(discover_groups(
                        body=DiscoverRequest(platform=platform, geo_tag=geo,
                                             niche=niche, limit=body.max_results_per_niche),
                        current_user=current_user,
                    ), timeout=10)
                    item.update(status="completed", results=found["results"], total=found["total"])
                except TimeoutError:
                    item.update(status="failed", error="query_timeout", persistence_may_be_partial=True)
                except HTTPException as exc:
                    item.update(status="failed", error="discovery_failed", http_status=exc.status_code,
                                persistence_may_be_partial=True)
                except Exception:
                    item.update(status="failed", error="discovery_failed", persistence_may_be_partial=True)
                queries.append(item)
    completed = sum(item["status"] == "completed" for item in queries)
    return {"status": "completed" if completed == len(queries) else "partial" if completed else "failed",
            "queries": queries, "completed_queries": completed, "total_queries": len(queries),
            "execution": "synchronous", "atomic": False}


@router.post("/poster/publish")
async def dispatch_poster(
    body: PostRequest,
    current_user: User = Depends(get_current_user),
):
    """Dispatch a posting task to the poster worker pool."""
    conn_url = settings.DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(conn_url)
    try:
        row = await conn.fetchrow(
            "SELECT base_text, platform, target_geos, target_niches, ab_enabled, ab_variants "
            "FROM campaigns WHERE id = $1 AND tenant_id = $2",
            _uuid.UUID(body.campaign_id),
            current_user.tenant_id,
        )
        if not row:
            raise HTTPException(404, "Campaign not found")
        platform = row["platform"]
        if platform not in ("telegram", "vkontakte"):
            raise HTTPException(400, "Campaign posting is supported only for Telegram and VK")
        import json
        geos = row["target_geos"] or []
        niches = row["target_niches"] or []
        if isinstance(geos, str):
            geos = json.loads(geos)
        if isinstance(niches, str):
            niches = json.loads(niches)
        variants = row["ab_variants"] or []
        if isinstance(variants, str):
            variants = json.loads(variants)
        target = await conn.fetchrow(
            "SELECT target_id_code, platform FROM targets "
            "WHERE id = $1 AND tenant_id = $2 AND platform = $3 AND is_active = true "
            "AND (geo_tag = ANY($4) OR $4 = '{}') "
            "AND (niche = ANY($5) OR $5 = '{}')",
            _uuid.UUID(body.target_id),
            current_user.tenant_id,
            platform, geos, niches,
        )
        if not target:
            raise HTTPException(404, "Matching target not found")
        account = await conn.fetchrow(
            "SELECT id FROM account_pool WHERE id = $1 AND tenant_id = $2 "
            "AND platform = $3 AND status = 'active' "
            "AND actions_today < daily_action_limit",
            _uuid.UUID(body.account_id), current_user.tenant_id, platform,
        )
        if not account:
            raise HTTPException(404, "Available matching account not found")
    finally:
        await conn.close()

    if platform == "vkontakte":
        task = _celery.send_task(
            "app.tasks.vk_poster.post_to_vk",
            kwargs={
                "tenant_id": str(current_user.tenant_id),
                "account_id": body.account_id,
                "group_id": int(target['target_id_code'].removeprefix("vk_")),
                "text": row["base_text"],
                "campaign_id": body.campaign_id,
                "target_id": body.target_id,
                "ab_enabled": row.get("ab_enabled") or False,
                "ab_variants": variants,
            },
            queue="poster",
        )
    else:
        utm_url = f"https://t.me/{target['target_id_code']}?utm_source=leadgen&utm_medium=post&utm_campaign={body.campaign_id}"
        task = _celery.send_task(
            "app.tasks.poster.publish_post",
            args=[
                str(current_user.tenant_id),
                body.campaign_id,
                body.target_id,
                body.account_id,
                row["base_text"],
                utm_url,
                f"@{target['target_id_code']}",
            ],
            queue="poster",
        )
    return {"status": "dispatched", "task_id": task.id}


@router.post("/warmup/run")
async def dispatch_warmup(
    body: WarmupRequest,
    current_user: User = Depends(get_current_user),
):
    """Dispatch a warmup cycle for a specific account."""
    task = _celery.send_task(
        "app.tasks.warmup.run_warmup_cycle",
        args=[str(current_user.tenant_id), body.account_id],
        queue="warmup",
    )
    return {"status": "dispatched", "task_id": task.id}
