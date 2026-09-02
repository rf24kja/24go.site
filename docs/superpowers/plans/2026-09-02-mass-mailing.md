# Mass Mailing / Broadcasting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mass mailing (broadcasting) feature that lets clients send personalized Telegram/VK messages to imported recipient lists with anti-spam protections.

**Architecture:** Backend models + router for CRUD, Celery task for async message sending with account rotation and randomized delays, frontend page with drag-and-drop CSV import and progress tracking.

**Tech Stack:** FastAPI, SQLAlchemy (asyncpg), Celery + Redis, React/Next.js, Tailwind CSS

## Global Constraints

- UUID primary keys on all models (asyncpg-compatible)
- Tenant isolation via `tenant_id` column + RLS middleware
- Anti-spam: random delay ±30%, account rotation, daily limits, flood-wait pause
- Follow existing code patterns (see models.py, routers/leads.py, tasks/poster.py)

---

## File Structure

| Action | File |
|--------|------|
| Create | `services/backend/app/models.py` — add `MailingStatus`, `MailingRecipientStatus`, `Mailing`, `MailingRecipient` |
| Create | `services/backend/app/schemas.py` — add mailing request/response schemas |
| Create | `services/backend/app/routers/mailings.py` — CRUD + import + start/pause/stop |
| Modify | `services/backend/app/main.py:264-281` — register mailings router |
| Create | `services/worker/app/tasks/mailer.py` — Celery task for sending |
| Modify | `services/worker/app/celery_app.py:21-33` — add task route |
| Create | `services/dashboard/src/app/(dashboard)/mailings/page.tsx` — frontend page |
| Modify | `services/dashboard/src/components/Sidebar.tsx:26-41` — add nav item |
| Modify | `services/dashboard/src/lib/api.ts:489` — add API client functions |
| Modify | `services/dashboard/src/lib/en.json:938` — add i18n keys |
| Modify | `services/dashboard/src/lib/ru.json:740` — add i18n keys |

---

### Task 1: Backend Models

**Files:**
- Modify: `services/backend/app/models.py`

**Interfaces:**
- Consumes: `Base` from `app.database`, `PlatformType` enum (existing)
- Produces: `Mailing`, `MailingRecipient` models for use by router and worker

- [ ] **Step 1: Add enums and models to models.py**

Append after the `BlogPost` class (line 317):

```python
# ── Mailing / Broadcasting ────────────────────────────────────────
class MailingStatus(str, enum.Enum):
    draft = "draft"
    running = "running"
    paused = "paused"
    completed = "completed"


class MailingRecipientStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    failed = "failed"
    blocked = "blocked"


class Mailing(Base):
    __tablename__ = "mailings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    message_text = Column(Text, nullable=False)
    platform = Column(Enum(PlatformType, name="platform_type"), nullable=False)
    status = Column(Enum(MailingStatus, name="mailing_status"), nullable=False, default=MailingStatus.draft)
    total_count = Column(Integer, nullable=False, default=0)
    sent_count = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)
    delay_seconds = Column(Integer, nullable=False, default=30)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    started_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_mailings_tenant", "tenant_id", "status"),
    )

    recipients = relationship("MailingRecipient", back_populates="mailing", cascade="all, delete-orphan")


class MailingRecipient(Base):
    __tablename__ = "mailing_recipients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mailing_id = Column(UUID(as_uuid=True), ForeignKey("mailings.id", ondelete="CASCADE"), nullable=False)
    username = Column(String(255), nullable=False)
    first_name = Column(String(255), nullable=True)
    status = Column(Enum(MailingRecipientStatus, name="mailing_recipient_status"), nullable=False, default=MailingRecipientStatus.pending)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_mailing_recipients_mailing", "mailing_id", "status"),
    )

    mailing = relationship("Mailing", back_populates="recipients")
```

Also add to `Tenant` relationship list (after line 78):
```python
    mailings = relationship("Mailing", back_populates="tenant", cascade="all, delete-orphan")
```

- [ ] **Step 2: Run a quick syntax check**

Run: `cd services/backend && python -c "from app.models import Mailing, MailingRecipient; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add services/backend/app/models.py
git commit -m "feat: add Mailing and MailingRecipient models"
```

---

### Task 2: Backend Schemas

**Files:**
- Modify: `services/backend/app/schemas.py`

**Interfaces:**
- Consumes: `Mailing` model (Task 1)
- Produces: Pydantic schemas for router validation

- [ ] **Step 1: Add mailing schemas**

Append to end of `schemas.py`:

