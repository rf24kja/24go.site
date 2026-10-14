"""Warmup tasks: 3-stage account lifecycle management via Telethon.

Queue: warmup_tasks
Concurrency: Distributed Cron Batch
Retry: 1 retry
Timeout: 180s

Stages:
  Stage 1 (Days 1-3): Passive — read feeds, emoji reactions, 0 commercial actions
  Stage 2 (Days 4-7): Soft engagement — join groups, non-commercial comments
  Stage 3 (Day 8+):   Production — full posting unlocked, 15-25/day

Uses telegram_client.py factory for session management.
"""
import asyncio
import logging
import random
import uuid as uuid_mod
from datetime import datetime, timezone, timedelta

from celery import shared_task

from app.celery_app import celery
from app.locks import acquire_account_lock, increment_daily_actions
from app.config import WARMUP_LIMITS
from app.telegram_client import disconnect_client
from app.db_pool import fetchrow as pool_fetchrow, fetch as pool_fetch, execute as pool_execute

log = logging.getLogger(__name__)

STAGE_DESCRIPTIONS = {
    1: "passive trust building — read feeds, emoji reactions",
    2: "soft engagement — join groups, non-commercial comments",
    3: "production ready — full commercial posting",
}

# Defaults — overridden by tenant_settings["warmup"] if configured
WARMUP_CHANNELS = [
    "https://t.me/s/ru2ch",
    "https://t.me/s/pikabu",
    "https://t.me/s/born2chat",
]

WARMUP_REACTIONS = ["👍", "❤️", "🔥", "😊", "👀"]


@celery.task(name="app.tasks.warmup.run_warmup_cycle", bind=True,
             queue="warmup", max_retries=1)
def run_warmup_cycle(self, tenant_id: str, account_id: str):
    """Execute one warmup cycle for an account based on its current stage.

    Reads stage from DB, performs real Telethon actions.
    """
    try:
        uuid_mod.UUID(account_id)
        uuid_mod.UUID(tenant_id)
    except ValueError:
        log.warning(f"Invalid id format: tenant={tenant_id} account={account_id}, skipping")
        return {"status": "skipped", "reason": "invalid_uuid"}

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(
            _run_warmup(tenant_id, account_id)
        )
    finally:
        loop.close()
    return result


async def _run_warmup(tenant_id: str, account_id: str) -> dict:
    """Run warmup actions via Telethon."""
    from app.telegram_client import get_client, _set_status
    from app.tenant_settings import get_tenant_settings_from_db

    # Load tenant settings
    warmup_cfg = (await get_tenant_settings_from_db(tenant_id, service="telegram")).get("warmup", {})
    channels = warmup_cfg.get("channels", WARMUP_CHANNELS)
    reactions = warmup_cfg.get("reactions", WARMUP_REACTIONS)
    stage1_days = warmup_cfg.get("stage1_days", 3)
    stage2_days = warmup_cfg.get("stage2_days", 4)
    stage1_limit = warmup_cfg.get("stage1_actions_per_day", 5)
    stage2_limit = warmup_cfg.get("stage2_actions_per_day", 10)
    delay_min = warmup_cfg.get("random_delay_min_sec", 2)
    delay_max = warmup_cfg.get("random_delay_max_sec", 8)

    # Read current stage from DB
    row = await pool_fetchrow(
        "SELECT warmup_stage, status, created_at FROM account_pool WHERE id = $1",
        _uuid(account_id),
    )
    if not row:
        return {"status": "error", "error": "account not found"}

    stage = row["warmup_stage"] or 1
    account_status = row["status"]
    created_at = row["created_at"]

    if account_status == "cooldown":
        return {"status": "skipped", "reason": "cooldown"}
    if account_status == "banned":
        return {"status": "skipped", "reason": "banned"}

    # Auto-advance stage based on tenant-configured durations
    age_days = (datetime.now(timezone.utc) - created_at).days if created_at else 0
    if stage == 1 and age_days >= stage1_days:
        stage = 2
        await _update_stage(account_id, stage)
        log.info(f"Account {account_id} advanced to Stage 2 after {age_days} days")
    elif stage == 2 and age_days >= (stage1_days + stage2_days):
        stage = 3
        await _update_stage(account_id, stage)
        log.info(f"Account {account_id} advanced to Stage 3 after {age_days} days")

    if stage == 3:
        return {"status": "completed", "stage": 3, "actions": 0,
                "description": STAGE_DESCRIPTIONS[3]}

    client = await get_client(account_id)
    if client is None:
        return {"status": "error", "error": "no_session"}

    actions = 0
    try:
        if stage == 1:
            # Stage 1: Read channels, leave reactions
            log.info(f"Stage 1 warmup: passive reading for {account_id}")
            for channel_url in channels[:3]:
                # ponytail: stage limits were loaded but never enforced —
                # lowering them in settings did nothing. Enforced now.
                if actions >= stage1_limit:
                    break
                try:
                    await client.get_messages(channel_url, limit=3)
                    actions += 1
                    await asyncio.sleep(random.uniform(delay_min, delay_max))
                except Exception as e:
                    log.warning(f"Read channel failed: {e}")
                    continue

            # Leave 1-2 reactions on recent posts
            try:
                messages = await client.get_messages(channels[0], limit=5)
                for msg in messages[:2]:
                    if actions >= stage1_limit:
                        break
                    if msg.reactions is not None:
                        emoji = random.choice(reactions)
                        await client.send_reaction(msg, emoji)
                        actions += 1
                        await asyncio.sleep(random.uniform(delay_min, delay_max * 2))
            except Exception as e:
                log.warning(f"Reaction failed: {e}")

        elif stage == 2:
            # Stage 2: Read + join a neutral group
            log.info(f"Stage 2 warmup: soft engagement for {account_id}")
            for channel_url in channels[:2]:
                if actions >= stage2_limit:
                    break
                try:
                    await client.get_messages(channel_url, limit=3)
                    actions += 1
                    await asyncio.sleep(random.uniform(delay_min, delay_max))
                except Exception:
                    continue

            # Join a neutral group
            if actions < stage2_limit:
                try:
                    entity = await client.get_entity(channels[1] if len(channels) > 1 else channels[0])
                    await client.join_chat(entity)
                    actions += 1
                    await asyncio.sleep(random.uniform(delay_min * 2, delay_max * 2))
                except Exception as e:
                    if "already" not in str(e).lower():
                        log.warning(f"Join failed: {e}")

    except Exception as e:
        log.error(f"Warmup actions failed: {e}")
    finally:
        await disconnect_client(account_id)

    # Update daily action count
    for _ in range(actions):
        increment_daily_actions(tenant_id, account_id)

    log.info(f"Warmup completed: stage={stage} actions={actions}")
    return {"status": "completed", "stage": stage, "actions": actions,
            "description": STAGE_DESCRIPTIONS.get(stage, "unknown")}


