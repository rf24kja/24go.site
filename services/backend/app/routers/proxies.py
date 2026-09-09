"""Proxy Management: CRUD, connectivity test, account assignment, bulk import/assign."""
import logging
import random
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
        select(Proxy).where(Proxy.tenant_id == user.tenant_id).order_by(Proxy.id.desc())
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


# ── Bulk Import ─────────────────────────────────────────────────────

class BulkImportRequest(BaseModel):
    proxies: list[str]  # one URL per line, e.g. ["socks5://u:p@h:1080", "http://u:p@h:8080"]
    geo_location: str | None = None


@router.post("/bulk-import")
async def bulk_import_proxies(body: BulkImportRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Import multiple proxies at once. One URL per entry."""
    created = 0
    skipped = 0
    errors = []

    for url in body.proxies:
        url = url.strip()
        if not url:
            continue
        # Basic validation
        if not url.startswith(("socks4://", "socks5://", "http://", "https://")):
            errors.append(f"{url}: unsupported scheme (use socks4/socks5/http)")
            skipped += 1
            continue

        # Check duplicate
        existing = await db.execute(
            select(Proxy).where(Proxy.tenant_id == user.tenant_id, Proxy.proxy_url == url)
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        proxy = Proxy(
            tenant_id=user.tenant_id,
            proxy_url=url,
            geo_location=body.geo_location,
        )
        db.add(proxy)
        created += 1

    if created:
        await db.commit()

    log.info(f"Bulk import: created={created}, skipped={skipped}, errors={len(errors)}")
    return {"created": created, "skipped": skipped, "errors": errors}


# ── Bulk Assign (random) ───────────────────────────────────────────

class BulkAssignRequest(BaseModel):
    reset_first: bool = False  # if True, unassign all accounts first before random assign


@router.post("/bulk-assign")
async def bulk_assign_proxies(body: BulkAssignRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Randomly assign active proxies to TG accounts. 1 proxy = 1 account.
    If more accounts than proxies, excess accounts stay unassigned.
    If reset_first=True, unassigns all accounts before assigning.
    """
    # Get active proxies
    proxy_result = await db.execute(
        select(Proxy).where(Proxy.tenant_id == user.tenant_id, Proxy.is_active == True)
    )
    proxies = list(proxy_result.scalars().all())
    if not proxies:
        raise HTTPException(400, "No active proxies to assign")

    # Get accounts (all platforms)
    acct_result = await db.execute(
        select(AccountPool).where(
            AccountPool.tenant_id == user.tenant_id,
        )
    )
    accounts = list(acct_result.scalars().all())
    if not accounts:
        raise HTTPException(400, "No accounts found")

    # Optionally reset all assignments first
    if body.reset_first:
        for acct in accounts:
            acct.proxy_id = None

    # Shuffle both lists for random assignment
    random.shuffle(proxies)
    random.shuffle(accounts)

    # Assign: min(proxies, accounts) pairs
    assigned = 0
    for i, acct in enumerate(accounts):
        if i >= len(proxies):
            break
        acct.proxy_id = proxies[i].id
        assigned += 1

    await db.commit()

    log.info(f"Bulk assign: {assigned}/{len(accounts)} accounts got proxies ({len(proxies)} available)")
    return {
        "assigned": assigned,
        "total_accounts": len(accounts),
        "total_proxies": len(proxies),
        "unassigned_accounts": max(0, len(accounts) - len(proxies)),
        "unused_proxies": max(0, len(proxies) - len(accounts)),
    }


# ── Single Assign (stub — actual logic in accounts router) ─────────


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
