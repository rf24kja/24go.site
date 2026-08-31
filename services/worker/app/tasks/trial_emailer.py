"""Send trial onboarding emails based on days since registration.

Queue: billing
Schedule: Daily via Celery Beat
"""
import logging
from datetime import datetime, timezone

import asyncpg

from app.celery_app import celery
from app.config import DATABASE_URL

log = logging.getLogger(__name__)

DB_URL_SYNC = DATABASE_URL.replace("+asyncpg", "") if "+asyncpg" in DATABASE_URL else DATABASE_URL


@celery.task(name="app.tasks.trial_emailer.send_trial_emails", queue="billing", max_retries=3)
def send_trial_emails():
    """Check all trial subscriptions and send appropriate onboarding emails."""
    import asyncio
    return asyncio.run(_send_trial_emails_async())


async def _send_trial_emails_async():
    from app.notifications import (
        send_trial_day1,
        send_trial_day3,
        send_trial_day7,
        send_trial_day12,
    )

    conn = await asyncpg.connect(DB_URL_SYNC)
    try:
        rows = await conn.fetch("""
            SELECT s.tenant_id, s.current_period_start, t.company_name, u.email
            FROM subscriptions s
            JOIN tenants t ON t.id = s.tenant_id
            JOIN users u ON u.tenant_id = s.tenant_id
            WHERE s.plan = 'trial' AND s.status = 'active'
        """)

        sent = 0
        for row in rows:
            period_start = row["current_period_start"]
            if isinstance(period_start, str):
                period_start = datetime.fromisoformat(period_start.replace("Z", "+00:00"))
            if period_start.tzinfo is None:
                period_start = period_start.replace(tzinfo=timezone.utc)

            days = (datetime.now(timezone.utc) - period_start).days
            email = row["email"]
            company = row["company_name"] or "there"

            # Check if already sent today
            email_key = f"trial_email_{days}d"
            already_sent = await conn.fetchval("""
                SELECT EXISTS(
                    SELECT 1 FROM audit_log
                    WHERE tenant_id = $1 AND action = $2
                )
            """, row["tenant_id"], email_key)

            if already_sent:
                continue

            # Get leads count
            leads_count = await conn.fetchval(
                "SELECT count(*) FROM leads WHERE tenant_id = $1",
                row["tenant_id"],
            ) or 0
            hot_leads = await conn.fetchval(
                "SELECT count(*) FROM leads WHERE tenant_id = $1 AND intent_score = 'HOT'",
                row["tenant_id"],
            ) or 0

            try:
                if days == 0:
                    await send_trial_day1(email, company)
                elif days == 3:
                    await send_trial_day3(email, company, leads_count)
                elif days == 7:
                    await send_trial_day7(email, company, leads_count, hot_leads)
                elif days == 12:
                    await send_trial_day12(email, company, 14 - days)
                else:
                    continue

                await conn.execute("""
                    INSERT INTO audit_log (tenant_id, action, entity_type, entity_id, details)
                    VALUES ($1, $2, 'trial_email', $3, '{}')
                """, row["tenant_id"], email_key, str(row["tenant_id"]))

                sent += 1
                log.info(f"Sent {email_key} to {email}")

            except Exception as e:
                log.warning(f"Failed to send {email_key} to {email}: {e}")

        return {"sent": sent}
    finally:
        await conn.close()
