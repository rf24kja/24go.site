"""Mailer task: sends personalized messages to mailing recipients with anti-spam protections.

Processes recipients in batches, rotates accounts, randomizes delays ±30%,
respects daily limits, and pauses on flood-wait.
"""
import asyncio
import logging
import random
import uuid as uuid_mod

from celery import shared_task

from app.celery_app import celery
from app.locks import acquire_account_lock, increment_daily_actions
from app.config import WARMUP_LIMITS, DATABASE_URL

log = logging.getLogger(__name__)

BATCH_SIZE = 50  # ponytail: fixed batch, tune if needed


def _get_db_url():
    return DATABASE_URL.replace("+asyncpg", "")


def _render_message(template: str, username: str, first_name: str | None) -> str:
    name = first_name or username
    return template.replace("{first_name}", name).replace("{username}", f"@{username}")


def _get_random_delay(base_seconds: int) -> float:
    jitter = base_seconds * 0.3
    return base_seconds + random.uniform(-jitter, jitter)


def _select_account(accounts: list, used_ids: set) -> dict | None:
    candidates = [
        a for a in accounts
        if a["status"] == "active"
        and a["actions_today"] < a["daily_action_limit"]
        and str(a["id"]) not in used_ids
    ]
    if not candidates:
        candidates = [
            a for a in accounts
            if a["status"] == "active"
            and a["actions_today"] < a["daily_action_limit"]
        ]
    if not candidates:
        return None
    return random.choice(candidates)


@celery.task(name="app.tasks.mailer.process_mailing", bind=True, queue="poster", max_retries=0)
def process_mailing(self, mailing_id: str, tenant_id: str):
    db_url = _get_db_url()
    loop = asyncio.new_event_loop()

    try:
        loop.run_until_complete(
            _process_mailing_async(self, mailing_id, tenant_id, db_url)
        )
    finally:
        loop.close()


