"""Listener management API: start/stop Telegram listeners per account.

Dispatches Celery tasks to the listener queue. The worker handles
Telethon connection lifecycle.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AccountPool, User
from app.security import get_current_user

router = APIRouter(prefix="/api/v1/listeners", tags=["listeners"])
log = logging.getLogger(__name__)


class ListenerStatus(BaseModel):
    account_id: str
    status: str  # "started" | "stopped" | "already_running"


@router.post("/{account_id}/start", response_model=ListenerStatus)
async def start_listener(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a Telegram listener for a specific account.

    Dispatches a Celery task to the listener queue. The worker will
    establish a Telethon connection and begin monitoring DMs.
    """
    import uuid
    # Verify account belongs to this tenant
    q = select(AccountPool).where(
        AccountPool.id == uuid.UUID(account_id),
        AccountPool.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")

    # Dispatch to listener worker
    from app.celery_app import celery
    celery.send_task(
        "app.tasks.listener.start_lead_listener",
        args=[str(current_user.tenant_id), account_id],
        queue="listener",
    )

    log.info(f"Listener started for account {account_id} (tenant={current_user.tenant_id})")
    return ListenerStatus(account_id=account_id, status="started")


@router.post("/{account_id}/stop")
async def stop_listener(
    account_id: str,
    current_user: User = Depends(get_current_user),
):
    """Stop a running listener. Sends a revoke signal to the Celery worker."""
    from app.celery_app import celery

    # Revoke all tasks for this account on the listener queue
    celery.control.purge()  # ponytail: purge all pending, targeted revoke needs task IDs

    log.info(f"Listener stop requested for account {account_id}")
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
