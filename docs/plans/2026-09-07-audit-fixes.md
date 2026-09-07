# Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 22 issues from the security/quality audit across backend and worker services.

**Architecture:** Two deployment targets — `services/backend/` (FastAPI on VPS via Docker) and `services/worker/` (Celery workers on VPS via Docker). Worker changes require Docker rebuild + recreate.

**Tech Stack:** Python 3.11, asyncpg, Redis, FastAPI, Celery, Telethon, psycopg2

## Global Constraints

- VPS: `46.250.235.165`, SSH key: `C:\Users\rf24k\.ssh\id_ed25519_generator`
- VPS project: `/opt/generator-ad/` (SCP deploy, NOT git)
- Docker: `docker compose up -d --force-recreate` (NOT `restart`)
- DB: `app_user:B6XRri3ev458GMUPyfOk@app_db`, port 5434
- Redis password: from .env on VPS
- Never commit secrets. Never modify `preyi_*` containers.

---

## Batch 1: Critical Security (3 tasks)

### Task 1: Fix `_save_posting_log` dead code

**Files:**
- Modify: `services/worker/app/tasks/poster.py:236-298`

**Problem:** `_save_posting_log` defines `_insert` coroutine but never calls it. `_update_variant_stats` has the DB insert code accidentally placed inside it.

- [ ] **Step 1: Fix `_save_posting_log` to actually insert**

Replace the function body. Remove the duplicate `_update_variant_stats` code that's incorrectly placed inside `_save_posting_log`:

```python
def _save_posting_log(tenant_id, campaign_id, target_id, account_id,
                      rendered_text, utm_url, message_id):
    """Save posting record to DB for comment scraper tracking."""
    import uuid
    import asyncpg
    import os

    db_url = os.getenv("DATABASE_URL", "postgresql://app_user:secure_password@postgres:5432/app_db")
    db_url = db_url.replace("+asyncpg", "")

    async def _insert():
        conn = await asyncpg.connect(db_url)
        try:
            await conn.execute(
                """INSERT INTO posting_logs
                   (id, tenant_id, campaign_id, target_id, account_id,
                    rendered_text, utm_url, status, message_id, executed_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', $8, NOW())""",
                uuid.uuid4(),
                uuid.UUID(tenant_id),
                uuid.UUID(campaign_id) if campaign_id else None,
                uuid.UUID(target_id) if target_id else None,
                uuid.UUID(account_id) if account_id else None,
                rendered_text[:2000],
                utm_url,
                message_id,
            )
        finally:
            await conn.close()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_insert())
    finally:
        loop.close()
```

- [ ] **Step 2: Verify `_update_variant_stats` is clean (no duplicate DB code)**

The function should only contain the UPDATE query, not the INSERT. Verify it looks like:

```python
def _update_variant_stats(tenant_id: str, campaign_id: str, variants: list):
    """Update A/B variant post counts in campaigns table."""
    import asyncpg
    import os
    import json
    import uuid

    db_url = os.getenv("DATABASE_URL", "postgresql://app_user:secure_password@postgres:5432/app_db")
    db_url = db_url.replace("+asyncpg", "")

    async def _update():
        conn = await asyncpg.connect(db_url)
        try:
            await conn.execute(
                "UPDATE campaigns SET ab_variants = $1 WHERE id = $2 AND tenant_id = $3",
                json.dumps(variants),
                uuid.UUID(campaign_id),
                uuid.UUID(tenant_id),
            )
        finally:
            await conn.close()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_update())
    finally:
        loop.close()
```

- [ ] **Step 3: SCP to VPS and rebuild worker**

```bash
scp -i "C:\Users\rf24k\.ssh\id_ed25519_generator" "C:\Code\GeneratorAD\services\worker\app\tasks\poster.py" root@46.250.235.165:/opt/generator-ad/services/worker/app/tasks/poster.py
ssh -i "C:\Users\rf24k\.ssh\id_ed25519_generator" root@46.250.235.165 "cd /opt/generator-ad && docker compose build worker-poster && docker compose up -d --force-recreate worker-poster"
```

- [ ] **Step 4: Verify with log check**

```bash
ssh root@46.250.235.165 "docker logs generator-ad-worker-poster-1 --tail 20"
```

---

### Task 2: Encrypt ENCRYPTION_KEY enforcement

**Files:**
- Modify: `services/backend/app/config.py` — add startup assertion
- Modify: `services/worker/app/telegram_client.py:38-56` — fail loudly if no key

**Problem:** If `ENCRYPTION_KEY` is empty, sessions stored in plaintext.

- [ ] **Step 1: Add guard in backend config.py**

