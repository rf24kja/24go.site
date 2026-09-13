"""Validate imported Telegram accounts.

Queue: warmup
Timeout: 30s
Retries: 0

Loads session from DB, attempts Telethon connection.
Sets status to 'active' if OK, 'blocked' if errors.
"""
import logging
import uuid as uuid_mod

import asyncpg
from celery import shared_task

from app.celery_app import celery
from app.config import DATABASE_URL

log = logging.getLogger(__name__)
DATABASE_URL = DATABASE_URL.replace("+asyncpg", "")

TG_API_ID = int(__import__("os").getenv("TG_API_ID", "0"))
TG_API_HASH = __import__("os").getenv("TG_API_HASH", "")


@celery.task(name="app.tasks.account_validator.validate_imported_account",
             bind=True, queue="warmup", max_retries=0)
def validate_imported_account(self, tenant_id: str, account_id: str):
    """Validate an imported account by connecting to Telegram or VK API."""
    try:
        uuid_mod.UUID(account_id)
        uuid_mod.UUID(tenant_id)
    except ValueError:
        log.warning(f"Invalid id format: tenant={tenant_id} account={account_id}")
        return {"status": "skipped", "reason": "invalid_uuid"}

    try:
        loop = self.app.loop or __import__("asyncio").new_event_loop()
    except AttributeError:
        loop = __import__("asyncio").new_event_loop()

    return loop.run_until_complete(
        _validate(tenant_id, account_id)
    )


async def _validate(tenant_id: str, account_id: str):
    """Async validation logic."""
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        # Check platform
        acct_row = await conn.fetchrow(
            "SELECT platform FROM account_pool WHERE id = $1",
            uuid_mod.UUID(account_id),
        )
        platform = acct_row["platform"] if acct_row else "telegram"

        if platform == "vkontakte":
            return await _validate_vk(conn, account_id)

        return await _validate_telegram(conn, account_id)
    finally:
        await conn.close()


async def _validate_vk(conn, account_id: str):
    """Validate a VK account by calling groups.getById with its token."""
    from app.telegram_client import _decrypt

    row = await conn.fetchrow(
        "SELECT session_data FROM account_sessions WHERE account_id = $1",
        uuid_mod.UUID(account_id),
    )
    if not row:
        await _update_status(conn, account_id, "blocked", "No session found in DB")
        return {"status": "blocked", "error": "No session found"}

    token = _decrypt(row["session_data"])
    try:
        import vk_api
        session = vk_api.VkApi(token=token, api_version="5.199")
        vk = session.get_api()
        groups = vk.groups.getById()
        if groups:
            await _update_status(conn, account_id, "active", None, daily_limit=20)
            log.info(f"VK account {account_id} validated — active ({groups[0].get('name', 'unknown')})")
            return {"status": "active"}
        else:
            await _update_status(conn, account_id, "blocked", "Token does not belong to any VK community")
            return {"status": "blocked", "error": "No community found"}
    except Exception as e:
        error_msg = str(e)[:200]
        await _update_status(conn, account_id, "blocked", error_msg)
        return {"status": "blocked", "error": error_msg}


async def _validate_telegram(conn, account_id: str):
    """Validate a Telegram account by connecting via Telethon."""
    from app.telegram_client import _decrypt

    row = await conn.fetchrow(
        "SELECT session_data FROM account_sessions WHERE account_id = $1",
        uuid_mod.UUID(account_id),
    )
    if not row:
        await _update_status(conn, account_id, "blocked", "No session found in DB")
        return {"status": "blocked", "error": "No session found"}

    session_string = _decrypt(row["session_data"])

    if not TG_API_ID or not TG_API_HASH:
        await _update_status(conn, account_id, "blocked", "TG API not configured")
        return {"status": "blocked", "error": "TG API not configured"}

    from telethon import TelegramClient
    from telethon.sessions import StringSession

    client = TelegramClient(StringSession(session_string), TG_API_ID, TG_API_HASH)
    try:
        await client.connect()
        if not await client.is_user_authorized():
            await client.disconnect()
            await _update_status(conn, account_id, "blocked", "Session expired or unauthorized")
            return {"status": "blocked", "error": "Session expired"}

        await client.disconnect()
        await _update_status(conn, account_id, "active", None, daily_limit=15)
        log.info(f"Account {account_id} validated — active")
        return {"status": "active"}

    except Exception as e:
        error_msg = str(e)[:200]
        try:
            await client.disconnect()
        except Exception:
            pass

        if "flood" in error_msg.lower():
            await _update_status(conn, account_id, "cooldown", error_msg)
            return {"status": "cooldown", "error": error_msg}

        await _update_status(conn, account_id, "blocked", error_msg)
        return {"status": "blocked", "error": error_msg}


async def _update_status(conn, account_id: str, status: str, error: str = None, daily_limit: int = None):
    """Update account status in DB."""
    if daily_limit is not None:
        await conn.execute(
            "UPDATE account_pool SET status = $1, daily_action_limit = $2 WHERE id = $3",
            status, daily_limit, uuid_mod.UUID(account_id),
        )
    else:
        await conn.execute(
            "UPDATE account_pool SET status = $1 WHERE id = $2",
            status, uuid_mod.UUID(account_id),
        )