```python
# ── Mailing ────────────────────────────────────────────────────────
class MailingCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    message_text: str = Field(..., min_length=1, max_length=5000)
    platform: str = Field(..., pattern="^(telegram|vkontakte)$")
    delay_seconds: int = Field(default=30, ge=5, le=300)


class MailingResponse(BaseModel):
    id: UUID
    name: str
    message_text: str
    platform: str
    status: str
    total_count: int
    sent_count: int
    failed_count: int
    delay_seconds: int
    created_at: datetime | None = None
    started_at: datetime | None = None

    class Config:
        from_attributes = True


class MailingRecipientResponse(BaseModel):
    id: UUID
    username: str
    first_name: str | None
    status: str
    error_message: str | None
    sent_at: datetime | None = None

    class Config:
        from_attributes = True


class MailingImportRequest(BaseModel):
    file: str = Field(..., description="CSV content (username, first_name optional)")
```

- [ ] **Step 2: Commit**

```bash
git add services/backend/app/schemas.py
git commit -m "feat: add mailing Pydantic schemas"
```

---

### Task 3: Backend Router

**Files:**
- Create: `services/backend/app/routers/mailings.py`
- Modify: `services/backend/app/main.py` (register router)

**Interfaces:**
- Consumes: `Mailing`, `MailingRecipient` models, schemas from Task 2, `get_current_user` from security, `get_db` from database
- Produces: API endpoints, Celery task dispatch

- [ ] **Step 1: Create the mailings router**

Create `services/backend/app/routers/mailings.py`:

```python
"""Mailing (broadcasting) endpoints: CRUD, import recipients, start/pause/stop."""
import csv
import io
import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Mailing, MailingRecipient, MailingStatus, MailingRecipientStatus, User
from app.security import get_current_user
from app.schemas import MailingCreate, MailingResponse, MailingRecipientResponse, MailingImportRequest

router = APIRouter(prefix="/api/v1/mailings", tags=["mailings"])


@router.post("/", response_model=MailingResponse)
async def create_mailing(
    body: MailingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mailing = Mailing(
        id=_uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        name=body.name,
        message_text=body.message_text,
        platform=body.platform,
        delay_seconds=body.delay_seconds,
    )
    db.add(mailing)
    await db.commit()
    await db.refresh(mailing)
    return mailing


@router.get("/", response_model=dict)
async def list_mailings(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Mailing).where(Mailing.tenant_id == current_user.tenant_id)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(q.order_by(Mailing.created_at.desc()).limit(limit).offset(offset))
    items = result.scalars().all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/{mailing_id}")
async def get_mailing(
    mailing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Mailing).where(
        Mailing.id == _uuid.UUID(mailing_id),
        Mailing.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    mailing = result.scalar_one_or_none()
    if not mailing:
        raise HTTPException(404, "Mailing not found")

    # Get recipient counts by status
    rq = select(
        MailingRecipient.status,
        func.count().label("count"),
    ).where(MailingRecipient.mailing_id == mailing.id).group_by(MailingRecipient.status)
    r_result = await db.execute(rq)
    counts = {row[0].value if hasattr(row[0], "value") else row[0]: row[1] for row in r_result.all()}

    return {
        "id": str(mailing.id),
        "name": mailing.name,
        "message_text": mailing.message_text,
        "platform": mailing.platform.value if hasattr(mailing.platform, "value") else mailing.platform,
        "status": mailing.status.value if hasattr(mailing.status, "value") else mailing.status,
        "total_count": mailing.total_count,
        "sent_count": mailing.sent_count,
        "failed_count": mailing.failed_count,
        "delay_seconds": mailing.delay_seconds,
        "created_at": mailing.created_at.isoformat() if mailing.created_at else None,
        "started_at": mailing.started_at.isoformat() if mailing.started_at else None,
        "recipient_counts": counts,
    }


@router.post("/import")
async def import_recipients(
    body: MailingImportRequest,
    mailing_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import recipients from CSV text. Columns: username, first_name (optional).
    If mailing_id is provided, adds to existing mailing. Otherwise creates a new draft.
    """
    if mailing_id:
        q = select(Mailing).where(
            Mailing.id == _uuid.UUID(mailing_id),
            Mailing.tenant_id == current_user.tenant_id,
        )
        result = await db.execute(q)
        mailing = result.scalar_one_or_none()
        if not mailing:
            raise HTTPException(404, "Mailing not found")
    else:
        mailing = Mailing(
            id=_uuid.uuid4(),
            tenant_id=current_user.tenant_id,
            name="Imported Mailing",
            message_text="",
            platform="telegram",
        )
        db.add(mailing)
        await db.flush()

    reader = csv.DictReader(io.StringIO(body.file))
    imported = 0
    skipped = 0
    errors = []

    for i, row in enumerate(reader, start=2):
        try:
            username = (row.get("username") or row.get("user") or "").strip().lstrip("@")
            first_name = (row.get("first_name") or row.get("name") or "").strip()
            if not username:
                errors.append(f"Row {i}: missing username")
                skipped += 1
                continue

            recipient = MailingRecipient(
                id=_uuid.uuid4(),
                mailing_id=mailing.id,
                username=username,
                first_name=first_name or None,
            )
            db.add(recipient)
            imported += 1
        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
            skipped += 1

    mailing.total_count += imported
    await db.commit()

    return {
        "mailing_id": str(mailing.id),
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:50],
    }


@router.post("/{mailing_id}/start")
async def start_mailing(
    mailing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Mailing).where(
        Mailing.id == _uuid.UUID(mailing_id),
        Mailing.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    mailing = result.scalar_one_or_none()
    if not mailing:
        raise HTTPException(404, "Mailing not found")

    if mailing.status not in (MailingStatus.draft, MailingStatus.paused):
        raise HTTPException(400, f"Cannot start mailing in {mailing.status} status")

    mailing.status = MailingStatus.running
    from datetime import datetime, timezone
    mailing.started_at = datetime.now(timezone.utc)
    await db.commit()

    # Dispatch Celery task
    from app.tasks.mailer import process_mailing
    process_mailing.delay(str(mailing.id), str(current_user.tenant_id))

    return {"status": "started", "mailing_id": str(mailing.id)}


@router.post("/{mailing_id}/pause")
async def pause_mailing(
    mailing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Mailing).where(
        Mailing.id == _uuid.UUID(mailing_id),
        Mailing.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    mailing = result.scalar_one_or_none()
    if not mailing:
        raise HTTPException(404, "Mailing not found")

    if mailing.status != MailingStatus.running:
        raise HTTPException(400, "Can only pause running mailings")

    mailing.status = MailingStatus.paused
    await db.commit()
    return {"status": "paused"}


@router.post("/{mailing_id}/stop")
async def stop_mailing(
    mailing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Mailing).where(
        Mailing.id == _uuid.UUID(mailing_id),
        Mailing.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    mailing = result.scalar_one_or_none()
    if not mailing:
        raise HTTPException(404, "Mailing not found")

    mailing.status = MailingStatus.completed
    await db.commit()
    return {"status": "completed"}
```

