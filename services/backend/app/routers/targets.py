"""Target CRUD endpoints."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.audit import log_event
from app.database import get_db
from app.models import Target, User
from app.security import get_current_user
from app.schemas import TargetCreate, TargetResponse

router = APIRouter(prefix="/api/v1/targets", tags=["targets"])


@router.get("/")
async def list_targets(
    geo_tag: str | None = None,
    niche: str | None = None,
    platform: str | None = None,
    limit: int = Query(default=50, le=200),
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