After the existing settings class, add:

```python
if not settings.ENCRYPTION_KEY:
    import logging
    logging.getLogger("leadgen").warning(
        "ENCRYPTION_KEY not set — Telegram sessions stored unencrypted in DB!"
    )
```

- [ ] **Step 2: Add guard in worker telegram_client.py**

In `_get_fernet()`, after the `if not encryption_key` check, raise instead of returning None:

```python
def _get_fernet():
    global _fernet
    if _fernet is not None:
        return _fernet
    encryption_key = os.getenv("ENCRYPTION_KEY", "")
    if not encryption_key:
        raise RuntimeError(
            "ENCRYPTION_KEY not set — Telegram sessions will be stored unencrypted! "
            "Set ENCRYPTION_KEY in your .env file."
        )
    try:
        import base64, hashlib
        from cryptography.fernet import Fernet
        key = hashlib.sha256(encryption_key.encode()).digest()
        fernet_key = base64.urlsafe_b64encode(key)
        _fernet = Fernet(fernet_key)
        return _fernet
    except ImportError:
        raise RuntimeError("cryptography package not installed — cannot encrypt sessions")
```

- [ ] **Step 3: SCP + rebuild backend + worker**

```bash
scp -i "..." services/backend/app/config.py root@46.250.235.165:/opt/generator-ad/services/backend/app/config.py
scp -i "..." services/worker/app/telegram_client.py root@46.250.235.165:/opt/generator-ad/services/worker/app/telegram_client.py
ssh root@46.250.235.165 "cd /opt/generator-ad && docker compose build backend worker-listener worker-poster worker-warmup worker-parser && docker compose up -d --force-recreate backend worker-listener worker-poster worker-warmup worker-parser"
```

- [ ] **Step 4: Verify ENCRYPTION_KEY is set on VPS**

```bash
ssh root@46.250.235.165 "grep ENCRYPTION_KEY /opt/generator-ad/.env"
```

---

### Task 3: Fix lock ownership (Redlock pattern)

**Files:**
- Modify: `services/worker/app/locks.py:30-55`

**Problem:** `r.delete(lock_key)` deletes any lock, even if another worker owns it. Two workers can operate on the same account simultaneously.

- [ ] **Step 1: Rewrite locks.py with ownership tokens**

```python
"""Distributed lock for account/proxy concurrency control (Redlock pattern).

Uses Redis SET NX with TTL and ownership tokens.
Workers MUST acquire lock before executing actions on an account.
"""
import os
import time
import uuid
from contextlib import contextmanager

import redis

_redis = None


def _get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.Redis.from_url(
            os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1"),
            decode_responses=True,
        )
    return _redis


def _release_lock(r: redis.Redis, lock_key: str, owner: str):
    """Release lock only if we still own it (Lua atomic check-and-delete)."""
    LUA_RELEASE = """
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
"""
    r.eval(LUA_RELEASE, 1, lock_key, owner)


@contextmanager
def acquire_account_lock(tenant_id: str, account_id: str, lock_timeout: int = 60):
    """Acquire a per-account distributed lock. Yields (acquired, owner_id)."""
    r = _get_redis()
    lock_key = f"lock:tenant:{tenant_id}:account:{account_id}"
    owner = str(uuid.uuid4())
    acquired = r.set(lock_key, owner, nx=True, ex=lock_timeout)
    try:
        yield acquired, owner if acquired else None
    finally:
        if acquired:
            _release_lock(r, lock_key, owner)


@contextmanager
def acquire_proxy_lock(tenant_id: str, proxy_id: str, lock_timeout: int = 120):
    """Acquire a per-proxy distributed lock."""
    r = _get_redis()
    lock_key = f"lock:tenant:{tenant_id}:proxy:{proxy_id}"
    owner = str(uuid.uuid4())
    acquired = r.set(lock_key, owner, nx=True, ex=lock_timeout)
    try:
        yield acquired, owner if acquired else None
    finally:
        if acquired:
            _release_lock(r, lock_key, owner)


def get_daily_action_count(tenant_id: str, account_id: str) -> int:
    """Get today's action count for an account from Redis counter."""
    r = _get_redis()
    key = f"daily_actions:{tenant_id}:{account_id}:{time.strftime('%Y-%m-%d')}"
    count = r.get(key)
    return int(count) if count else 0


def increment_daily_actions(tenant_id: str, account_id: str, ttl: int = 86400) -> int:
    """Atomically increment daily action counter. Returns new count."""
    r = _get_redis()
    key = f"daily_actions:{tenant_id}:{account_id}:{time.strftime('%Y-%m-%d')}"
    count = r.incr(key)
    if count == 1:
        r.expire(key, ttl)
    return count
```

