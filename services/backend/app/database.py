"""Database engine and session factory with RLS support."""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from fastapi import Request

from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_size=20, max_overflow=10)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db(request: Request = None):
    """Yield a session with RLS tenant context set if available.

    The middleware stores tenant_id on request.state; this sets the
    PostgreSQL session variable that RLS policies reference.
    """
    async with async_session() as session:
        tenant_id = None
        if request is not None:
            tenant_id = getattr(request.state, "tenant_id", None)
        if tenant_id:
            await session.execute(
                text("SET LOCAL app.current_tenant = :tid"),
                {"tid": str(tenant_id)},
            )
        yield session