async def _update_stage(account_id: str, new_stage: int):
    """Update warmup stage in DB."""
    await pool_execute(
        "UPDATE account_pool SET warmup_stage = $1 WHERE id = $2",
        new_stage, _uuid(account_id),
    )


@celery.task(name="app.tasks.warmup.trigger_daily_warmup", queue="warmup")
def trigger_daily_warmup():
    """Triggered by Beat at 08:00 UTC daily. Scans all warming_up accounts."""
    log.info("trigger_daily_warmup: triggered by Beat scheduler")

    loop = asyncio.new_event_loop()
    try:
        accounts = loop.run_until_complete(_get_warming_accounts())
        for tenant_id, account_id in accounts:
            delay = random.randint(0, 300)
            run_warmup_cycle.apply_async(
                args=[tenant_id, account_id],
                countdown=delay,
            )
            log.info(f"Dispatched warmup for account {account_id} with {delay}s delay")
    finally:
        loop.close()

    return {"status": "triggered", "accounts": len(accounts) if 'accounts' in dir() else 0}


async def _get_warming_accounts() -> list[tuple[str, str]]:
    """Get all Telegram accounts in warmup stage (excludes VK — VK uses token auth, no warmup)."""
    rows = await pool_fetch(
        "SELECT tenant_id, id FROM account_pool WHERE status IN ('warming_up', 'active') "
        "AND warmup_stage < 3 AND platform = 'telegram'"
    )
    return [(str(r["tenant_id"]), str(r["id"])) for r in rows]


@celery.task(name="app.tasks.warmup.handle_flood_wait", queue="warmup")
def handle_flood_wait(tenant_id: str, account_id: str, wait_seconds: int = 14400):
    """Handle FLOOD_WAIT errors: set cooldown in DB."""
    try:
        uuid_mod.UUID(account_id)
    except ValueError:
        log.warning(f"Invalid account_id format: {account_id}, skipping cooldown")
        return {"status": "skipped", "reason": "invalid_uuid"}

    log.warning(f"FLOOD_WAIT on account {account_id}, cooldown {wait_seconds}s")

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_set_cooldown(account_id, wait_seconds))
    finally:
        loop.close()

    return {"status": "cooldown_set", "account_id": account_id,
            "cooldown_seconds": wait_seconds}


async def _set_cooldown(account_id: str, wait_seconds: int):
    """Set account to cooldown status in DB."""
    cooldown_until = datetime.now(timezone.utc) + timedelta(seconds=wait_seconds)
    await pool_execute(
        "UPDATE account_pool SET status = 'cooldown', cooldown_until = $1 WHERE id = $2",
        cooldown_until, _uuid(account_id),
    )


def _uuid(val: str):
    import uuid
    return uuid.UUID(val)