- [ ] **Step 2: Update poster.py to use new lock API**

In `poster.py`, change the lock usage:

```python
# Old:
with acquire_account_lock(tenant_id, account_id) as locked:
    if not locked:
        ...

# New:
with acquire_account_lock(tenant_id, account_id) as (locked, owner):
    if not locked:
        ...
```

- [ ] **Step 3: SCP + rebuild worker**

```bash
scp -i "..." services/worker/app/locks.py root@46.250.235.165:/opt/generator-ad/services/worker/app/locks.py
scp -i "..." services/worker/app/tasks/poster.py root@46.250.235.165:/opt/generator-ad/services/worker/app/tasks/poster.py
ssh root@46.250.235.165 "cd /opt/generator-ad && docker compose build worker-poster worker-listener worker-warmup && docker compose up -d --force-recreate worker-poster worker-listener worker-warmup"
```

---

## Batch 2: Billing Race + Rate Limiter (3 tasks)

### Task 4: Fix billing subscription fallback race

**Files:**
- Modify: `services/backend/app/routers/billing.py:460-508`

**Problem:** `_extend_subscription` and `_deactivate_subscription` fall back to "any active subscription" when ID not found. One customer's webhook can affect another customer.

- [ ] **Step 1: Remove fallback, require subscription_id match**

```python
async def _extend_subscription(customer_id: str | None, subscription_id: str):
    """Extend subscription on successful payment."""
    url = settings.DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(url)
    try:
        row = await conn.fetchrow(
            """SELECT tenant_id FROM subscriptions WHERE id::text = $1 LIMIT 1""",
            subscription_id,
        )
        if not row:
            log.warning(f"extend_subscription: no subscription found for {subscription_id}")
            return
        await conn.execute(
            """UPDATE subscriptions SET status = 'active',
                current_period_start = NOW(),
                current_period_end = NOW() + INTERVAL '1 month',
                monthly_posts_used = 0
               WHERE tenant_id = $1""",
            row["tenant_id"],
        )
        log.info(f"Subscription extended: tenant={row['tenant_id']}")
    finally:
        await conn.close()


async def _deactivate_subscription(customer_id: str | None, subscription_id: str):
    """Deactivate subscription on cancellation."""
    url = settings.DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(url)
    try:
        row = await conn.fetchrow(
            "SELECT tenant_id FROM subscriptions WHERE id::text = $1 LIMIT 1",
            subscription_id,
        )
        if not row:
            log.warning(f"deactivate_subscription: no subscription found for {subscription_id}")
            return
        await conn.execute(
            "UPDATE subscriptions SET status = 'cancelled' WHERE tenant_id = $1",
            row["tenant_id"],
        )
        log.info(f"Subscription deactivated: tenant={row['tenant_id']}")
    finally:
        await conn.close()
```

- [ ] **Step 2: SCP + rebuild backend**

```bash
scp -i "..." services/backend/app/routers/billing.py root@46.250.235.165:/opt/generator-ad/services/backend/app/routers/billing.py
ssh root@46.250.235.165 "cd /opt/generator-ad && docker compose build backend && docker compose up -d --force-recreate backend"
```

---

### Task 5: Fix in-memory rate limiter → Redis

**Files:**
- Modify: `services/worker/app/auto_reply.py:13, 115-121`

**Problem:** `_reply_counts` is per-process. With N workers, rate limit is N× intended.

- [ ] **Step 1: Replace in-memory dict with Redis sorted set**

```python
# Replace the in-memory dict and rate limit check:

# Old:
_reply_counts: dict[str, list[float]] = {}
# ... in send_auto_reply:
# max_per_hour = ai_config.get("max_replies_per_hour", 10)
# now = time.time()
# hour_ago = now - 3600
# if tenant_id not in _reply_counts:
#     _reply_counts[tenant_id] = []
#     _reply_counts[tenant_id] = [t for t in _reply_counts[tenant_id] if t > hour_ago]
#     if len(_reply_counts[tenant_id]) >= max_per_hour:
#         ...
#     _reply_counts[tenant_id].append(now)

# New (use Redis sorted set for cross-process rate limiting):
import os as _os

def _get_rate_limit_redis():
    import redis as _redis
    return _redis.Redis.from_url(
        _os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1"),
        decode_responses=True,
    )

def _check_and_increment_rate_limit(tenant_id: str, max_per_hour: int) -> bool:
    """Check rate limit using Redis sorted set. Returns True if allowed."""
    r = _get_rate_limit_redis()
    key = f"auto_reply_rate:{tenant_id}"
    now = time.time()
    hour_ago = now - 3600
    pipe = r.pipeline()
    pipe.zremrangebyscore(key, 0, hour_ago)  # remove old entries
    pipe.zadd(key, {str(now): now})
    pipe.zcard(key)
    pipe.expire(key, 3600)
    results = pipe.execute()
    count = results[2]
    return count <= max_per_hour
```

