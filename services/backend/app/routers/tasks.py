"""Task dispatch API: trigger Celery workers from the Control Plane.

Uses celery.send_task() to dispatch by name — no import of worker code needed.
"""
from fastapi import APIRouter, Depends
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
    task = _celery.send_task(
        "app.tasks.poster.publish_post",
        args=[
            str(current_user.tenant_id),
            body.campaign_id,
            body.target_id,
            body.account_id,
            "Check out our {offer|deal|special}! Visit {url|link}",
            "https://example.com",
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
