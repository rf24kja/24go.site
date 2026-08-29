"""Target CRUD endpoints + Comment Scraper trigger."""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.audit import log_event
from app.database import get_db
from app.models import Target, AccountPool, User
from app.security import get_current_user
from app.schemas import TargetCreate, TargetResponse

router = APIRouter(prefix="/api/v1/targets", tags=["targets"])
log = logging.getLogger(__name__)


@router.get("/")
async def list_targets(
    geo_tag: str | None = None,
    niche: str | None = None,
    platform: str | None = None,
    limit: int = Query(default=settings.DEFAULT_PAGE_SIZE, le=settings.MAX_PAGE_SIZE),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Target).where(Target.tenant_id == current_user.tenant_id, Target.is_active == True)
    if geo_tag:
        q = q.where(Target.geo_tag == geo_tag)
    if niche:
        q = q.where(Target.niche == niche)
    if platform:
        q = q.where(Target.platform == platform)
    
    from sqlalchemy import func
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    
    result = await db.execute(q.order_by(Target.created_at.desc()).limit(limit).offset(offset))
    return {"items": result.scalars().all(), "total": total, "limit": limit, "offset": offset}


@router.post("/", response_model=TargetResponse, status_code=201)
async def create_target(
    body: TargetCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = Target(
        tenant_id=current_user.tenant_id,
        **body.model_dump(),
    )
    db.add(target)
    await db.commit()
    await db.refresh(target)
    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="created", entity_type="target",
        entity_id=target.id, new_value=body.model_dump(),
        user_id=current_user.id, ip_address=request.client.host if request else None,
    )
    return target


@router.get("/{target_id}", response_model=TargetResponse)
async def get_target(
    target_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Target).where(Target.id == target_id, Target.tenant_id == current_user.tenant_id)
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    return target


@router.delete("/{target_id}", status_code=204)
async def delete_target(
    target_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Target).where(Target.id == target_id, Target.tenant_id == current_user.tenant_id)
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    target.is_active = False
    await db.commit()
    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="deleted", entity_type="target",
        entity_id=target.id, user_id=current_user.id,
        ip_address=request.client.host if request else None,
    )


# ── Comment Scraper ───────────────────────────────────────────────────

class ScrapeCommentsRequest(BaseModel):
    post_id: str  # Telegram message ID of the post to scrape comments from


@router.post("/{target_id}/scrape-comments")
async def scrape_comments(
    target_id: UUID,
    body: ScrapeCommentsRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger comment scraping on a specific post. Dispatches async Celery task."""
    result = await db.execute(
        select(Target).where(Target.id == target_id, Target.tenant_id == current_user.tenant_id)
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "Target not found")

    # Find an active account with a session for this tenant
    acct_result = await db.execute(
        select(AccountPool).where(
            AccountPool.tenant_id == current_user.tenant_id,
            AccountPool.status == "active",
        ).limit(1)
    )
    account = acct_result.scalar_one_or_none()
    if not account:
        raise HTTPException(400, "No active Telegram account found. Connect an account first.")

    # Dispatch Celery task
    from app.celery_app import celery
    task = celery.send_task(
        "app.tasks.comment_scraper.scrape_comments",
        args=[
            str(current_user.tenant_id),
            str(account.id),
            target.target_id_code,
            body.post_id,
            str(target_id),
        ],
        queue="parser",
    )

    # Update last_parsed_at
    from datetime import datetime, timezone
    target.last_parsed_at = datetime.now(timezone.utc)
    await db.commit()

    log.info(f"Comment scrape dispatched for target {target_id}, post {body.post_id} (task={task.id})")
    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="scrape_comments", entity_type="target",
        entity_id=str(target_id), new_value={"post_id": body.post_id, "task_id": task.id},
        user_id=current_user.id, ip_address=request.client.host if request else None,
    )
    return {"status": "scraping", "task_id": task.id, "target_id": str(target_id)}
