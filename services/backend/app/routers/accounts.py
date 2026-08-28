"""Account Pool CRUD endpoints."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.audit import log_event
from app.crypto import encrypt, decrypt
from app.database import get_db
from app.models import AccountPool, User
from app.security import get_current_user
from app.schemas import AccountCreate, AccountResponse

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])


@router.get("/")
async def list_accounts(
    status_filter: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(AccountPool).where(AccountPool.tenant_id == current_user.tenant_id)
    if status_filter:
        q = q.where(AccountPool.status == status_filter)
    
    from sqlalchemy import func
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    
    result = await db.execute(q.order_by(AccountPool.created_at.desc()).limit(limit).offset(offset))
    accounts = result.scalars().all()
    for a in accounts:
        a.session_data = decrypt(a.session_data)
    return {"items": accounts, "total": total, "limit": limit, "offset": offset}


@router.post("/", response_model=AccountResponse, status_code=201)
async def create_account(
    body: AccountCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = AccountPool(
        tenant_id=current_user.tenant_id,
        platform=body.platform,
        account_identifier=body.account_identifier,
        session_data=encrypt(body.session_data),
        device_fingerprint=body.device_fingerprint,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    account.session_data = decrypt(account.session_data)
    await log_event(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        tenant_id=current_user.tenant_id, action="created", entity_type="account",
        entity_id=account.id, new_value={"account_identifier": body.account_identifier, "platform": body.platform},
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
    account.session_data = decrypt(account.session_data)
    return account