- [ ] **Step 2: Register router in main.py**

Add after line 281 (`app.include_router(blog.router)`):
```python
from app.routers import mailings
app.include_router(mailings.router)
```

- [ ] **Step 3: Commit**

```bash
git add services/backend/app/routers/mailings.py services/backend/app/main.py
git commit -m "feat: add mailings router with CRUD, import, start/pause/stop"
```

---

### Task 4: Celery Mailer Task

**Files:**
- Create: `services/worker/app/tasks/mailer.py`
- Modify: `services/worker/app/celery_app.py`

**Interfaces:**
- Consumes: `Mailing`, `MailingRecipient` from DB, `AccountPool` for rotation, `locks` module, `WARMUP_LIMITS` from config
- Produces: Celery task `app.tasks.mailer.process_mailing`

- [ ] **Step 1: Create mailer.py**

Create `services/worker/app/tasks/mailer.py`:

```python
"""Mailer task: sends personalized messages to mailing recipients with anti-spam protections.

Processes recipients in batches, rotates accounts, randomizes delays ±30%,
respects daily limits, and pauses on flood-wait.
"""
import asyncio
import logging
import random
import time
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
    """Replace {first_name} and {username} placeholders."""
    name = first_name or username
    return template.replace("{first_name}", name).replace("{username}", f"@{username}")


def _get_random_delay(base_seconds: int) -> float:
    """Randomize delay ±30% to avoid pattern detection."""
    jitter = base_seconds * 0.3
    return base_seconds + random.uniform(-jitter, jitter)


def _select_account(accounts: list, used_ids: set) -> dict | None:
    """Pick an active account not at daily limit, preferring least-used."""
    candidates = [
        a for a in accounts
        if a["status"] == "active"
        and a["actions_today"] < a["daily_action_limit"]
        and str(a["id"]) not in used_ids
    ]
    if not candidates:
        # Fallback: include used accounts if no fresh ones available
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
    """Process all pending recipients for a mailing campaign.

    Fetches recipients in batches, sends via Telethon, handles errors.
    Checks mailing status between batches to respect pause/stop.
    """
    import asyncpg

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
    from datetime import datetime, timezone

    conn = await asyncpg.connect(db_url)
    try:
        # Load mailing
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

        # Load available accounts for this tenant
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

        # Process in batches
        while True:
            # Check if mailing is still running
            status = await conn.fetchval(
                "SELECT status FROM mailings WHERE id = $1",
                uuid_mod.UUID(mailing_id),
            )
            if status != "running":
                log.info(f"Mailing {mailing_id} status changed to {status}, stopping")
                break

            # Fetch next batch of pending recipients
            recipients = await conn.fetch(
                "SELECT id, username, first_name FROM mailing_recipients "
                "WHERE mailing_id = $1 AND status = 'pending' ORDER BY id LIMIT $2",
                uuid_mod.UUID(mailing_id), BATCH_SIZE,
            )
            if not recipients:
                log.info(f"Mailing {mailing_id}: all recipients processed")
                break

            for recipient in recipients:
                # Re-check mailing status periodically
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
                    # Try to send via Telethon
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
                        # Failed — mark recipient
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

                # Randomized delay between messages
                actual_delay = _get_random_delay(delay)
                await asyncio.sleep(actual_delay)

            # Mark completed if no more pending
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

        # Disconnect any clients used
        for aid in used_account_ids:
            try:
                await disconnect_client(aid)
            except Exception:
                pass

    finally:
        await conn.close()


async def _send_dm(account_id: str, username: str, text: str) -> dict:
    """Send a direct message via Telethon."""
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
```

