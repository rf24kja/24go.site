"""Proxy Management: CRUD, connectivity test, account assignment."""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Proxy, AccountPool, User
from app.security import get_current_user

router = APIRouter(prefix="/api/v1/proxies", tags=["proxies"])
log = logging.getLogger(__name__)


class ProxyCreate(BaseModel):
    proxy_url: str  # socks5://user:pass@host:port
    geo_location: str | None = None
    rotation_api_url: str | None = None


class ProxyUpdate(BaseModel):
    proxy_url: str | None = None
    geo_location: str | None = None
    rotation_api_url: str | None = None
    is_active: bool | None = None


class ProxyAssign(BaseModel):
    proxy_id: str | None = None  # UUID or null to unassign


@router.get("/")
async def list_proxies(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Proxy).where(Proxy.tenant_id == user.tenant_id).order_by(Proxy.created_at.desc())
    )
    proxies = result.scalars().all()

    # Get assigned account counts per proxy
    count_q = await db.execute(
        select(AccountPool.proxy_id, func.count(AccountPool.id))
        .where(AccountPool.tenant_id == user.tenant_id, AccountPool.proxy_id.isnot(None))
        .group_by(AccountPool.proxy_id)
    )
    counts = dict(count_q.all())

    items = []
    for p in proxies:
        items.append({
            "id": str(p.id),
            "proxy_url": p.proxy_url,
            "geo_location": p.geo_location or "",
            "rotation_api_url": p.rotation_api_url or "",
            "is_active": p.is_active,
            "last_rotated_at": p.last_rotated_at.isoformat() if p.last_rotated_at else None,
            "assigned_accounts": counts.get(p.id, 0),
        })
    return items


@router.post("/")
async def create_proxy(body: ProxyCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    proxy = Proxy(
        tenant_id=user.tenant_id,
        proxy_url=body.proxy_url,
        geo_location=body.geo_location,
        rotation_api_url=body.rotation_api_url,
    )
    db.add(proxy)
    await db.commit()
    await db.refresh(proxy)
    log.info(f"Proxy created: {proxy.id}")
    return {"id": str(proxy.id), "status": "created"}


@router.put("/{proxy_id}")
async def update_proxy(proxy_id: UUID, body: ProxyUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Proxy).where(Proxy.id == proxy_id, Proxy.tenant_id == user.tenant_id)
    )
    proxy = result.scalar_one_or_none()
    if not proxy:
        raise HTTPException(404, "Proxy not found")

    if body.proxy_url is not None:
        proxy.proxy_url = body.proxy_url
    if body.geo_location is not None:
        proxy.geo_location = body.geo_location
    if body.rotation_api_url is not None:
        proxy.rotation_api_url = body.rotation_api_url
    if body.is_active is not None:
        proxy.is_active = body.is_active

    await db.commit()
    return {"status": "updated"}


@router.delete("/{proxy_id}")
async def delete_proxy(proxy_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Proxy).where(Proxy.id == proxy_id, Proxy.tenant_id == user.tenant_id)
    )
    proxy = result.scalar_one_or_none()
    if not proxy:
        raise HTTPException(404, "Proxy not found")

    # Unassign all accounts using this proxy
    acct_result = await db.execute(
        select(AccountPool).where(AccountPool.proxy_id == proxy_id, AccountPool.tenant_id == user.tenant_id)
    )
    for acct in acct_result.scalars().all():
        acct.proxy_id = None

    await db.delete(proxy)
    await db.commit()
    log.info(f"Proxy deleted: {proxy_id}")
    return {"status": "deleted"}


@router.post("/{proxy_id}/test")
async def test_proxy(proxy_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Test proxy connectivity by attempting a SOCKS connection."""
    result = await db.execute(
        select(Proxy).where(Proxy.id == proxy_id, Proxy.tenant_id == user.tenant_id)
    )
    proxy = result.scalar_one_or_none()
    if not proxy:
        raise HTTPException(404, "Proxy not found")

    try:
        from urllib.parse import urlparse
        import socks
        import socket

        parsed = urlparse(proxy.proxy_url)
        scheme = parsed.scheme.lower()
        host = parsed.hostname
        port = parsed.port or 1080
        username = parsed.username or None
        password = parsed.password or None

        s = socks.socksocket()
        if scheme == "socks5":
            s.set_proxy(socks.SOCKS5, host, port, rdns=True, username=username, password=password)
        elif scheme == "socks4":
            s.set_proxy(socks.SOCKS4, host, port, username=username, password=password)
        elif scheme in ("http", "https"):
            s.set_proxy(socks.HTTP, host, port, rdns=True, username=username, password=password)
        else:
            return {"status": "error", "message": f"Unsupported scheme: {scheme}"}

        s.settimeout(10)
        # Try connecting to Telegram DC
        s.connect(("149.154.175.50", 443))
        s.close()
        return {"status": "ok", "message": f"Connection successful via {scheme}://{host}:{port}"}
    except ImportError:
        return {"status": "error", "message": "pysocks not installed on server"}
    except Exception as e:
        return {"status": "error", "message": str(e)[:200]}


@router.post("/assign")
async def assign_proxy(body: ProxyAssign, account_id: UUID | None = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Assign proxy to an account. Pass account_id as query param."""
    raise HTTPException(400, "Use POST /accounts/{id}/assign-proxy instead")


# ── Account-level proxy assignment (mounted on accounts router via this helper) ──

async def assign_proxy_to_account(account_id: UUID, body: ProxyAssign, db: AsyncSession, user: User):
    """Shared logic for assigning proxy to an account."""
    result = await db.execute(
        select(AccountPool).where(
            AccountPool.id == account_id,
            AccountPool.tenant_id == user.tenant_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")

    if body.proxy_id:
        proxy_result = await db.execute(
            select(Proxy).where(
                Proxy.id == UUID(body.proxy_id),
                Proxy.tenant_id == user.tenant_id,
                Proxy.is_active == True,
            )
        )
        proxy = proxy_result.scalar_one_or_none()
        if not proxy:
            raise HTTPException(404, "Proxy not found or inactive")
        account.proxy_id = proxy.id
    else:
        account.proxy_id = None

    await db.commit()
    return {"status": "updated", "proxy_id": body.proxy_id}
