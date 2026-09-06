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


# ── Recent Posts ───────────────────────────────────────────────────────

@router.get("/{target_id}/recent-posts")
async def recent_posts(
    target_id: UUID,
    limit: int = Query(default=50, ge=10, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch recent posts from a Telegram channel for comment scraping."""
    import asyncio

    result = await db.execute(
        select(Target).where(Target.id == target_id, Target.tenant_id == current_user.tenant_id)
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "Target not found")

    acct_result = await db.execute(
        select(AccountPool).where(
            AccountPool.tenant_id == current_user.tenant_id,
            AccountPool.status == "active",
        ).limit(1)
    )
    account = acct_result.scalar_one_or_none()
    if not account:
        raise HTTPException(400, "No active Telegram account found")

    # Fetch posts via Telethon in a background thread
    async def _fetch():
        from telethon import TelegramClient
        from telethon.sessions import StringSession
        import os, asyncpg
        from app.crypto import decrypt as dec
        from app.config import settings as cfg

        api_id = int(os.getenv("TG_API_ID", "0"))
        api_hash = os.getenv("TG_API_HASH", "")
        if not api_id or not api_hash:
            return []

        conn = await asyncpg.connect(cfg.DATABASE_URL.replace("+asyncpg", ""))
        try:
            row = await conn.fetchrow(
                "SELECT session_data FROM account_sessions WHERE account_id = $1",
                account.id,
            )
            if not row:
                return []
            session_str = dec(row["session_data"])
        finally:
            await conn.close()

        client = TelegramClient(StringSession(session_str), api_id, api_hash)
        await client.connect()
        try:
            entity = await client.get_entity(target.target_id_code)
            posts = []
            async for msg in client.iter_messages(entity, offset_id=0, add_offset=offset, limit=limit):
                if not msg.text and not msg.media:
                    continue
                comments_count = getattr(msg, 'replies', None)
                replies = comments_count.replies if comments_count else 0
                posts.append({
                    "id": msg.id,
                    "text": (msg.text or "")[:200],
                    "date": msg.date.isoformat() if msg.date else None,
                    "views": getattr(msg, 'views', 0) or 0,
                    "comments": replies,
                })
            return posts
        finally:
            await client.disconnect()

    try:
        posts = await asyncio.wait_for(_fetch(), timeout=30)
    except asyncio.TimeoutError:
        raise HTTPException(504, "Timeout fetching posts — try again")
    except Exception as e:
        log.error(f"Recent posts fetch failed: {e}")
        raise HTTPException(500, f"Failed to fetch posts: {e}")

    return {"posts": posts, "total": len(posts), "offset": offset, "limit": limit}


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
