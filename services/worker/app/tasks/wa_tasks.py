"""WhatsApp / Telegram phone presence checker.

Queue: parser
Flow:
  1. Import phone numbers as contacts via Telethon
  2. Check which ones have Telegram accounts
  3. Update contacts table with has_tg, tg_user_id, tg_username
"""
import asyncio
import logging

from app.celery_app import celery

log = logging.getLogger(__name__)


@celery.task(name="app.tasks.wa_check_telegram_phones", queue="parser",
             bind=True, max_retries=3, default_retry_delay=60,
             acks_late=True)
def check_telegram_phones(self, tenant_id: str, phone_numbers: list[str],
                          account_id: str = ""):
    """Check a batch of phone numbers for Telegram presence via Telethon.

    phone_numbers: list of E.164 strings e.g. ["+79001234567"]
    account_id: Telegram account to use for lookup (optional)
    """
    log.info(f"check_telegram_phones: tenant={tenant_id} count={len(phone_numbers)}")

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(
            _check_phones(self, tenant_id, phone_numbers, account_id)
        )
    except Exception as e:
        log.error(f"check_telegram_phones failed: {e}")
        raise self.retry(exc=e)
    finally:
        loop.close()

    return {"status": "done", "tenant": tenant_id, "checked": len(phone_numbers)}


async def _check_phones(task, tenant_id: str, phone_numbers: list[str],
                        account_id: str):
    """Async runner: import contacts and check Telegram presence."""
    from telethon.tl.functions.contacts import ImportContactsRequest, DeleteContactsRequest
    from app.telegram_client import get_client
    from app.config import DATABASE_URL
    import asyncpg

    # Get a client to query against
    client = await get_client(account_id) if account_id else None
    if client is None:
        log.error("No Telegram client available for phone check")
        return

    db_url = DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(db_url)
    try:
        # Build Telethon InputPhoneContact list
        from telethon.tl.types import InputPhoneContact
        contacts_list = [
            InputPhoneContact(client_id=i, phone=phone, first_name=str(i), last_name="")
            for i, phone in enumerate(phone_numbers)
        ]

        # Import and get resolved users
        result = await client(ImportContactsRequest(contacts_list))

        resolved = {}
        for user in result.users:
            if user and hasattr(user, 'phone') and user.phone:
                resolved[f"+{user.phone}"] = {
                    "tg_user_id": user.id,
                    "tg_username": getattr(user, 'username', None) or "",
                }

        # Clean up imported contacts (delete them to avoid cluttering the user's address book)
        if result.users:
            try:
                await client(DeleteContactsRequest(id=result.users))
            except Exception:
                pass

        # Update contacts table
        for phone in phone_numbers:
            info = resolved.get(phone, None)
            has_tg = info is not None
            tg_uid = info["tg_user_id"] if info else None
            tg_uname = info["tg_username"] if info else ""

            await conn.execute(
                """UPDATE contacts
                   SET has_tg = $1, tg_user_id = $2, tg_username = $3
                   WHERE tenant_id = $4 AND phone = $5""",
                has_tg, tg_uid, tg_uname, tenant_id, phone,
            )

        log.info(f"check_telegram_phones done: tenant={tenant_id} "
                 f"found_tg={len(resolved)}/{len(phone_numbers)}")

    finally:
        await conn.close()
