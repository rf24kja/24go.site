"""Listener management API: start/stop Telegram listeners per account.

Dispatches Celery tasks to the listener queue. The worker handles
Telethon connection lifecycle.
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

router = APIRouter(prefix="/api/v1/listeners", tags=["listeners"])
log = logging.getLogger(__name__)

# Track active task IDs per account for targeted revoke
# ponytail: in-memory, single-process. Upgrade to Redis if multi-worker.
_active_tasks: dict[str, str] = {}  # account_id -> task_id


class ListenerStatus(BaseModel):
    account_id: str
    status: str  # "started" | "stopped" | "already_running"


@router.post("/{account_id}/start", response_model=ListenerStatus)
async def start_listener(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a Telegram listener for a specific account."""
    # Verify account belongs to this tenant
    q = select(AccountPool).where(
        AccountPool.id == _uuid.UUID(account_id),
        AccountPool.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")

    # Check if already running
    if account_id in _active_tasks:
        return ListenerStatus(account_id=account_id, status="already_running")

    # Dispatch to listener worker
    from app.celery_app import celery
    task = celery.send_task(
        "app.tasks.listener.start_lead_listener",
        args=[str(current_user.tenant_id), account_id],
        queue="listener",
    )
    _active_tasks[account_id] = task.id

    log.info(f"Listener started for account {account_id} (task={task.id})")
    return ListenerStatus(account_id=account_id, status="started")


@router.post("/{account_id}/stop")
async def stop_listener(
    account_id: str,
    current_user: User = Depends(get_current_user),
):
    """Stop a running listener. Revokes the specific Celery task."""
    task_id = _active_tasks.pop(account_id, None)

    from app.celery_app import celery
    if task_id:
        celery.control.revoke(task_id, terminate=True)
        log.info(f"Revoked task {task_id} for account {account_id}")
    else:
        # No tracked task — try to revoke any task with matching args
        log.warning(f"No tracked task for account {account_id}, cannot targeted revoke")

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

    return {"workers": workers}
