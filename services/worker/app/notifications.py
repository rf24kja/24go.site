"""Email notifications for HOT/WARM leads.

Ponytail: smtplib + email stdlib. No external deps.
Best-effort — never blocks the lead pipeline.
"""
import logging
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

log = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
NOTIFY_EMAIL = os.getenv("NOTIFY_EMAIL", "")  # recipient for lead alerts
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@24go.site")


def _is_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASS and NOTIFY_EMAIL)


async def notify_hot_lead(tenant_id: str, lead: dict) -> None:
    """Send email alert for HOT leads. Best-effort, never raises."""
    if not _is_configured():
        return

    intent = lead.get("intent_score", "COLD")
    if intent not in ("HOT", "WARM"):
        return

    handle = lead.get("user_handle", "unknown")
    message = lead.get("message_text", "")[:300]
    geo = lead.get("geo_tag", "")
    source = lead.get("source", "dm")
    dialog = lead.get("dialog_url", "")

    subject = f"🔥 {intent} Lead from {handle}"
    if geo:
        subject += f" ({geo})"

    body = f"""New {intent} lead captured!

From: {handle}
Source: {source}
Message: {message}

{'View in dashboard: https://24go.site/leads' if dialog else ''}
"""
    if dialog:
        body += f"Direct link: {dialog}\n"

    try:
        msg = MIMEMultipart()
        msg["From"] = FROM_EMAIL
        msg["To"] = NOTIFY_EMAIL
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(FROM_EMAIL, NOTIFY_EMAIL, msg.as_string())

        log.info(f"Email sent: {intent} lead from {handle}")
    except Exception as e:
        log.warning(f"Email notify failed (non-blocking): {e}")


async def notify_daily_summary(tenant_id: str, stats: dict) -> None:
    """Send daily summary email. Best-effort."""
    if not _is_configured():
        return

    hot = stats.get("hot", 0)
    warm = stats.get("warm", 0)
    cold = stats.get("cold", 0)
    total = hot + warm + cold

    subject = f"📊 Daily Lead Summary — {total} leads"
    body = f"""Daily summary for tenant {tenant_id[:8]}...

🔥 HOT:  {hot}
🟡 WARM: {warm}
❄️  COLD: {cold}
📋 Total: {total}

Dashboard: https://24go.site/leads
"""
    try:
        msg = MIMEMultipart()
        msg["From"] = FROM_EMAIL
        msg["To"] = NOTIFY_EMAIL
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(FROM_EMAIL, NOTIFY_EMAIL, msg.as_string())

        log.info(f"Daily summary sent: {total} leads")
    except Exception as e:
        log.warning(f"Daily summary email failed: {e}")
