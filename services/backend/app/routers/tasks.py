"""Task dispatch API: trigger Celery workers from the Control Plane.

Uses celery.send_task() to dispatch by name — no import of worker code needed.
"""
import uuid as _uuid
import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
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
    platforms: list[str] = Field(default=["telegram"])
    target_geos: list[str] = Field(..., min_length=1)
    niches: list[str] = Field(..., min_length=1)
    max_results_per_niche: int = Field(default=50, le=200)


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
    """Dispatch target discovery tasks to the parser worker pool."""
    tenant_id = str(current_user.tenant_id)
    jobs = []
    for platform in body.platforms:
        for geo in body.target_geos:
            for niche in body.niches:
                task = _celery.send_task(
                    "app.tasks.parser.discover_targets",
                    args=[tenant_id, geo, niche, platform, body.max_results_per_niche],
                    queue="parser",
                )
                jobs.append(task.id)

    return {"status": "dispatched", "task_count": len(jobs), "task_ids": jobs}


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
            "SELECT base_text FROM campaigns WHERE id = $1 AND tenant_id = $2",
            _uuid.UUID(body.campaign_id),
            current_user.tenant_id,
        )
        target = await conn.fetchrow(
            "SELECT target_id_code FROM targets WHERE id = $1 AND tenant_id = $2",
            _uuid.UUID(body.target_id),
            current_user.tenant_id,
        )
    finally:
        await conn.close()

    if not row:
        raise HTTPException(404, "Campaign not found")
    if not target:
        raise HTTPException(404, "Target not found")

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
