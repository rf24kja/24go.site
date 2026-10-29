"""Listener management API: start/stop listeners per account (Telegram or VK).

Dispatches Celery tasks to the appropriate queue. The worker handles
connection lifecycle.
"""
import logging
import uuid as _uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AccountPool, User
from app.security import get_current_user
from app.config import settings

router = APIRouter(prefix="/api/v1/listeners", tags=["listeners"])
log = logging.getLogger(__name__)


def _get_redis():
    import redis.asyncio as aioredis
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)


class ListenerStatus(BaseModel):
    account_id: str
    status: str  # "queued" | "stopped" | "already_running"


@router.post("/{account_id}/start", response_model=ListenerStatus)
async def start_listener(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a listener for a specific account (Telegram or VK)."""
    # Verify account belongs to this tenant
    try:
        aid = _uuid.UUID(account_id)
    except ValueError:
        raise HTTPException(404, "Account not found")
    q = select(AccountPool).where(
        AccountPool.id == aid,
        AccountPool.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")

    account_id = str(aid)
    platform = account.platform.value if hasattr(account.platform, 'value') else str(account.platform)

    # Check if already running via Redis
    r = _get_redis()
    try:
        existing = await r.get(f"listener_task:{account_id}")
        if existing:
            return ListenerStatus(account_id=account_id, status="already_running")

        # Dispatch to appropriate listener worker
        from app.celery_app import celery
        if platform == "vkontakte":
            try:
                vk_gid = int(account.account_identifier)
            except (ValueError, TypeError):
                raise HTTPException(422, "VK community ID must be positive")
            if vk_gid <= 0:
                raise HTTPException(422, "VK community ID must be positive")
            task = celery.send_task(
                "app.tasks.vk_listener.start_vk_listener",
                kwargs={"tenant_id": str(current_user.tenant_id), "account_id": account_id, "group_id": vk_gid},
                queue="listener",
            )
        elif platform == "max":
            task = celery.send_task(
                "app.tasks.max_listener.start_max_listener",
                args=[str(current_user.tenant_id), account_id],
                queue="listener",
            )
        else:
            task = celery.send_task(
                "app.tasks.listener.start_lead_listener",
                args=[str(current_user.tenant_id), account_id],
                queue="listener",
            )
        await r.set(f"listener_task:{account_id}", task.id, ex=86400)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Listener operation failed; retry later")
    finally:
        await r.aclose()

    log.info(f"{platform} listener queued for account {account_id} (task={task.id})")
    return ListenerStatus(account_id=account_id, status="queued")


@router.post("/{account_id}/stop")
async def stop_listener(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stop a running listener owned by this tenant."""
    try:
        aid = _uuid.UUID(account_id)
    except ValueError:
        raise HTTPException(404, "Account not found")
    result = await db.execute(select(AccountPool).where(
        AccountPool.id == aid,
        AccountPool.tenant_id == current_user.tenant_id,
    ))
    if result.scalar_one_or_none() is None:
        raise HTTPException(404, "Account not found")
    account_id = str(aid)
    r = _get_redis()
    try:
        task_id = await r.get(f"listener_task:{account_id}")
        if task_id:
            await r.delete(f"listener_task:{account_id}")

        from app.celery_app import celery
        if task_id:
            celery.control.revoke(task_id, terminate=True)
            log.info(f"Revoked task {task_id} for account {account_id}")
        else:
            log.warning(f"No tracked task for account {account_id}, cannot targeted revoke")
    finally:
        await r.aclose()

    return {"status": "stopped", "account_id": account_id}


@router.get("/status")
async def listener_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get active listeners owned by the current tenant, without host metadata."""
    workers = []

    result = await db.execute(select(AccountPool.id).where(
        AccountPool.tenant_id == current_user.tenant_id,
    ))
    account_ids = result.scalars().all()
    r = _get_redis()
    try:
        active_workers = []
        for account_id in account_ids:
            aid = str(account_id)
            tid = await r.get(f"listener_task:{aid}")
            if tid:
                active_workers.append({"account_id": aid, "task_id": tid, "status": "active"})
    finally:
        await r.aclose()

    return {"workers": workers, "active_workers": active_workers}