- [ ] **Step 2: Update the rate limit check in send_auto_reply**

Replace the rate limit block:

```python
    # Rate limiting
    max_per_hour = ai_config.get("max_replies_per_hour", 10)
    if not _check_and_increment_rate_limit(tenant_id, max_per_hour):
        log.warning(f"Auto-reply rate limit reached for tenant {tenant_id}")
        return
```

- [ ] **Step 3: Remove the old append at the end**

Remove `_reply_counts[tenant_id].append(now)` from the send section.

- [ ] **Step 4: SCP + rebuild worker**

```bash
scp -i "..." services/worker/app/auto_reply.py root@46.250.235.165:/opt/generator-ad/services/worker/app/auto_reply.py
ssh root@46.250.235.165 "cd /opt/generator-ad && docker compose build worker-listener && docker compose up -d --force-recreate worker-listener"
```

---

### Task 6: Fix rate limiter off-by-one

**Files:**
- Modify: `services/backend/app/rate_limiter.py` (find the `_check_rate_limit` function)

**Problem:** `<=` allows N+1 requests. Should be `<`.

- [ ] **Step 1: Find and fix the comparison**

```bash
# Find the file first
grep -rn "max_requests" services/backend/app/rate_limiter.py
```

Change `<=` to `<` in the rate limit check.

- [ ] **Step 2: SCP + rebuild backend**

---

## Batch 3: Medium Priority (6 tasks)

### Task 7: CORS — remove localhost from production

**Files:**
- Modify: `services/backend/app/main.py:69-76`

- [ ] **Step 1: Conditional CORS based on environment**

```python
ALLOWED_ORIGINS = [
    "https://24go.site",
    "https://www.24go.site",
    "https://app.24go.site",
]
if not _is_production:
    ALLOWED_ORIGINS.extend([
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8080",
    ])
```

- [ ] **Step 2: SCP + rebuild**

---

### Task 8: Dashboard port binding

**Files:**
- Modify: `docker-compose.yml:212`

- [ ] **Step 1: Bind to 127.0.0.1**

```yaml
    ports:
      - "127.0.0.1:3001:3000"
```

- [ ] **Step 2: SCP + recreate dashboard**

---

### Task 9: Password reset token — add jti

**Files:**
- Modify: `services/backend/app/routers/auth.py:360-368, 397-420`

- [ ] **Step 1: Add jti to token creation**

```python
import uuid as _uuid

reset_token = jwt.encode(
    {
        "sub": str(user.id),
        "type": "password_reset",
        "jti": str(_uuid.uuid4()),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    },
    settings.JWT_SECRET,
    algorithm=settings.JWT_ALGORITHM,
)
```

- [ ] **Step 2: Store jti in Redis on creation, check on use**

After creating the token, store it:

```python
# Store reset token jti in Redis (1 hour TTL)
r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
r.setex(f"reset_token:{jti}", 3600, str(user.id))
```

In `reset_password`, verify jti hasn't been used:

```python
payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
jti = payload.get("jti")
if not jti:
    raise HTTPException(400, "Invalid token")

r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
if not r.exists(f"reset_token:{jti}"):
    raise HTTPException(400, "Token already used or expired")

# After successful reset, delete the token
r.delete(f"reset_token:{jti}")
```

- [ ] **Step 3: SCP + rebuild**

---

### Task 10: Fix `get_all_statuses` crash on expired keys

**Files:**
- Modify: `services/worker/app/telegram_client.py:361`

- [ ] **Step 1: Add null check**

```python
def get_all_statuses() -> dict[str, dict]:
    r = _get_redis()
    keys = []
    cursor = 0
    while True:
        cursor, batch = r.scan(cursor, match="tg_status:*", count=100)
        keys.extend(batch)
        if cursor == 0:
            break
    statuses = {}
    for key in keys:
        raw = r.get(key)
        if raw is None:
            continue  # key expired between scan and get
        account_id = key.split(":", 1)[1]
        try:
            statuses[account_id] = json.loads(raw)
        except json.JSONDecodeError:
            continue
    return statuses
```

- [ ] **Step 2: SCP + rebuild worker**

---

### Task 11: Fix work hours timezone

