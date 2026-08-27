"""Tenant CRUD endpoints."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Tenant, User
from app.security import get_current_user
from app.schemas import TenantCreate, TenantResponse

router = APIRouter(prefix="/api/v1/tenants", tags=["tenants"])


@router.get("/", response_model=list[TenantResponse])
async def list_tenants(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    return result.scalars().all()


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if str(tenant_id) != str(current_user.tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.patch("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: UUID,
    body: TenantCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if str(tenant_id) != str(current_user.tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant.company_name = body.company_name
    await db.commit()
    await db.refresh(tenant)
    return tenant
