"""Facebook service: cookie connect, marketplace search jobs, snapshots.

Auth model mirrors VK bulk-import: browser cookies (c_user + xs, pasted
from devtools) are stored encrypted in account_sessions; workers inject
them into headless Playwright. No password is ever stored.
"""
import json
import logging
import re
import uuid as _uuid
from datetime import datetime, timezone

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.crypto import encrypt
from app.database import get_db
from app.models import AccountPool, User
from app.security import get_current_user

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/fb", tags=["facebook"])

DATABASE_URL = settings.DATABASE_URL.replace("+asyncpg", "")


class FbConnectRequest(BaseModel):
    profile_name: str = Field(..., min_length=1, max_length=255)
    c_user: str = Field(..., min_length=5, max_length=32)
    xs: str = Field(..., min_length=10, max_length=512)


class MarketplaceSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=200)
    account_id: str | None = None
    location: str = ""
    min_price: float | None = None
    max_price: float | None = None
    bedrooms: int | None = None
    limit: int = Field(default=20, ge=1, le=50)


def _cookies_valid(c_user: str, xs: str) -> bool:
    # ponytail: shape check only — liveness is proven by the worker on
    # first scan (status flips), same as VK token validation principle
    return bool(re.fullmatch(r"\d+", c_user)) and len(xs) >= 10


@router.post("/connect", status_code=201)
async def connect_facebook(
    body: FbConnectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Store an FB session (cookies) for the tenant. Validated on first scan."""
    if not _cookies_valid(body.c_user, body.xs):
        raise HTTPException(400, "Invalid cookies: c_user must be numeric, xs non-empty")

    existing = (await db.execute(
        select(AccountPool).where(
            AccountPool.tenant_id == current_user.tenant_id,
            AccountPool.platform == "facebook",
            AccountPool.account_identifier == body.profile_name,
        )
    )).scalar_one_or_none()

    session_blob = json.dumps({"c_user": body.c_user, "xs": body.xs})
    if existing:
        account = existing
        account.status = "warming_up"
    else:
        account = AccountPool(
            tenant_id=current_user.tenant_id,
            platform="facebook",
            account_identifier=body.profile_name,
            session_data="fb_cookies",  # placeholder, real cookies in account_sessions
            device_fingerprint={},
            status="warming_up",
        )
        db.add(account)
        await db.flush()

    encrypted = encrypt(session_blob)
    # ponytail: SAME session — a separate connection can't see our
    # uncommitted account row (FK violation; same bug as TG/VK imports had)
    row = (await db.execute(
        text("SELECT id FROM account_sessions WHERE account_id = :a"),
        {"a": _uuid.UUID(str(account.id))},
    )).first()
    if row:
        await db.execute(
            text("UPDATE account_sessions SET session_data = :s, updated_at = NOW() WHERE account_id = :a"),
            {"s": encrypted, "a": _uuid.UUID(str(account.id))},
        )
    else:
        await db.execute(
            text("""INSERT INTO account_sessions (id, account_id, session_data, created_at, updated_at)
                   VALUES (gen_random_uuid(), :a, :s, NOW(), NOW())"""),
            {"a": _uuid.UUID(str(account.id)), "s": encrypted},
        )
    await db.commit()
    return {"id": str(account.id), "status": "connected",
            "note": "Session stored. Liveness is verified on the first scan."}


def _get_redis():
    import redis
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


@router.post("/marketplace/search", status_code=202)
async def marketplace_search(
    body: MarketplaceSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Queue an FB Marketplace search job. Poll GET /marketplace/status/{job}."""
    account_id = body.account_id
    if account_id:
        acc = (await db.execute(
            select(AccountPool).where(
                AccountPool.id == _uuid.UUID(account_id),
                AccountPool.tenant_id == current_user.tenant_id,
                AccountPool.platform == "facebook",
            )
        )).scalar_one_or_none()
        if not acc:
            raise HTTPException(404, "Facebook account not found")
    else:
        acc = (await db.execute(
            select(AccountPool).where(
                AccountPool.tenant_id == current_user.tenant_id,
                AccountPool.platform == "facebook",
            ).order_by(AccountPool.created_at)
        )).scalars().first()
        if not acc:
            raise HTTPException(400, "No Facebook account connected — POST /fb/connect first")

    job_id = str(_uuid.uuid4())
    job = {"job_id": job_id, "tenant_id": str(current_user.tenant_id),
           "account_id": str(acc.id), "query": body.query,
           "status": "queued", "done": False, "found": 0, "errors": [],
           "updated_at": datetime.now(timezone.utc).isoformat()}
    try:
        r = _get_redis()
        r.set(f"fb_mp_job:{job_id}", json.dumps(job), ex=3600)
    except Exception as e:
        raise HTTPException(503, f"Job queue unavailable: {e}")

    from app.celery_app import celery
    celery.send_task(
        "app.tasks.fb_marketplace.run_search",
        args=[str(current_user.tenant_id), str(acc.id), job_id, body.model_dump()],
    )
    return {"job_id": job_id, "status": "queued"}


@router.get("/marketplace/status/{job_id}")
async def marketplace_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
):
    """Poll a marketplace search job. Tenant-scoped."""
    try:
        r = _get_redis()
        raw = r.get(f"fb_mp_job:{job_id}")
    except Exception:
        raise HTTPException(503, "Job queue unavailable")
    if not raw:
        raise HTTPException(404, "Unknown or expired job")
    job = json.loads(raw)
    if job.get("tenant_id") != str(current_user.tenant_id):
        raise HTTPException(404, "Unknown or expired job")
    if job.get("status") == "running":
        try:
            updated = datetime.fromisoformat(job.get("updated_at", ""))
            if (datetime.now(timezone.utc) - updated).total_seconds() > 900:
                job["status"] = "failed"
                job["error"] = "worker died mid-search (stale 15 min)"
        except Exception:
            pass
    return job


@router.get("/marketplace/results")
async def marketplace_results(
    query: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Saved marketplace snapshots for a query (newest first)."""
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        rows = await conn.fetch(
            """SELECT title, price, link, image, bedrooms, first_seen, last_seen
               FROM fb_marketplace_snapshots
               WHERE tenant_id = $1 AND query = $2
               ORDER BY last_seen DESC LIMIT $3""",
            _uuid.UUID(str(current_user.tenant_id)), query, min(limit, 200),
        )
        return {"items": [dict(r) for r in rows], "query": query}
    finally:
        await conn.close()
