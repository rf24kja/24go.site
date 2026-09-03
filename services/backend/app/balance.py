"""Shared balance helpers — used by routers/balance.py and routers/group_search.py."""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserBalance


async def get_or_create_balance(tenant_id: uuid.UUID, db: AsyncSession) -> UserBalance:
    """Get or create balance for tenant."""
    result = await db.execute(
        select(UserBalance).where(UserBalance.tenant_id == tenant_id)
    )
    balance = result.scalar_one_or_none()
    if not balance:
        balance = UserBalance(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            balance_kopeks=0,
            total_spent_kopeks=0,
            total_queries=0,
        )
        db.add(balance)
        await db.flush()
    return balance


async def deduct_balance(tenant_id: uuid.UUID, cost_kopeks: int, db: AsyncSession) -> bool:
    """Deduct from balance. Returns True if successful."""
    balance = await get_or_create_balance(tenant_id, db)
    if balance.balance_kopeks < cost_kopeks:
        return False
    balance.balance_kopeks -= cost_kopeks
    balance.total_spent_kopeks += cost_kopeks
    balance.total_queries += 1
    await db.flush()
    return True
