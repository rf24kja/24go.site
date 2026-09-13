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
    status: str  # "started" | "stopped" | "already_running"


@router.post("/{account_id}/start", response_model=ListenerStatus)
async def start_listener(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a listener for a specific account (Telegram or VK)."""
    # Verify account belongs to this tenant
    q = select(AccountPool).where(
        AccountPool.id == _uuid.UUID(account_id),
        AccountPool.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")

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
            from app.tasks.vk_listener import start_vk_listener
            vk_gid = int(account.account_identifier) if account.account_identifier else 0
            task = start_vk_listener.apply_async(
                args=[str(current_user.tenant_id), account_id, vk_gid],
            )
        else:
            task = celery.send_task(
                "app.tasks.listener.start_lead_listener",
                args=[str(current_user.tenant_id), account_id],
                queue="listener",
            )
        await r.set(f"listener_task:{account_id}", task.id, ex=86400)
    finally:
        await r.aclose()

    log.info(f"{platform} listener started for account {account_id} (task={task.id})")
    return ListenerStatus(account_id=account_id, status="started")


@router.post("/{account_id}/stop")
async def stop_listener(
    account_id: str,
    current_user: User = Depends(get_current_user),
):
    """Stop a running listener. Revokes the specific Celery task."""
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
):
    """Get status of all active Celery workers on the listener queue."""
    from app.celery_app import celery

    inspect = celery.control.inspect(destination=["worker-listener"], timeout=2)
    active = inspect.active() or {}
    stats = inspect.stats() or {}

    workers = []
    for name, info in stats.items():
        pool = info.get("pool", {})
        workers.append({
            "worker": name,
            "pool_size": pool.get("implementation"),
            "active_tasks": len(active.get(name, [])),
            "pid": info.get("pid"),
        })

    # Get active listeners from Redis
    r = _get_redis()
    try:
        keys = await r.keys("listener_task:*")
        active_workers = []
        for key in keys:
            aid = key.split(":", 1)[1]
            tid = await r.get(key)
            active_workers.append({"account_id": aid, "task_id": tid, "status": "active"})
    finally:
        await r.aclose()

    return {"workers": workers, "active_workers": active_workers}