- [ ] **Step 2: Add task route to celery_app.py**

Add to `task_routes` dict (after line 33):
```python
        "app.tasks.mailer.*": {"queue": "poster"},
```

- [ ] **Step 3: Commit**

```bash
git add services/worker/app/tasks/mailer.py services/worker/app/celery_app.py
git commit -m "feat: add mailer Celery task with anti-spam protections"
```

---

### Task 5: Frontend API Client Functions

**Files:**
- Modify: `services/dashboard/src/lib/api.ts`

**Interfaces:**
- Consumes: existing `api()` helper
- Produces: functions for mailings page

- [ ] **Step 1: Add mailing API functions**

Append to end of `api.ts`:

```typescript
// ── Mailings ─────────────────────────────────────────────────────
export async function getMailings(token: string, params?: { limit?: number; offset?: number }) {
  const qs = new URLSearchParams(params as any).toString();
  return api<{ items: any[]; total: number; limit: number; offset: number }>(`/api/v1/mailings/${qs ? `?${qs}` : ""}`, { token });
}

export async function createMailing(token: string, data: { name: string; message_text: string; platform: string; delay_seconds: number }) {
  return api<any>("/api/v1/mailings/", { method: "POST", body: JSON.stringify(data), token });
}

export async function getMailing(token: string, mailingId: string) {
  return api<any>(`/api/v1/mailings/${mailingId}`, { token });
}

export async function importMailingRecipients(token: string, csvContent: string, mailingId?: string) {
  const qs = mailingId ? `?mailing_id=${mailingId}` : "";
  return api<any>(`/api/v1/mailings/import${qs}`, {
    method: "POST",
    body: JSON.stringify({ file: csvContent }),
    token,
  });
}

export async function startMailing(token: string, mailingId: string) {
  return api<any>(`/api/v1/mailings/${mailingId}/start`, { method: "POST", token });
}

export async function pauseMailing(token: string, mailingId: string) {
  return api<any>(`/api/v1/mailings/${mailingId}/pause`, { method: "POST", token });
}

export async function stopMailing(token: string, mailingId: string) {
  return api<any>(`/api/v1/mailings/${mailingId}/stop`, { method: "POST", token });
}
```

- [ ] **Step 2: Commit**

```bash
git add services/dashboard/src/lib/api.ts
git commit -m "feat: add mailing API client functions"
```

---

### Task 6: Frontend Page

**Files:**
- Create: `services/dashboard/src/app/(dashboard)/mailings/page.tsx`

**Interfaces:**
- Consumes: `useAuth`, `useI18n`, `useToast` hooks, API functions from Task 5
- Produces: Mailing list, create form, import, detail view

- [ ] **Step 1: Create the mailings page**

