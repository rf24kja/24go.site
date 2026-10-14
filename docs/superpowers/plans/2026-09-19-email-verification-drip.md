# Email Verification + Post-Signup Drip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email verification flow after registration and a 3-email drip sequence for post-signup retention.

**Architecture:** Email verification uses Redis-stored tokens (same pattern as password reset). Drip emails reuse the existing trial_emailer pattern (Celery + asyncpg + audit_log dedup). No new dependencies.

**Tech Stack:** FastAPI, SQLAlchemy async, Redis, Celery, smtplib (stdlib), asyncpg

## Global Constraints

- Follow existing code patterns (smtplib for email, Redis for tokens, audit_log for dedup)
- No new Python dependencies
- HTML emails use existing `_wrap_html` template from `notifications.py`
- i18n keys in both `en.json` and `ru.json`

---

### Task 1: Add email_verified column to User model

**Files:**
- Modify: `services/backend/app/models.py:87-98`

- [ ] **Step 1: Add column to User model**

Add `email_verified = Column(Boolean, nullable=False, default=False)` after `role` column in the User class.

- [ ] **Step 2: Create Alembic migration**

```bash
cd services/backend
alembic revision --autogenerate -m "add email_verified to users"
alembic upgrade head
```

If no Alembic setup, run raw SQL:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
```

- [ ] **Step 3: Commit**

```bash
git add services/backend/app/models.py
git commit -m "feat: add email_verified column to users table"
```

---

### Task 2: Add verification token generation and email sending to auth.py

**Files:**
- Modify: `services/backend/app/routers/auth.py`

- [ ] **Step 1: Add imports and token helper**

Add at top of file:
```python
import secrets
import hashlib
```

Add helper function:
```python
def _create_verification_token(email: str) -> str:
    token = secrets.token_urlsafe(32)
    _redis.setex(f"verify_token:{token}", 86400, email)  # 24h TTL
    return token
```

- [ ] **Step 2: Add verification email sender**

```python
async def _send_verification_email(email: str, token: str):
    verify_link = f"https://www.24go.site/verify?token={token}"
    body = (
        f"Welcome to 24GO!\n\n"
        f"Please verify your email by clicking the link below:\n\n"
        f"{verify_link}\n\n"
        f"This link expires in 24 hours.\n"
    )
    try:
        msg = MIMEMultipart()
        msg["From"] = settings.FROM_EMAIL
        msg["To"] = email
        msg["Subject"] = "Verify your email — 24GO"
        msg.attach(MIMEText(body, "plain"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.sendmail(settings.FROM_EMAIL, email, msg.as_string())
    except Exception as e:
        import logging
        logging.warning(f"Failed to send verification email to {email}: {e}")
```

- [ ] **Step 3: Call after registration**

In the `register` endpoint, after `await db.commit()` and before creating the JWT token, add:
```python
verification_token = _create_verification_token(body.email)
await _send_verification_email(body.email, verification_token)
```

- [ ] **Step 4: Add verify-email endpoint**

```python
@router.get("/verify-email")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    email = _redis.get(f"verify_token:{token}")
    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    user.email_verified = True
    await db.commit()
    _redis.delete(f"verify_token:{token}")
    
    return {"message": "Email verified successfully", "redirect_url": "https://www.24go.site/login"}
```

- [ ] **Step 5: Update TokenResponse to include email_verified**

In `schemas.py`, add `email_verified: bool = False` to `TokenResponse`. In auth.py register/login, include it in the response.

- [ ] **Step 6: Commit**

```bash
git add services/backend/app/routers/auth.py services/backend/app/schemas.py
git commit -m "feat: email verification flow with token + endpoint"
```

---

### Task 3: Add drip email Celery task

**Files:**
- Create: `services/worker/app/tasks/drip_emailer.py`
- Modify: `services/worker/app/celery_app.py`

- [ ] **Step 1: Create drip_emailer.py**

```python
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
    from app.notifications import _send_html, _wrap_html

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

            # Get leads count for context
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
```

- [ ] **Step 2: Register in celery_app.py**

Add to `celery_app.py` task_routes:
```python
"app.tasks.drip_emailer.*": {"queue": "billing"},
```

Add to beat_schedule:
```python
"drip-emails": {
    "task": "app.tasks.drip_emailer.send_drip_emails",
    "schedule": crontab(hour=11, minute=0),
    "options": {"queue": "billing"},
},
```

- [ ] **Step 3: Commit**

```bash
git add services/worker/app/tasks/drip_emailer.py services/worker/app/celery_app.py
git commit -m "feat: post-signup drip email sequence (3-email cadence)"
```

---

### Task 4: Add i18n keys for email content

**Files:**
- Modify: `services/dashboard/src/lib/en.json`
- Modify: `services/dashboard/src/lib/ru.json`

- [ ] **Step 1: Add English keys to en.json**

```json
"email.verify.title": "Verify your email",
"email.verify.subtitle": "Click the link below to verify your email address",
"email.verify.button": "Verify Email",
"email.verify.success": "Email verified successfully",
"email.verify.expired": "Verification link has expired",
"email.verify.invalid": "Invalid verification link",
"email.welcome.title": "Welcome to 24GO",
"email.welcome.subtitle": "Let's find your first lead",
"email.drip.day1.title": "Welcome to 24GO, {company}!",
"email.drip.day1.body": "You're all set up. Here's how to get your first leads:",
"email.drip.day2.title": "Have you connected your first account?",
"email.drip.day2.body": "Connect a Telegram or VK account to start intercepting leads.",
"email.drip.day3.title": "Your trial ends in {days} days",
"email.drip.day3.body": "Upgrade now to keep your leads and unlock unlimited channels."
```

- [ ] **Step 2: Add Russian keys to ru.json**

```json
"email.verify.title": "Подтвердите email",
"email.verify.subtitle": "Нажмите на ссылку ниже для подтверждения",
"email.verify.button": "Подтвердить email",
"email.verify.success": "Email успешно подтверждён",
"email.verify.expired": "Ссылка для подтверждения истекла",
"email.verify.invalid": "Неверная ссылка для подтверждения",
"email.welcome.title": "Добро пожаловать в 24GO",
"email.welcome.subtitle": "Найдём ваш первый лид",
"email.drip.day1.title": "Добро пожаловать в 24GO, {company}!",
"email.drip.day1.body": "Всё готово. Вот как получить первые лиды:",
"email.drip.day2.title": "Вы подключили первый аккаунт?",
"email.drip.day2.body": "Подключите Telegram или VK, чтобы начать перехватывать лиды.",
"email.drip.day3.title": "Пробный период заканчивается через {days} дней",
"email.drip.day3.body": "Обновите тариф, чтобы сохранить лиды и получить полный доступ."
```

- [ ] **Step 3: Commit**

```bash
git add services/dashboard/src/lib/en.json services/dashboard/src/lib/ru.json
git commit -m "feat: add i18n keys for email verification and drip sequence"
```

---

### Task 5: Add RESEND_API_KEY to config (optional)

**Files:**
- Modify: `services/backend/app/config.py`

- [ ] **Step 1: Add config field**

Add `RESEND_API_KEY: str = ""` to Settings class.

- [ ] **Step 2: Commit**

```bash
git add services/backend/app/config.py
git commit -m "feat: add RESEND_API_KEY config option"
```

---

### Task 6: Final commit

```bash
git add -A
git commit -m "feat: email verification + post-signup drip sequence"
```