async def _process_mailing_async(task, mailing_id: str, tenant_id: str, db_url: str):
    import asyncpg
    from app.telegram_client import get_client, disconnect_client, _set_status

    conn = await asyncpg.connect(db_url)
    try:
        mailing = await conn.fetchrow(
            "SELECT * FROM mailings WHERE id = $1 AND tenant_id = $2",
            uuid_mod.UUID(mailing_id), uuid_mod.UUID(tenant_id),
        )
        if not mailing:
            log.error(f"Mailing {mailing_id} not found")
            return

        if mailing["status"] != "running":
            log.info(f"Mailing {mailing_id} status is {mailing['status']}, stopping")
            return

        accounts = await conn.fetch(
            "SELECT id, status, daily_action_limit, actions_today "
            "FROM account_pool WHERE tenant_id = $1 AND platform = $2",
            uuid_mod.UUID(tenant_id), mailing["platform"].value if hasattr(mailing["platform"], "value") else str(mailing["platform"]),
        )
        accounts = [dict(a) for a in accounts]

        if not accounts:
            log.warning(f"No accounts available for tenant {tenant_id}")
            await conn.execute(
                "UPDATE mailings SET status = 'paused' WHERE id = $1",
                uuid_mod.UUID(mailing_id),
            )
            return

        delay = mailing["delay_seconds"]
        used_account_ids: set = set()
        flood_wait_count = 0
        sent_total = 0
        failed_total = 0

        while True:
            status = await conn.fetchval(
                "SELECT status FROM mailings WHERE id = $1",
                uuid_mod.UUID(mailing_id),
            )
            if status != "running":
                log.info(f"Mailing {mailing_id} status changed to {status}, stopping")
                break

            recipients = await conn.fetch(
                "SELECT id, username, first_name FROM mailing_recipients "
                "WHERE mailing_id = $1 AND status = 'pending' ORDER BY id LIMIT $2",
                uuid_mod.UUID(mailing_id), BATCH_SIZE,
            )
            if not recipients:
                log.info(f"Mailing {mailing_id}: all recipients processed")
                break

            for recipient in recipients:
                status = await conn.fetchval(
                    "SELECT status FROM mailings WHERE id = $1",
                    uuid_mod.UUID(mailing_id),
                )
                if status != "running":
                    break

                account = _select_account(accounts, used_account_ids)
                if not account:
                    log.warning(f"No available accounts for mailing {mailing_id}")
                    await conn.execute(
                        "UPDATE mailings SET status = 'paused' WHERE id = $1",
                        uuid_mod.UUID(mailing_id),
                    )
                    return

                account_id = str(account["id"])
                rendered = _render_message(
                    mailing["message_text"],
                    recipient["username"],
                    recipient["first_name"],
                )

                try:
                    result = await _send_dm(account_id, recipient["username"], rendered)

                    if result.get("status") == "ok":
                        await conn.execute(
                            "UPDATE mailing_recipients SET status = 'sent', sent_at = NOW() WHERE id = $1",
                            recipient["id"],
                        )
                        await conn.execute(
                            "UPDATE mailings SET sent_count = sent_count + 1 WHERE id = $1",
                            uuid_mod.UUID(mailing_id),
                        )
                        increment_daily_actions(tenant_id, account_id)
                        account["actions_today"] += 1
                        used_account_ids.add(account_id)
                        flood_wait_count = 0
                        sent_total += 1

                    elif result.get("status") == "flood_wait":
                        log.warning(f"Flood wait for account {account_id}, rotating")
                        flood_wait_count += 1
                        used_account_ids.add(account_id)

                        if flood_wait_count >= 3:
                            log.warning(f"3+ flood waits in a row, pausing mailing {mailing_id}")
                            await conn.execute(
                                "UPDATE mailings SET status = 'paused' WHERE id = $1",
                                uuid_mod.UUID(mailing_id),
                            )
                            return

                    else:
                        error_msg = result.get("error", "unknown")[:200]
                        await conn.execute(
                            "UPDATE mailing_recipients SET status = 'failed', error_message = $1 WHERE id = $2",
                            error_msg, recipient["id"],
                        )
                        await conn.execute(
                            "UPDATE mailings SET failed_count = failed_count + 1 WHERE id = $1",
                            uuid_mod.UUID(mailing_id),
                        )
                        failed_total += 1

                except Exception as e:
                    log.error(f"Error sending to {recipient['username']}: {e}")
                    await conn.execute(
                        "UPDATE mailing_recipients SET status = 'failed', error_message = $1 WHERE id = $2",
                        str(e)[:200], recipient["id"],
                    )
                    await conn.execute(
                        "UPDATE mailings SET failed_count = failed_count + 1 WHERE id = $1",
                        uuid_mod.UUID(mailing_id),
                    )
                    failed_total += 1

                actual_delay = _get_random_delay(delay)
                await asyncio.sleep(actual_delay)

            remaining = await conn.fetchval(
                "SELECT COUNT(*) FROM mailing_recipients WHERE mailing_id = $1 AND status = 'pending'",
                uuid_mod.UUID(mailing_id),
            )
            if remaining == 0:
                await conn.execute(
                    "UPDATE mailings SET status = 'completed' WHERE id = $1",
                    uuid_mod.UUID(mailing_id),
                )
                log.info(f"Mailing {mailing_id} completed: sent={sent_total}, failed={failed_total}")
                break

        for aid in used_account_ids:
            try:
                await disconnect_client(aid)
            except Exception:
                pass

    finally:
        await conn.close()


async def _send_dm(account_id: str, username: str, text: str) -> dict:
    from app.telegram_client import get_client, _set_status

    client = await get_client(account_id)
    if client is None:
        return {"status": "error", "error": "no_session"}

    try:
        entity = await client.get_entity(username)
        await client.send_message(entity, text)
        _set_status(account_id, "online")
        return {"status": "ok"}
    except Exception as e:
        error_name = type(e).__name__
        if "FloodWaitError" in error_name or "flood" in str(e).lower():
            wait = getattr(e, "seconds", 300)
            return {"status": "flood_wait", "wait_seconds": wait}
        elif "UserIsBlockedError" in error_name or "blocked" in str(e).lower():
            return {"status": "error", "error": "user_blocked"}
        elif "PeerFloodError" in error_name:
            return {"status": "flood_wait", "wait_seconds": 600}
        else:
            log.error(f"DM send error: {e}")
            return {"status": "error", "error": str(e)[:200]}
