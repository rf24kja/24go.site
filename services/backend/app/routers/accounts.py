"""Account Pool CRUD endpoints."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.audit import log_event
from app.database import get_db
from app.models import AccountPool, User
from app.security import get_current_user
from app.schemas import AccountCreate, AccountResponse

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])


@router.get("/", response_model=list[AccountResponse])
async def list_accounts(
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(AccountPool).where(AccountPool.tenant_id == current_user.tenant_id)
    if status_filter:
        q = q.where(AccountPool.status == status_filter)
    result = await db.execute(q.order_by(AccountPool.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=AccountResponse, status_code=201)
async def create_account(
    body: AccountCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = AccountPool(
        tenant_id=current_user.tenant_id,
        **body.model_dump(),
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="created", entity_type="account",
        entity_id=account.id, new_value=body.model_dump(),
        user_id=current_user.id, ip_address=request.client.host if request else None,
    )
    return account


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AccountPool).where(
            AccountPool.id == account_id,
            AccountPool.tenant_id == current_user.tenant_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account
