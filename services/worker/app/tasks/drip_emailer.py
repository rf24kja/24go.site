"""Post-signup drip email sequence.

Queue: billing
Schedule: Daily via Celery Beat
Sequence:
  Day 0: Welcome + quick start guide
  Day 1: "Have you connected your first account?"
  Day 3: "Your trial is ending in X days"
"""
import logging
from datetime import datetime, timezone

import asyncpg

from app.celery_app import celery
from app.config import DATABASE_URL

log = logging.getLogger(__name__)

DB_URL_SYNC = DATABASE_URL.replace("+asyncpg", "") if "+asyncpg" in DATABASE_URL else DATABASE_URL


@celery.task(name="app.tasks.drip_emailer.send_drip_emails", queue="billing", max_retries=3)
def send_drip_emails():
    import asyncio
    return asyncio.run(_send_drip_emails_async())


async def _send_drip_emails_async():

    conn = await asyncpg.connect(DB_URL_SYNC)
    try:
        rows = await conn.fetch("""
            SELECT u.id, u.email, u.email_verified, u.created_at, t.company_name,
                   s.plan, s.status, s.current_period_end
            FROM users u
            JOIN tenants t ON t.id = u.tenant_id
            LEFT JOIN subscriptions s ON s.tenant_id = t.id
            WHERE u.created_at > now() - interval '7 days'
              AND u.email_verified = true
        """)

        sent = 0
        for row in rows:
            created = row["created_at"]
            if isinstance(created, str):
                created = datetime.fromisoformat(created.replace("Z", "+00:00"))
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)

            days = (datetime.now(timezone.utc) - created).days
            email = row["email"]
            company = row["company_name"] or "there"

            email_key = f"drip_email_{days}d"
            already_sent = await conn.fetchval("""
                SELECT EXISTS(
                    SELECT 1 FROM audit_log
                    WHERE tenant_id = $1 AND action = $2
                )
            """, row["id"], email_key)

            if already_sent:
                continue

            leads_count = await conn.fetchval(
                "SELECT count(*) FROM leads WHERE tenant_id = $1",
                row["id"],
            ) or 0

            try:
                if days == 0:
                    _send_drip_welcome(email, company)
                elif days == 1:
                    _send_drip_connect(email, company, leads_count)
                elif days == 3:
                    days_left = _get_trial_days_left(row)
                    if days_left is not None and days_left > 0:
                        _send_drip_trial_ending(email, company, days_left)
                    else:
                        continue
                else:
                    continue

                await conn.execute("""
                    INSERT INTO audit_log (tenant_id, action, entity_type, entity_id, details)
                    VALUES ($1, $2, 'drip_email', $3, '{}')
                """, row["id"], email_key, str(row["id"]))

                sent += 1
                log.info(f"Sent {email_key} to {email}")

            except Exception as e:
                log.warning(f"Failed to send {email_key} to {email}: {e}")

        return {"sent": sent}
    finally:
        await conn.close()


def _get_trial_days_left(row) -> int | None:
    end = row.get("current_period_end")
    if not end or row.get("plan") != "trial":
        return None
    if isinstance(end, str):
        end = datetime.fromisoformat(end.replace("Z", "+00:00"))
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return (end - datetime.now(timezone.utc)).days


def _send_drip_welcome(email: str, company: str):
    from app.notifications import _send_html, _wrap_html
    body = f"""
    <h2 style="color:#f9fafb;margin:0 0 16px;">Welcome to 24GO, {company}!</h2>
    <p style="color:#d1d5db;">You're all set. Here's how to get your first leads in under 5 minutes:</p>
    <ol style="color:#d1d5db;padding-left:20px;">
      <li style="margin-bottom:8px;"><strong style="color:#f9fafb;">Connect your channels</strong> — link your Telegram or VK groups</li>
      <li style="margin-bottom:8px;"><strong style="color:#f9fafb;">Set targeting</strong> — tell us what kind of leads you're looking for</li>
      <li style="margin-bottom:8px;"><strong style="color:#f9fafb;">Watch leads flow in</strong> — we'll score and notify you of hot ones</li>
    </ol>
    """
    _send_html(email, "Welcome to 24GO — let's find your first lead", _wrap_html(body))


def _send_drip_connect(email: str, company: str, leads_count: int):
    from app.notifications import _send_html, _wrap_html
    if leads_count > 0:
        headline = f"Hey {company}, you've already captured {leads_count} lead{'s' if leads_count != 1 else ''}!"
        detail = "Check your dashboard to see what they're saying."
    else:
        headline = f"Hey {company}, have you connected your first account yet?"
        detail = "Connect a Telegram or VK account to start intercepting leads automatically."
    body = f"""
    <h2 style="color:#f9fafb;margin:0 0 16px;">{headline}</h2>
    <p style="color:#d1d5db;">{detail}</p>
    """
    _send_html(email, "Your 24GO quick start", _wrap_html(body))


def _send_drip_trial_ending(email: str, company: str, days_left: int):
    from app.notifications import _send_html, _wrap_html
    body = f"""
    <h2 style="color:#f9fafb;margin:0 0 16px;">Your trial ends {f'in {days_left} days' if days_left > 1 else 'tomorrow'}, {company}</h2>
    <p style="color:#d1d5db;">Upgrade now to keep your leads and unlock unlimited channels.</p>
    """
    _send_html(email, f"24GO trial ending in {days_left} days", _wrap_html(body))