Create `services/dashboard/src/app/(dashboard)/mailings/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import { Spinner } from "@/components/Spinner";
import { CardSkeleton } from "@/components/Skeleton";
import {
  getMailings, createMailing, getMailing, importMailingRecipients,
  startMailing, pauseMailing, stopMailing,
} from "@/lib/api";

type Mailing = {
  id: string;
  name: string;
  message_text: string;
  platform: string;
  status: string;
  total_count: number;
  sent_count: number;
  failed_count: number;
  delay_seconds: number;
  created_at: string | null;
  started_at: string | null;
  recipient_counts?: Record<string, number>;
};

export default function MailingsPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [mailings, setMailings] = useState<Mailing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importMailId, setImportMailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Mailing | null>(null);
  const [form, setForm] = useState({ name: "", message_text: "", platform: "telegram", delay_seconds: "30" });
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    if (!auth?.token) return;
    setLoading(true);
    getMailings(auth.token).then((res) => setMailings(res.items || [])).catch(() => setMailings([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [auth?.token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.token) return;
    setSaving(true);
    try {
      await createMailing(auth.token, {
        name: form.name,
        message_text: form.message_text,
        platform: form.platform,
        delay_seconds: parseInt(form.delay_seconds) || 30,
      });
      setShowCreate(false);
      setForm({ name: "", message_text: "", platform: "telegram", delay_seconds: "30" });
      load();
      toast(t("mailings.created"), "success");
    } catch (e: any) {
      toast(e.message || t("mailings.createFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (file: File) => {
    if (!auth?.token) return;
    const text = await file.text();
    try {
      const res = await importMailingRecipients(auth.token, text, importMailId || undefined);
      toast(t("mailings.importResult", { imported: res.imported, skipped: res.skipped }), "success");
      setShowImport(false);
      setImportMailId(null);
      if (res.imported > 0) load();
    } catch (e: any) {
      toast(e.message || t("mailings.importFailed"), "error");
    }
  };

  const openDetail = async (id: string) => {
    if (!auth?.token) return;
    try {
      const data = await getMailing(auth.token, id);
      setDetail(data);
    } catch (e: any) {
      toast(e.message || t("mailings.loadFailed"), "error");
    }
  };

  const handleStart = async (id: string) => {
    if (!auth?.token) return;
    try { await startMailing(auth.token, id); toast(t("mailings.started"), "success"); load(); } catch (e: any) { toast(e.message, "error"); }
  };

  const handlePause = async (id: string) => {
    if (!auth?.token) return;
    try { await pauseMailing(auth.token, id); toast(t("mailings.paused"), "success"); load(); } catch (e: any) { toast(e.message, "error"); }
  };

  const handleStop = async (id: string) => {
    if (!auth?.token) return;
    try { await stopMailing(auth.token, id); toast(t("mailings.stopped"), "success"); load(); } catch (e: any) { toast(e.message, "error"); }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImport(file);
  };

  const statusColor = (s: string) => {
    if (s === "running") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (s === "paused") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    if (s === "completed") return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  };

  const progress = (m: Mailing) => m.total_count > 0 ? Math.round(((m.sent_count + m.failed_count) / m.total_count) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-slide-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("mailings.title")}</h1>
        <div className="flex gap-2">
          <button onClick={() => { setShowImport(true); setImportMailId(null); }}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 btn-press">
            {t("mailings.import")}
          </button>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 btn-press">
            {t("mailings.newMailing")}
          </button>
        </div>
      </div>

      {loading ? (
        <CardSkeleton count={4} />
      ) : mailings.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-300 font-medium mb-2">{t("mailings.empty")}</p>
          <p className="text-xs text-zinc-500 mb-4">{t("mailings.emptyDesc")}</p>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition">
            {t("mailings.createFirst")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mailings.map((m) => (
            <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3 cursor-pointer hover:border-zinc-700 transition"
              onClick={() => openDetail(m.id)}>
              <div className="flex items-start justify-between">
                <h2 className="text-zinc-100 font-medium truncate">{m.name}</h2>
                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${statusColor(m.status)}`}>
                  {t(`mailings.status.${m.status}`)}
                </span>
              </div>
              <p className="text-zinc-400 text-sm line-clamp-2">{m.message_text}</p>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{m.platform === "telegram" ? "✈️" : "🔵"} {m.platform}</span>
                <span>·</span>
                <span>{m.total_count} {t("mailings.recipients")}</span>
                <span>·</span>
                <span>{t("mailings.delay")}: {m.delay_seconds}s</span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-zinc-800 rounded-full h-1.5">
                <div className="bg-emerald-500/50 h-1.5 rounded-full transition-all" style={{ width: `${progress(m)}%` }} />
              </div>
              <div className="flex gap-2 text-xs text-zinc-500">
                <span className="text-emerald-400">{m.sent_count} {t("mailings.sent")}</span>
                <span className="text-rose-400">{m.failed_count} {t("mailings.failed")}</span>
                <span>{m.total_count - m.sent_count - m.failed_count} {t("mailings.pending")}</span>
              </div>
              <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                {m.status === "draft" && (
                  <button onClick={() => handleStart(m.id)} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs hover:bg-emerald-500/20 transition">
                    ▶ {t("mailings.start")}
                  </button>
                )}
                {m.status === "running" && (
                  <button onClick={() => handlePause(m.id)} className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-xs hover:bg-amber-500/20 transition">
                    ⏸ {t("mailings.pause")}
                  </button>
                )}
                {m.status === "paused" && (
                  <button onClick={() => handleStart(m.id)} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs hover:bg-emerald-500/20 transition">
                    ▶ {t("mailings.resume")}
                  </button>
                )}
                {(m.status === "running" || m.status === "paused") && (
                  <button onClick={() => handleStop(m.id)} className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-xs hover:bg-rose-500/20 transition">
                    ⏹ {t("mailings.stop")}
                  </button>
                )}
                <button onClick={() => { setShowImport(true); setImportMailId(m.id); }}
                  className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded text-xs hover:bg-zinc-700 transition">
                  + {t("mailings.addRecipients")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-100">{t("mailings.createTitle")}</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">{t("mailings.nameLabel")}</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100"
                  placeholder={t("mailings.namePlaceholder")} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">{t("mailings.messageLabel")}</label>
                <textarea required rows={4} value={form.message_text} onChange={(e) => setForm({ ...form, message_text: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 resize-none"
                  placeholder={t("mailings.messagePlaceholder")} />
                <p className="text-[10px] text-zinc-600 mt-1">{t("mailings.messageHint")}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t("mailings.platform")}</label>
                  <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100">
                    <option value="telegram">Telegram</option>
                    <option value="vkontakte">VKontakte</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">{t("mailings.delayLabel")}</label>
                  <input type="number" min="5" max="300" value={form.delay_seconds}
                    onChange={(e) => setForm({ ...form, delay_seconds: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">
                  {t("mailings.cancel")}
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium disabled:opacity-50 btn-press">
                  {saving ? t("mailings.creating") : t("mailings.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => { setShowImport(false); setImportMailId(null); }}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-100">{t("mailings.importTitle")}</h2>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
                dragOver ? "border-emerald-500 bg-emerald-500/5" : "border-zinc-700"
              }`}>
              <p className="text-zinc-400 text-sm mb-2">{t("mailings.dropCsv")}</p>
              <p className="text-zinc-600 text-xs mb-4">{t("mailings.csvHint")}</p>
              <input ref={fileRef} type="file" accept=".csv,.json" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
              <button onClick={() => fileRef.current?.click()}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 transition">
                {t("mailings.selectFile")}
              </button>
            </div>
            <button onClick={() => { setShowImport(false); setImportMailId(null); }}
              className="w-full py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm">
              {t("mailings.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 bg-black/60 flex justify-end z-50" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto p-6 space-y-5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-100">{detail.name}</h2>
              <button onClick={() => setDetail(null)} className="text-zinc-500 hover:text-zinc-300 text-xl">&times;</button>
            </div>
            <div className="bg-zinc-800 rounded-lg p-3 text-sm space-y-2">
              <div className="flex justify-between text-zinc-400">
                <span>{t("mailings.status")}</span>
                <span className={`font-medium ${statusColor(detail.status).split(" ").filter(c => c.startsWith("text-")).join(" ")}`}>
                  {t(`mailings.status.${detail.status}`)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>{t("mailings.platform")}</span>
                <span className="text-zinc-200">{detail.platform}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>{t("mailings.delay")}</span>
                <span className="text-zinc-200">{detail.delay_seconds}s</span>
              </div>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2.5">
              <div className="bg-emerald-500 h-2.5 rounded-full transition-all" style={{ width: `${progress(detail)}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-800 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">{detail.sent_count}</p>
                <p className="text-xs text-zinc-500">{t("mailings.sent")}</p>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-rose-400">{detail.failed_count}</p>
                <p className="text-xs text-zinc-500">{t("mailings.failed")}</p>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-zinc-100">{detail.total_count}</p>
                <p className="text-xs text-zinc-500">{t("mailings.total")}</p>
              </div>
            </div>
            <div>
              <h3 className="text-xs text-zinc-500 mb-2">{t("mailings.message")}</h3>
              <div className="bg-zinc-800 rounded-lg p-3 text-sm text-zinc-300 whitespace-pre-wrap">{detail.message_text}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add services/dashboard/src/app/\(dashboard\)/mailings/page.tsx
git commit -m "feat: add mailings page with list, create, import, detail view"
```

---

### Task 7: Sidebar Navigation

**Files:**
- Modify: `services/dashboard/src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `useI18n` hook, `Send` icon
- Produces: sidebar nav item

- [ ] **Step 1: Add Send icon import**

Add `Send` to the import from Icons (line 11):
```typescript
import {
  ChartBar, Crosshair, Scales, Radar, Radio, UserCircle,
  Megaphone, CreditCard, UsersGroup, FileText, Heartbeat,
  Cog, LogOut, Cross, Menu, Pen, Send,
} from "@/components/Icons";
```

- [ ] **Step 2: Add nav item**

Add after the campaigns entry (after line 33):
```typescript
    { href: "/mailings", label: t("sidebar.mailings"), icon: Send },
```

- [ ] **Step 3: Commit**

```bash
git add services/dashboard/src/components/Sidebar.tsx
git commit -m "feat: add Mailings nav item to sidebar"
```

---

### Task 8: i18n Keys

**Files:**
- Modify: `services/dashboard/src/lib/en.json`
- Modify: `services/dashboard/src/lib/ru.json`

**Interfaces:**
- Consumes: none
- Produces: i18n translations

- [ ] **Step 1: Add English keys**

Add before the closing `}` in `en.json`:

```json
  "sidebar.mailings": "Mailings",

  "mailings.title": "Mailings",
  "mailings.newMailing": "New Mailing",
  "mailings.import": "Import",
  "mailings.empty": "No mailings yet",
  "mailings.emptyDesc": "Create a mailing campaign to send personalized messages to your recipient list.",
  "mailings.createFirst": "+ Create your first mailing",
  "mailings.created": "Mailing created",
  "mailings.createFailed": "Failed to create mailing",
  "mailings.createTitle": "New Mailing",
  "mailings.nameLabel": "Campaign name",
  "mailings.namePlaceholder": "e.g., New Year promo",
  "mailings.messageLabel": "Message template",
  "mailings.messagePlaceholder": "Hi {first_name}, check out our new offer!",
  "mailings.messageHint": "Use {first_name} and {username} for personalization",
  "mailings.platform": "Platform",
  "mailings.delayLabel": "Delay (sec)",
  "mailings.creating": "Creating...",
  "mailings.create": "Create",
  "mailings.cancel": "Cancel",
  "mailings.recipients": "recipients",
  "mailings.delay": "Delay",
  "mailings.sent": "sent",
  "mailings.failed": "failed",
  "mailings.pending": "pending",
  "mailings.total": "Total",
  "mailings.status.draft": "Draft",
  "mailings.status.running": "Running",
  "mailings.status.paused": "Paused",
  "mailings.status.completed": "Completed",
  "mailings.start": "Start",
  "mailings.resume": "Resume",
  "mailings.pause": "Pause",
  "mailings.stop": "Stop",
  "mailings.started": "Mailing started",
  "mailings.paused": "Mailing paused",
  "mailings.stopped": "Mailing stopped",
  "mailings.addRecipients": "Add Recipients",
  "mailings.importTitle": "Import Recipients",
  "mailings.dropCsv": "Drop CSV file here",
  "mailings.csvHint": "Columns: username, first_name (optional)",
  "mailings.selectFile": "Select File",
  "mailings.importResult": "Imported: {imported}, Skipped: {skipped}",
  "mailings.importFailed": "Import failed",
  "mailings.loadFailed": "Failed to load mailing",
  "mailings.message": "Message"
```

- [ ] **Step 2: Add Russian keys**

Add before the closing `}` in `ru.json`:

```json
  "sidebar.mailings": "Рассылка",

  "mailings.title": "Рассылки",
  "mailings.newMailing": "Новая рассылка",
  "mailings.import": "Импорт",
  "mailings.empty": "Рассылок пока нет",
  "mailings.emptyDesc": "Создайте рассылку для отправки персонализированных сообщений вашим получателям.",
  "mailings.createFirst": "+ Создайте первую рассылку",
  "mailings.created": "Рассылка создана",
  "mailings.createFailed": "Не удалось создать рассылку",
  "mailings.createTitle": "Новая рассылка",
  "mailings.nameLabel": "Название кампании",
  "mailings.namePlaceholder": "напр., Новогодняя акция",
  "mailings.messageLabel": "Шаблон сообщения",
  "mailings.messagePlaceholder": "Привет, {first_name}! Посмотрите наше новое предложение!",
  "mailings.messageHint": "Используйте {first_name} и {username} для персонализации",
  "mailings.platform": "Платформа",
  "mailings.delayLabel": "Задержка (сек)",
  "mailings.creating": "Создание...",
  "mailings.create": "Создать",
  "mailings.cancel": "Отмена",
  "mailings.recipients": "получателей",
  "mailings.delay": "Задержка",
  "mailings.sent": "отправлено",
  "mailings.failed": "ошибки",
  "mailings.pending": "ожидание",
  "mailings.total": "Всего",
  "mailings.status.draft": "Черновик",
  "mailings.status.running": "Выполняется",
  "mailings.status.paused": "Приостановлена",
  "mailings.status.completed": "Завершена",
  "mailings.start": "Запустить",
  "mailings.resume": "Продолжить",
  "mailings.pause": "Пауза",
  "mailings.stop": "Остановить",
  "mailings.started": "Рассылка запущена",
  "mailings.paused": "Рассылка приостановлена",
  "mailings.stopped": "Рассылка остановлена",
  "mailings.addRecipients": "Добавить получателей",
  "mailings.importTitle": "Импорт получателей",
  "mailings.dropCsv": "Перетащите CSV файл сюда",
  "mailings.csvHint": "Колонки: username, first_name (необязательно)",
  "mailings.selectFile": "Выбрать файл",
  "mailings.importResult": "Импортировано: {imported}, пропущено: {skipped}",
  "mailings.importFailed": "Ошибка импорта",
  "mailings.loadFailed": "Не удалось загрузить рассылку",
  "mailings.message": "Сообщение"
```

- [ ] **Step 3: Commit**

```bash
git add services/dashboard/src/lib/en.json services/dashboard/src/lib/ru.json
git commit -m "feat: add i18n keys for mailings feature"
```

---

### Task 9: Database Migration

**Files:**
- Create: manual SQL migration

**Interfaces:**
- Consumes: models from Task 1
- Produces: `mailings` and `mailing_recipients` tables

- [ ] **Step 1: Create migration SQL**

Create `services/backend/migrations/003_mailings.sql`:

```sql
-- Migration 003: Add mailings and mailing_recipients tables
-- Run against the app_db database

CREATE TYPE mailing_status AS ENUM ('draft', 'running', 'paused', 'completed');
CREATE TYPE mailing_recipient_status AS ENUM ('pending', 'sent', 'failed', 'blocked');

CREATE TABLE IF NOT EXISTS mailings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    message_text TEXT NOT NULL,
    platform platform_type NOT NULL,
    status mailing_status NOT NULL DEFAULT 'draft',
    total_count INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    delay_seconds INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ
);

CREATE INDEX idx_mailings_tenant ON mailings(tenant_id, status);

CREATE TABLE IF NOT EXISTS mailing_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailing_id UUID NOT NULL REFERENCES mailings(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    status mailing_recipient_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    sent_at TIMESTAMPTZ
);

CREATE INDEX idx_mailing_recipients_mailing ON mailing_recipients(mailing_id, status);
```

- [ ] **Step 2: Commit**

```bash
git add services/backend/migrations/003_mailings.sql
git commit -m "feat: add mailings migration SQL"
```

---

## Self-Review Checklist

1. **Spec coverage:** All 6 endpoints ✓, DB tables ✓, Celery task ✓, Frontend page ✓, Sidebar ✓, i18n ✓, Anti-spam protections ✓
2. **Placeholder scan:** No TBDs — all code is complete
3. **Type consistency:** `MailingStatus`/`MailingRecipientStatus` enums used consistently in models, router, and task. Frontend status strings match enum values.

---

## Summary of Files Created/Changed

| File | Action |
|------|--------|
| `services/backend/app/models.py` | Modified — added Mailing + MailingRecipient models |
| `services/backend/app/schemas.py` | Modified — added mailing Pydantic schemas |
| `services/backend/app/routers/mailings.py` | **Created** — 7 endpoints |
| `services/backend/app/main.py` | Modified — registered mailings router |
| `services/worker/app/tasks/mailer.py` | **Created** — Celery task |
| `services/worker/app/celery_app.py` | Modified — added task route |
| `services/backend/migrations/003_mailings.sql` | **Created** — DB migration |
| `services/dashboard/src/app/(dashboard)/mailings/page.tsx` | **Created** — frontend page |
| `services/dashboard/src/components/Sidebar.tsx` | Modified — added nav item |
| `services/dashboard/src/lib/api.ts` | Modified — added API functions |
| `services/dashboard/src/lib/en.json` | Modified — added i18n keys |
| `services/dashboard/src/lib/ru.json` | Modified — added i18n keys |