**Files:**
- Modify: `services/worker/app/auto_reply.py:26-32`

**Problem:** Compares UTC hour against config values. If tenant configures `work_hours_start: 9` meaning 9am Bangkok (UTC+7), check is off by 7 hours.

- [ ] **Step 1: Accept timezone in config, convert before check**

```python
def _is_within_work_hours(start_hour: int, end_hour: int, timezone_str: str = "UTC") -> bool:
    """Check if current time is within work hours for the given timezone."""
    from datetime import datetime, timezone
    try:
        import pytz
        tz = pytz.timezone(timezone_str)
    except Exception:
        tz = timezone.utc
    now = datetime.now(tz).hour
    if start_hour <= end_hour:
        return start_hour <= now < end_hour
    return now >= start_hour or now < end_hour
```

Update the call site to pass timezone from config:

```python
tz = ai_config.get("timezone", "UTC")
if not _is_within_work_hours(start, end, tz):
```

- [ ] **Step 2: SCP + rebuild worker**

---

### Task 12: Fix default passwords in docker-compose

**Files:**
- Modify: `docker-compose.yml:10,29`

- [ ] **Step 1: Remove defaults, require .env**

```yaml
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
```

```yaml
    command: redis-server --requirepass ${REDIS_PASSWORD:?Set REDIS_PASSWORD in .env}
```

- [ ] **Step 2: SCP + recreate postgres and redis**

⚠️ Only if passwords are already set in .env on VPS. Verify first:

```bash
ssh root@46.250.235.165 "grep -E 'POSTGRES_PASSWORD|REDIS_PASSWORD' /opt/generator-ad/.env"
```

---

## Batch 4: Low Priority + Polish (5 tasks)

### Task 13: Fix `datetime.utcnow()` in blog.py

**Files:**
- Modify: `services/backend/app/routers/blog.py:144`

- [ ] **Step 1: Replace with timezone-aware**

```python
from datetime import datetime, timezone
# Replace: datetime.utcnow()
# With: datetime.now(timezone.utc)
```

---

### Task 14: Fix landing page scroll performance

**Files:**
- Modify: `services/dashboard/src/app/page.tsx:32-35`

- [ ] **Step 1: Throttle with requestAnimationFrame**

```typescript
useEffect(() => {
  let ticking = false;
  const handleScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        ticking = false;
      });
      ticking = true;
    }
  };
  window.addEventListener("scroll", handleScroll, { passive: true });
  return () => window.removeEventListener("scroll", handleScroll);
}, []);
```

---

### Task 15: Health check — reuse pool connection

**Files:**
- Modify: `services/backend/app/main.py:295-310`

- [ ] **Step 1: Use existing DB session instead of raw connect**

```python
@app.get("/health")
async def health():
    checks = {"status": "ok", "ws_connections": ws_manager.active_tenants()}
    try:
        from app.database import engine
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"
        checks["status"] = "degraded"
    return checks
```

---

### Task 16: CSP — remove unsafe-eval

**Files:**
- Modify: `services/dashboard/next.config.js:22`

- [ ] **Step 1: Remove unsafe-eval from script-src**

```javascript
"script-src 'self' 'unsafe-inline'",
```

⚠️ Test that the dashboard still works after this change. Next.js 13+ should work without `unsafe-eval`.

---

### Task 17: Fix CSV import memory + file size limit

**Files:**
- Modify: `services/backend/app/routers/leads.py:275-278, 107-110`

- [ ] **Step 1: Add file size check (max 10MB)**

```python
MAX_IMPORT_SIZE = 10 * 1024 * 1024  # 10MB

@router.post("/import-csv")
async def import_csv(...):
    content = await body.file.read()
    if len(content) > MAX_IMPORT_SIZE:
        raise HTTPException(413, "File too large (max 10MB)")
    # ... rest of import
```

- [ ] **Step 2: Batch dedup check instead of loading all into memory**

```python
# Instead of loading all user_handles into a set:
# Use DB-side dedup with temporary table or batched IN queries
```

---

## Deployment Notes

**Batch 1-2 (worker changes):** Requires Docker rebuild of worker containers:
```bash
ssh root@46.250.235.165 "cd /opt/generator-ad && docker compose build worker-listener worker-poster worker-warmup worker-parser && docker compose up -d --force-recreate worker-listener worker-poster worker-warmup worker-parser"
```

**Batch 3-4 (backend changes):** Requires Docker rebuild of backend:
```bash
ssh root@46.250.235.165 "cd /opt/generator-ad && docker compose build backend && docker compose up -d --force-recreate backend"
```

**Frontend changes:** Git push → Vercel auto-deploy.
