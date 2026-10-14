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


async def notify_hot_lead(tenant_id: str, lead: dict, tenant_cfg: dict | None = None) -> None:
    """Send email alert for HOT leads. Best-effort, never raises.

    Args:
        tenant_cfg: Tenant settings (notifications section) for notify_on filter.
    """
    if not _is_configured():
        return

    intent = lead.get("intent_score", "COLD")
    notif_cfg = (tenant_cfg or {}).get("notifications", {})
    notify_on = notif_cfg.get("notify_on", ["HOT", "WARM"])

    if intent not in notify_on:
        return

    # Sanitize user handle to prevent email header injection
    handle = lead.get("user_handle", "unknown").replace("\r", "").replace("\n", "")[:100]
    message = lead.get("message_text", "")[:300]
    geo = lead.get("geo_tag", "").replace("\r", "").replace("\n", "")[:50]
    source = lead.get("source", "dm")
    dialog = lead.get("dialog_url", "")
    prefix = notif_cfg.get("email_subject_prefix", "[LeadGen]").replace("\r", "").replace("\n", "")[:50]

    subject = f"{prefix} {intent} Lead from {handle}"
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


def _send_html(to: str, subject: str, html: str) -> None:
    """Send HTML email via SMTP. Best-effort."""
    if not _is_configured():
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = FROM_EMAIL
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(FROM_EMAIL, to, msg.as_string())
        log.info(f"HTML email sent to {to}: {subject}")
    except Exception as e:
        log.warning(f"HTML email failed to {to}: {e}")


def _wrap_html(body: str) -> str:
    """Wrap body content in dark-themed HTML shell."""
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#111827;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#1f2937;border-radius:12px;overflow:hidden;">
  <tr><td style="background:#111827;padding:24px 32px;text-align:center;">
    <span style="font-size:28px;font-weight:700;color:#f9fafb;">24<span style="color:#3b82f6;">GO</span></span>
  </td></tr>
  <tr><td style="padding:32px;color:#e5e7eb;font-size:16px;line-height:1.6;">
    {body}
  </td></tr>
  <tr><td style="padding:0 32px 32px;">
    <a href="https://www.24go.site/billing" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">Open Dashboard</a>
  </td></tr>
  <tr><td style="padding:0 32px 24px;border-top:1px solid #374151;">
    <p style="color:#6b7280;font-size:12px;margin:16px 0 0;">
      You're receiving this because you signed up at 24go.site.<br>
      <a href="mailto:unsubscribe@24go.site" style="color:#6b7280;">Unsubscribe</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""


async def send_trial_day1(email: str, company: str) -> None:
    """Day 1: Welcome email with quick start guide."""
    body = f"""
    <h2 style="color:#f9fafb;margin:0 0 16px;">Welcome to 24GO, {company}! 🎉</h2>
    <p>You're all set up. Here's how to get your first leads in under 5 minutes:</p>
    <ol style="color:#d1d5db;padding-left:20px;">
      <li style="margin-bottom:8px;"><strong style="color:#f9fafb;">Connect your channels</strong> — link your Telegram or VK groups</li>
      <li style="margin-bottom:8px;"><strong style="color:#f9fafb;">Set targeting</strong> — tell us what kind of leads you're looking for</li>
      <li style="margin-bottom:8px;"><strong style="color:#f9fafb;">Watch leads flow in</strong> — we'll score and notify you of hot ones</li>
    </ol>
    <p style="color:#9ca3af;">Your 14-day trial is active. No credit card needed.</p>
    """
    _send_html(email, "Welcome to 24GO — let's find your first lead", _wrap_html(body))


async def send_trial_day3(email: str, company: str, leads_count: int) -> None:
    """Day 3: Engagement email — show value of leads captured."""
    if leads_count == 0:
        headline = f"Hey {company}, your channels are connected — leads are on the way!"
        detail = "While you wait, try joining more groups in your niche to increase lead volume."
    else:
        headline = f"Hey {company}, you've already captured {leads_count} lead{'s' if leads_count != 1 else ''}!"
        detail = "Check your dashboard to see what they're saying."

    body = f"""
    <h2 style="color:#f9fafb;margin:0 0 16px;">{headline}</h2>
    <p style="color:#d1d5db;">{detail}</p>
    <p style="color:#9ca3af;">You're 3 days in — here's what's working so far. Keep your channels active and we'll keep finding leads for you.</p>
    """
    _send_html(email, f"Your 24GO update — {leads_count} leads so far", _wrap_html(body))


async def send_trial_day7(email: str, company: str, leads_count: int, hot_leads: int) -> None:
    """Day 7: Midpoint email — show achievements, create urgency."""
    body = f"""
    <h2 style="color:#f9fafb;margin:0 0 16px;">You're halfway through your trial, {company}!</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      <tr>
        <td style="background:#374151;padding:16px;border-radius:8px;text-align:center;width:33%;">
          <div style="font-size:28px;font-weight:700;color:#3b82f6;">{leads_count}</div>
          <div style="color:#9ca3af;font-size:13px;">Total Leads</div>
        </td>
        <td style="width:8px;"></td>
        <td style="background:#374151;padding:16px;border-radius:8px;text-align:center;width:33%;">
          <div style="font-size:28px;font-weight:700;color:#ef4444;">{hot_leads}</div>
          <div style="color:#9ca3af;font-size:13px;">Hot Leads</div>
        </td>
        <td style="width:8px;"></td>
        <td style="background:#374151;padding:16px;border-radius:8px;text-align:center;width:33%;">
          <div style="font-size:28px;font-weight:700;color:#f59e0b;">7</div>
          <div style="color:#9ca3af;font-size:13px;">Days Used</div>
        </td>
      </tr>
    </table>
    <p style="color:#d1d5db;">Your trial has 7 days left. Upgrade now to keep your leads and unlock unlimited channels.</p>
    """
    _send_html(email, f"Your 24GO mid-trial report — {leads_count} leads captured", _wrap_html(body))


async def send_trial_day12(email: str, company: str, days_left: int) -> None:
    """Day 12: Urgency email — trial ending soon, upgrade CTA."""
    body = f"""
    <h2 style="color:#f9fafb;margin:0 0 16px;">Your trial ends {f'in {days_left} days' if days_left > 1 else 'tomorrow'}, {company}</h2>
    <p style="color:#d1d5db;">You've been using 24GO to find leads automatically. After your trial ends, lead capture will stop.</p>
    <div style="background:#374151;padding:16px;border-radius:8px;margin:16px 0;">
      <p style="color:#f9fafb;margin:0;font-weight:600;">What you'll lose access to:</p>
      <ul style="color:#d1d5db;margin:8px 0 0;padding-left:20px;">
        <li>Automatic lead capture from Telegram & VK</li>
        <li>HOT/WARM lead scoring & alerts</li>
        <li>Lead dashboard & analytics</li>
      </ul>
    </div>
    <p style="color:#ef4444;font-weight:600;">Upgrade today to keep everything running.</p>
    """
    _send_html(email, "24GO trial ending soon — upgrade to keep your leads", _wrap_html(body))


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
