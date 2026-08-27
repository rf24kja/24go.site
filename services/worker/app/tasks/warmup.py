"""Warmup tasks: 3-stage account lifecycle management.

Queue: warmup_tasks
Concurrency: Distributed Cron Batch
Retry: 1 retry
Timeout: 180s

Stages:
  Stage 1 (Days 1-3): Passive — read feeds, emoji reactions, 0 commercial actions
  Stage 2 (Days 4-7): Soft engagement — join groups, non-commercial comments, max 5/day
  Stage 3 (Day 8+):   Production — full posting unlocked, 15-25/day
"""
import logging
from datetime import datetime, timezone

from celery import shared_task

from app.celery_app import celery
from app.locks import acquire_account_lock, increment_daily_actions
from app.config import WARMUP_LIMITS

log = logging.getLogger(__name__)


STAGE_DESCRIPTIONS = {
    1: "passive trust building — read feeds, emoji reactions",
    2: "soft engagement — join groups, non-commercial comments",
    3: "production ready — full commercial posting",
}


@celery.task(name="app.tasks.warmup.run_warmup_cycle", bind=True, queue="warmup", max_retries=1)
def run_warmup_cycle(self, tenant_id: str, account_id: str):
    """Execute one warmup cycle for an account based on its current stage.

    Acquires per-account lock to prevent concurrent warmup + posting.
    """
    with acquire_account_lock(tenant_id, account_id, lock_timeout=180) as locked:
        if not locked:
            log.warning(f"Warmup skipped: account {account_id} locked")
            return {"status": "skipped", "reason": "lock_active"}

        log.info(f"warmup_cycle: tenant={tenant_id} account={account_id}")

        # TODO: Query account_pool for current warmup_stage and age
        # For now, simulate stage progression
        stage = 1  # Would be read from DB
        actions_limit = WARMUP_LIMITS.get(stage, 0)

        if stage == 1:
            # Stage 1: Read 5 neutral channels, leave emoji reactions
            log.info(f"Stage 1: Passive trust building for {account_id}")
            actions = 0
            # Simulate reading channels
            for _ in range(5):
                increment_daily_actions(tenant_id, account_id)
                actions += 1
            return {"status": "completed", "stage": 1, "actions": actions, "description": STAGE_DESCRIPTIONS[1]}

        elif stage == 2:
            # Stage 2: Join 2 neutral groups, write non-commercial comments
            log.info(f"Stage 2: Soft engagement for {account_id}")
            actions = 0
            for _ in range(2):
                increment_daily_actions(tenant_id, account_id)
                actions += 1
            return {"status": "completed", "stage": 2, "actions": actions, "description": STAGE_DESCRIPTIONS[2]}

        elif stage == 3:
            # Stage 3: Full production — no warmup actions needed, just reset counters
            log.info(f"Stage 3: Production ready for {account_id}")
            return {"status": "completed", "stage": 3, "actions": 0, "description": STAGE_DESCRIPTIONS[3]}


@celery.task(name="app.tasks.warmup.trigger_daily_warmup", queue="warmup")
def trigger_daily_warmup():
    """Triggered by Beat at 08:00 UTC daily. Scans all warming_up accounts."""
    log.info("trigger_daily_warmup: triggered by Beat scheduler")
    # TODO: Query account_pool WHERE status='warming_up', dispatch run_warmup_cycle per account
    return {"status": "triggered"}


@celery.task(name="app.tasks.warmup.handle_flood_wait", queue="warmup")
def handle_flood_wait(tenant_id: str, account_id: str, wait_seconds: int = 14400):
    """Handle FLOOD_WAIT errors: set cooldown, rotate proxy."""
    log.warning(f"FLOOD_WAIT on account {account_id}, cooldown {wait_seconds}s")
    # TODO: UPDATE account_pool SET status='cooldown', cooldown_until=NOW()+wait
    return {"status": "cooldown_set", "account_id": account_id, "cooldown_seconds": wait_seconds}
