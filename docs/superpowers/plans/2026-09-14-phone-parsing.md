# Phone Parsing Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WhatsApp group participant parsing with cross-platform contact database, campaign integration, and CSV export.

**Architecture:** Node.js sidecar (`wa-sidecar:3100`) runs Baileys for WhatsApp protocol. Backend FastAPI router manages contacts in PostgreSQL. Celery worker handles background parsing. Next.js frontend adds third platform tab (WA) with account management, group parsing, and contact database pages.

**Tech Stack:** Baileys (Node.js), FastAPI, SQLAlchemy async, Celery + Redis, PostgreSQL, Next.js App Router, Tailwind CSS

## Global Constraints

- PostgreSQL 16.15 with RLS (`SET LOCAL app.current_tenant`)
- Docker port 5434 (5432 occupied on VPS)
- `passlib` requires `bcrypt==4.2.0` (not 5.x)
- VPS SSH: `C:\Users\rf24k\.ssh\id_ed25519_generator` → `46.250.235.165`
- VPS project: `/opt/generator-ad/` (SCP deploy, NOT git)
- Frontend on Vercel (git push to main)
- EN/RU i18n, 2850+ keys in both locales
- Mobile-responsive, min 44px tap targets
- `metadata` is reserved in SQLAlchemy → use `meta_info`
- Docker container names: `generator-ad-fastapi-1`, etc.

---

## Phase 1: Sidecar Service + Database

### Task 1: Create wa-sidecar Node.js service

**Files:**
- Create: `services/wa-sidecar/package.json`
- Create: `services/wa-sidecar/src/index.ts`
- Create: `services/wa-sidecar/src/baileys.ts`
- Create: `services/wa-sidecar/src/session.ts`
- Create: `services/wa-sidecar/tsconfig.json`
- Create: `services/wa-sidecar/Dockerfile`

- [ ] **Step 1: Initialize Node.js project**

```bash
mkdir -p services/wa-sidecar/src
cd services/wa-sidecar
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "wa-sidecar",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.7.16",
    "express": "^4.21.0",
    "qrcode": "^1.5.4",
    "pino": "^9.4.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "@types/qrcode": "^1.5.5",
    "typescript": "^5.6.0",
    "ts-node": "^10.9.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create session manager**

```typescript
// services/wa-sidecar/src/session.ts
import { Boom } from "@hapi/boom";
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  proto,
  jidNormalizedUser,
} from "@whiskeysockets/baileys";
import path from "path";
import fs from "fs";

const SESSION_DIR = process.env.WA_SESSION_DIR || "/data/wa/sessions";

interface SessionInfo {
  sock: WASocket;
  qr: string | null;
  status: "qr_pending" | "connected" | "disconnected" | "banned";
  phone: string | null;
  jid: string | null;
}

const sessions = new Map<string, SessionInfo>();

export function getSession(accountId: string): SessionInfo | undefined {
  return sessions.get(accountId);
}

export function getAllSessions(): Map<string, SessionInfo> {
  return sessions;
}

export async function createSession(accountId: string): Promise<SessionInfo> {
  const sessionPath = path.join(SESSION_DIR, accountId);
  fs.mkdirSync(sessionPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    browser: ["24GO Phone Parser", "Chrome", "1.0.0"],
  });

  const info: SessionInfo = {
    sock,
    qr: null,
    status: "qr_pending",
    phone: null,
    jid: null,
  };

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      info.qr = qr;
      info.status = "qr_pending";
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        info.status = "disconnected";
        fs.rmSync(sessionPath, { recursive: true, force: true });
      } else {
        // Reconnect
        info.status = "disconnected";
        setTimeout(() => createSession(accountId), 3000);
      }
    }

    if (connection === "open") {
      info.status = "connected";
      info.qr = null;
      info.jid = sock.user?.id || null;
      info.phone = sock.user?.id?.replace(/:.*@/, "@")?.split("@")[0] || null;
    }
  });

  sessions.set(accountId, info);
  return info;
}

export async function removeSession(accountId: string): Promise<void> {
  const info = sessions.get(accountId);
  if (info) {
    try {
      info.sock.end(undefined);
    } catch {}
    sessions.delete(accountId);
  }
  const sessionPath = path.join(SESSION_DIR, accountId);
  fs.rmSync(sessionPath, { recursive: true, force: true });
}

export async function getGroupParticipants(
  accountId: string,
  groupLink: string
): Promise<{ jid: string; phone: string; name: string }[]> {
  const info = sessions.get(accountId);
  if (!info || info.status !== "connected") {
    throw new Error("Account not connected");
  }

  // Extract group code from link
  const code = groupLink.split("/").pop()?.split("?")[0];
  if (!code) throw new Error("Invalid group link");

  // Join group via invite code
  const result = await info.sock.groupAcceptInvite(code);
  const groupJid = result;

  // Get group metadata + participants
  const metadata = await info.sock.groupMetadata(groupJid);
  const participants = metadata.participants || [];

  return participants.map((p) => ({
    jid: jidNormalizedUser(p.id),
    phone: p.id.replace(/:.*@/, "@").split("@")[0],
    name: (p as any).name || null,
  }));
}
```

- [ ] **Step 5: Create Express server**

```typescript
// services/wa-sidecar/src/index.ts
import express from "express";
import cors from "cors";
import { createSession, removeSession, getSession, getAllSessions, getGroupParticipants } from "./session";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = parseInt(process.env.WA_SIDECAR_PORT || "3100");

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", sessions: getAllSessions().size });
});

// Connect - initiate QR
app.post("/connect", async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: "accountId required" });

  try {
    const info = await createSession(accountId);
    // Wait for QR (max 30s)
    let attempts = 0;
    while (!info.qr && info.status === "qr_pending" && attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      attempts++;
    }
    res.json({ qr: info.qr, status: info.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get QR (polling)
app.get("/qr/:accountId", (req, res) => {
  const info = getSession(req.params.accountId);
  if (!info) return res.status(404).json({ error: "Session not found" });
  res.json({ qr: info.qr, status: info.status });
});

// Status
app.get("/status/:accountId", (req, res) => {
  const info = getSession(req.params.accountId);
  if (!info) return res.status(404).json({ error: "Session not found" });
  res.json({ status: info.status, phone: info.phone, jid: info.jid });
});

// Disconnect
app.post("/disconnect/:accountId", async (req, res) => {
  await removeSession(req.params.accountId);
  res.json({ ok: true });
});

// Parse groups
app.post("/parse-groups", async (req, res) => {
  const { accountId, groupLinks } = req.body;
  if (!accountId || !groupLinks?.length) {
    return res.status(400).json({ error: "accountId and groupLinks required" });
  }

  const results: any[] = [];
  for (const link of groupLinks) {
    try {
      const participants = await getGroupParticipants(accountId, link);
      results.push({ link, participants, status: "ok" });
    } catch (err: any) {
      results.push({ link, error: err.message, status: "error" });
    }
  }

  res.json({ results });
});

app.listen(PORT, () => {
  console.log(`WA Sidecar listening on port ${PORT}`);
});
```

- [ ] **Step 6: Create Dockerfile**

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
EXPOSE 3100
CMD ["node", "dist/index.js"]
```

- [ ] **Step 7: Test locally**

```bash
cd services/wa-sidecar
npm install
npx tsc
node dist/index.js
# Should start on port 3100
curl http://localhost:3100/health
```

- [ ] **Step 8: Commit**

```bash
git add services/wa-sidecar/
git commit -m "feat(wa-sidecar): Baileys Node.js sidecar service for WhatsApp"
```

---

### Task 2: Database migration

**Files:**
- Create: `services/backend/migrations/006_phone_parser.sql`

- [ ] **Step 1: Create migration SQL**

```sql
-- Migration 006: Phone parsing — contacts, wa_accounts, wa_groups

-- Add whatsapp to platform_type enum
ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'whatsapp';

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    wa_jid VARCHAR(50),
    wa_group_source VARCHAR(255),
    wa_group_jid VARCHAR(50),
    wa_parsed_at TIMESTAMPTZ,
    has_tg BOOLEAN DEFAULT FALSE,
    has_viber BOOLEAN DEFAULT FALSE,
    tg_user_id BIGINT,
    tg_username VARCHAR(255),
    viber_user_id VARCHAR(100),
    last_mailing_at TIMESTAMPTZ,
    last_mailing_campaign_id UUID REFERENCES campaigns(id),
    mailing_count INTEGER DEFAULT 0,
    tags JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_phone ON contacts(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_tg ON contacts(tenant_id, has_tg) WHERE has_tg = TRUE;
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_mailing ON contacts(tenant_id, last_mailing_at);

-- WhatsApp accounts
CREATE TABLE IF NOT EXISTS wa_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    jid VARCHAR(50),
    name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'disconnected',
    session_file_path VARCHAR(500),
    daily_parse_limit INTEGER DEFAULT 50,
    parses_today INTEGER DEFAULT 0,
    last_parse_at TIMESTAMPTZ,
    cooldown_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_accounts_tenant ON wa_accounts(tenant_id, status);

-- WhatsApp groups
CREATE TABLE IF NOT EXISTS wa_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES wa_accounts(id) ON DELETE CASCADE,
    group_jid VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    link VARCHAR(500),
    participants_count INTEGER DEFAULT 0,
    parsed_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'idle',
    last_parsed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, group_jid)
);

CREATE INDEX IF NOT EXISTS idx_wa_groups_tenant ON wa_groups(tenant_id, status);
```

- [ ] **Step 2: Run migration on VPS**

```bash
scp -i C:\Users\rf24k\.ssh\id_ed25519_generator "C:\Code\GeneratorAD\services\backend\migrations\006_phone_parser.sql" root@46.250.235.165:/tmp/006_phone_parser.sql
ssh -i C:\Users\rf24k\.ssh\id_ed25519_generator root@46.250.235.165 "docker exec -i generator-ad-postgres-1 psql -U app_user -d app_db < /tmp/006_phone_parser.sql"
```

- [ ] **Step 3: Commit**

```bash
git add services/backend/migrations/006_phone_parser.sql
git commit -m "feat(db): migration 006 — contacts, wa_accounts, wa_groups tables"
```

---

### Task 3: Backend models

**Files:**
- Modify: `services/backend/app/models.py`

- [ ] **Step 1: Add whatsapp to PlatformType enum**

```python
# In models.py, PlatformType enum — add:
class PlatformType(str, enum.Enum):
    telegram = "telegram"
    vkontakte = "vkontakte"
    forum = "forum"
    whatsapp = "whatsapp"  # NEW
```

- [ ] **Step 2: Add Contact model**

```python
class Contact(Base):
    __tablename__ = "contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    phone = Column(String(20), nullable=False)
    name = Column(String(255))
    wa_jid = Column(String(50))
    wa_group_source = Column(String(255))
    wa_group_jid = Column(String(50))
    wa_parsed_at = Column(DateTime(timezone=True))
    has_tg = Column(Boolean, default=False)
    has_viber = Column(Boolean, default=False)
    tg_user_id = Column(BigInteger)
    tg_username = Column(String(255))
    viber_user_id = Column(String(100))
    last_mailing_at = Column(DateTime(timezone=True))
    last_mailing_campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="SET NULL"))
    mailing_count = Column(Integer, default=0)
    tags = Column(JSONB, default=list)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("tenant_id", "phone", name="uq_tenant_phone"),
        Index("idx_contacts_tenant_phone", "tenant_id", "phone"),
    )

    tenant = relationship("Tenant")
```

- [ ] **Step 3: Add WaAccount model**

```python
class WaAccount(Base):
    __tablename__ = "wa_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    phone = Column(String(20), nullable=False)
    jid = Column(String(50))
    name = Column(String(255))
    status = Column(String(50), default="disconnected")
    session_file_path = Column(String(500))
    daily_parse_limit = Column(Integer, default=50)
    parses_today = Column(Integer, default=0)
    last_parse_at = Column(DateTime(timezone=True))
    cooldown_until = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_wa_accounts_tenant", "tenant_id", "status"),
    )

    tenant = relationship("Tenant")
```

- [ ] **Step 4: Add WaGroup model**

```python
class WaGroup(Base):
    __tablename__ = "wa_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("wa_accounts.id", ondelete="CASCADE"), nullable=False)
    group_jid = Column(String(50), nullable=False)
    name = Column(String(255))
    link = Column(String(500))
    participants_count = Column(Integer, default=0)
    parsed_count = Column(Integer, default=0)
    status = Column(String(50), default="idle")
    last_parsed_at = Column(DateTime(timezone=True))
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("tenant_id", "group_jid", name="uq_tenant_group_jid"),
        Index("idx_wa_groups_tenant", "tenant_id", "status"),
    )

    tenant = relationship("Tenant")
    account = relationship("WaAccount")
```

- [ ] **Step 5: Add relationships to Tenant model**

```python
# In Tenant class, add:
    contacts = relationship("Contact", back_populates="tenant", cascade="all, delete-orphan")
    wa_accounts = relationship("WaAccount", back_populates="tenant", cascade="all, delete-orphan")
    wa_groups = relationship("WaGroup", back_populates="tenant", cascade="all, delete-orphan")
```

- [ ] **Step 6: Commit**

```bash
git add services/backend/app/models.py
git commit -m "feat(models): add Contact, WaAccount, WaGroup models"
```

---

### Task 4: Backend schemas

**Files:**
- Modify: `services/backend/app/schemas.py`

- [ ] **Step 1: Add WhatsApp schemas**

```python
# schemas.py additions

class WhatsAppConnectRequest(BaseModel):
    proxy_url: str | None = None

class WhatsAppQRResponse(BaseModel):
    qr_base64: str | None = None
    status: str

class WhatsAppParseRequest(BaseModel):
    group_links: list[str]
    geo_tag: str | None = None
    tags: list[str] = []

class WhatsAppParseResponse(BaseModel):
    task_id: str
    groups_found: int
    status: str

class WaAccountResponse(BaseModel):
    id: UUID
    phone: str
    name: str | None
    status: str
    daily_parse_limit: int
    parses_today: int
    last_parse_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True

class WaGroupResponse(BaseModel):
    id: UUID
    group_jid: str
    name: str | None
    link: str | None
    participants_count: int
    parsed_count: int
    status: str
    last_parsed_at: datetime | None
    error_message: str | None

    class Config:
        from_attributes = True

class ContactResponse(BaseModel):
    id: UUID
    phone: str
    name: str | None
    wa_group_source: str | None
    wa_parsed_at: datetime | None
    has_tg: bool
    has_viber: bool
    tg_username: str | None
    last_mailing_at: datetime | None
    mailing_count: int
    tags: list[str]

    class Config:
        from_attributes = True

class ContactListResponse(BaseModel):
    items: list[ContactResponse]
    total: int
    page: int
    page_size: int

class ContactFilter(BaseModel):
    search: str | None = None
    has_tg: bool | None = None
    tags: list[str] | None = None
    parsed_after: datetime | None = None
    parsed_before: datetime | None = None
    page: int = 1
    page_size: int = 50

class ContactUpdate(BaseModel):
    tags: list[str] | None = None
    notes: str | None = None

class ContactExportRequest(BaseModel):
    filters: ContactFilter
    format: str = "csv"

class CheckTelegramRequest(BaseModel):
    phone_numbers: list[str]

class CheckTelegramResponse(BaseModel):
    found: list[dict]
    not_found: list[str]
    task_id: str

class BulkTagRequest(BaseModel):
    contact_ids: list[UUID]
    tags: list[str]
    action: str = "add"  # add or remove

class AssignContactsRequest(BaseModel):
    contact_ids: list[UUID]
    campaign_id: UUID | None = None
    mailing_id: UUID | None = None
```

- [ ] **Step 2: Commit**

```bash
git add services/backend/app/schemas.py
git commit -m "feat(schemas): add WhatsApp and Contact schemas"
```

---

### Task 5: Backend router

**Files:**
- Create: `services/backend/app/routers/phone_parser.py`
- Modify: `services/backend/app/main.py`

- [ ] **Step 1: Create router**

```python
# services/backend/app/routers/phone_parser.py
import csv
import io
import uuid
import httpx
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.security import get_current_user
from app.models import User, Contact, WaAccount, WaGroup
from app.schemas import (
    WhatsAppParseRequest, WhatsAppParseResponse,
    WaAccountResponse, WaGroupResponse,
    ContactResponse, ContactListResponse, ContactFilter,
    ContactUpdate, ContactExportRequest,
    CheckTelegramRequest, CheckTelegramResponse,
    BulkTagRequest, AssignContactsRequest,
)

router = APIRouter(prefix="/api/v1/phone-parser", tags=["phone-parser"])

WA_SIDECAR_URL = "http://wa-sidecar:3100"

# ── WhatsApp Accounts ───────────────────────────────────────────

@router.post("/wa/connect", response_model=dict)
async def wa_connect(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Initiate QR code connection for WhatsApp account."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{WA_SIDECAR_URL}/connect", json={
            "accountId": str(uuid.uuid4()),
        }, timeout=60)
    return resp.json()


@router.get("/wa/qr/{account_id}")
async def wa_get_qr(account_id: str):
    """Poll QR code for a pending connection."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{WA_SIDECAR_URL}/qr/{account_id}", timeout=10)
    return resp.json()


@router.get("/wa/status/{account_id}")
async def wa_status(account_id: str):
    """Get connection status."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{WA_SIDECAR_URL}/status/{account_id}", timeout=10)
    return resp.json()


@router.post("/wa/disconnect/{account_id}")
async def wa_disconnect(
    account_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disconnect WhatsApp account."""
    async with httpx.AsyncClient() as client:
        await client.post(f"{WA_SIDECAR_URL}/disconnect/{account_id}", timeout=10)
    # Update DB
    q = select(WaAccount).where(
        WaAccount.id == uuid.UUID(account_id),
        WaAccount.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    account = result.scalar_one_or_none()
    if account:
        account.status = "disconnected"
        await db.commit()
    return {"ok": True}


@router.get("/wa/accounts", response_model=list[WaAccountResponse])
async def wa_list_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List WhatsApp accounts for current tenant."""
    q = select(WaAccount).where(WaAccount.tenant_id == current_user.tenant_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.delete("/wa/accounts/{account_id}")
async def wa_delete_account(
    account_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove WhatsApp account."""
    q = select(WaAccount).where(
        WaAccount.id == uuid.UUID(account_id),
        WaAccount.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")
    await db.delete(account)
    await db.commit()
    return {"ok": True}


# ── Group Parsing ───────────────────────────────────────────────

@router.post("/wa/parse", response_model=WhatsAppParseResponse)
async def wa_parse_groups(
    body: WhatsAppParseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start parsing WhatsApp groups."""
    # Get first connected account
    q = select(WaAccount).where(
        WaAccount.tenant_id == current_user.tenant_id,
        WaAccount.status == "connected",
    )
    result = await db.execute(q)
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(400, "No connected WhatsApp account")

    # Call sidecar
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{WA_SIDECAR_URL}/parse-groups", json={
            "accountId": str(account.id),
            "groupLinks": body.group_links,
        }, timeout=300)

    data = resp.json()
    new_count = 0

    for group_result in data.get("results", []):
        if group_result.get("status") != "ok":
            continue
        participants = group_result.get("participants", [])

        # Upsert contacts
        for p in participants:
            phone = p.get("phone", "")
            if not phone or not phone.isdigit():
                continue
            phone_e164 = f"+{phone}"

            existing = await db.execute(
                select(Contact).where(
                    Contact.tenant_id == current_user.tenant_id,
                    Contact.phone == phone_e164,
                )
            )
            if existing.scalar_one_or_none():
                continue

            db.add(Contact(
                tenant_id=current_user.tenant_id,
                phone=phone_e164,
                name=p.get("name"),
                wa_jid=p.get("jid"),
                wa_group_source=group_result.get("link"),
                wa_parsed_at=datetime.now(timezone.utc),
                tags=[body.geo_tag] if body.geo_tag else [],
            ))
            new_count += 1

    await db.commit()

    return WhatsAppParseResponse(
        task_id=str(uuid.uuid4()),
        groups_found=len(data.get("results", [])),
        status="completed",
    )


@router.get("/wa/groups", response_model=list[WaGroupResponse])
async def wa_list_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List parsed WhatsApp groups."""
    q = select(WaGroup).where(WaGroup.tenant_id == current_user.tenant_id)
    result = await db.execute(q)
    return result.scalars().all()


# ── Contacts ────────────────────────────────────────────────────

@router.get("/contacts", response_model=ContactListResponse)
async def list_contacts(
    search: str | None = None,
    has_tg: bool | None = None,
    tags: str | None = None,  # comma-separated
    parsed_after: str | None = None,
    parsed_before: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List contacts with filters."""
    q = select(Contact).where(Contact.tenant_id == current_user.tenant_id)

    if search:
        q = q.where(or_(
            Contact.phone.ilike(f"%{search}%"),
            Contact.name.ilike(f"%{search}%"),
        ))
    if has_tg is not None:
        q = q.where(Contact.has_tg == has_tg)
    if tags:
        tag_list = [t.strip() for t in tags.split(",")]
        for tag in tag_list:
            q = q.where(Contact.tags.op("@>")(f'["{tag}"]'))
    if parsed_after:
        q = q.where(Contact.wa_parsed_at >= datetime.fromisoformat(parsed_after))
    if parsed_before:
        q = q.where(Contact.wa_parsed_at <= datetime.fromisoformat(parsed_before))

    # Count
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Paginate
    q = q.order_by(Contact.created_at.desc())
    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    items = result.scalars().all()

    return ContactListResponse(
        items=[ContactResponse.model_validate(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/contacts/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Contact).where(
        Contact.id == uuid.UUID(contact_id),
        Contact.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contact not found")
    return ContactResponse.model_validate(contact)


@router.put("/contacts/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: str,
    body: ContactUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Contact).where(
        Contact.id == uuid.UUID(contact_id),
        Contact.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contact not found")
    if body.tags is not None:
        contact.tags = body.tags
    if body.notes is not None:
        contact.notes = body.notes
    await db.commit()
    return ContactResponse.model_validate(contact)


@router.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Contact).where(
        Contact.id == uuid.UUID(contact_id),
        Contact.tenant_id == current_user.tenant_id,
    )
    result = await db.execute(q)
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contact not found")
    await db.delete(contact)
    await db.commit()
    return {"ok": True}


@router.post("/contacts/export")
async def export_contacts(
    body: ContactExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export contacts as CSV."""
    q = select(Contact).where(Contact.tenant_id == current_user.tenant_id)
    f = body.filters

    if f.search:
        q = q.where(or_(
            Contact.phone.ilike(f"%{f.search}%"),
            Contact.name.ilike(f"%{f.search}%"),
        ))
    if f.has_tg is not None:
        q = q.where(Contact.has_tg == f.has_tg)
    if f.tags:
        for tag in f.tags:
            q = q.where(Contact.tags.op("@>")(f'["{tag}"]'))
    if f.parsed_after:
        q = q.where(Contact.wa_parsed_at >= f.parsed_after)

    q = q.order_by(Contact.created_at.desc())
    result = await db.execute(q)
    contacts = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Phone", "Name", "Source", "TG", "Viber", "Tags", "Last Mailing", "Parsed At"])
    for c in contacts:
        writer.writerow([
            c.phone, c.name or "", c.wa_group_source or "",
            "Yes" if c.has_tg else "No", "Yes" if c.has_viber else "No",
            ",".join(c.tags or []), c.last_mailing_at or "", c.wa_parsed_at or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contacts.csv"},
    )


@router.get("/contacts/stats")
async def contact_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get contact statistics."""
    total = (await db.execute(
        select(func.count()).where(Contact.tenant_id == current_user.tenant_id)
    )).scalar() or 0

    with_tg = (await db.execute(
        select(func.count()).where(Contact.tenant_id == current_user.tenant_id, Contact.has_tg == True)
    )).scalar() or 0

    with_viber = (await db.execute(
        select(func.count()).where(Contact.tenant_id == current_user.tenant_id, Contact.has_viber == True)
    )).scalar() or 0

    return {"total": total, "with_tg": with_tg, "with_viber": with_viber}


@router.post("/contacts/bulk-tag")
async def bulk_tag_contacts(
    body: BulkTagRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk add/remove tags from contacts."""
    q = select(Contact).where(
        Contact.tenant_id == current_user.tenant_id,
        Contact.id.in_([str(cid) for cid in body.contact_ids]),
    )
    result = await db.execute(q)
    contacts = result.scalars().all()

    for contact in contacts:
        current_tags = set(contact.tags or [])
        if body.action == "add":
            current_tags.update(body.tags)
        elif body.action == "remove":
            current_tags -= set(body.tags)
        contact.tags = list(current_tags)

    await db.commit()
    return {"updated": len(contacts)}


@router.post("/contacts/check-tg")
async def check_telegram(
    body: CheckTelegramRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check phone numbers against Telegram. Dispatches background task."""
    from app.celery_app import celery
    task = celery.send_task(
        "app.tasks.wa_tasks.check_telegram_phones",
        args=[str(current_user.tenant_id), body.phone_numbers],
        queue="parser",
    )
    return {"task_id": task.id, "status": "queued"}
```

- [ ] **Step 2: Register router in main.py**

```python
# In main.py, add import and include:
from app.routers import phone_parser
app.include_router(phone_parser.router)
```

- [ ] **Step 3: Commit**

```bash
git add services/backend/app/routers/phone_parser.py services/backend/app/main.py
git commit -m "feat(router): phone_parser API — accounts, groups, contacts, export"
```

---

### Task 6: Worker task

**Files:**
- Create: `services/worker/app/tasks/wa_tasks.py`
- Modify: `services/worker/app/celery_app.py`

- [ ] **Step 1: Create wa_tasks.py**

```python
# services/worker/app/tasks/wa_tasks.py
import asyncio
import httpx
from datetime import datetime, timezone

from app.celery_app import celery

WA_SIDECAR_URL = "http://wa-sidecar:3100"


@celery.task(
    name="app.tasks.wa_tasks.check_telegram_phones",
    queue="parser",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def check_telegram_phones(self, tenant_id: str, phone_numbers: list[str]):
    """Check if phone numbers have Telegram accounts via Telethon."""
    from app.db_pool import get_pool

    async def _check():
        pool = await get_pool()
        async with pool.acquire() as conn:
            # Use Telethon to check contacts
            from telethon import TelegramClient
            from app.config import TELEGRAM_API_ID, TELEGRAM_API_HASH

            client = TelegramClient("tg_check_session", TELEGRAM_API_ID, TELEGRAM_API_HASH)
            await client.start()

            # Import contacts to Telegram
            contacts_to_check = []
            for phone in phone_numbers:
                contacts_to_check.append({"phone": phone})

            result = await client.import_contacts_client(contacts_to_check)

            # Get matched users
            found = []
            not_found = []
            if result and result.users:
                for user in result.users:
                    if user.phone:
                        found.append({
                            "phone": f"+{user.phone}",
                            "tg_user_id": user.id,
                            "tg_username": user.username,
                            "first_name": user.first_name,
                        })

            found_phones = {f["phone"] for f in found}
            not_found = [p for p in phone_numbers if p not in found_phones]

            # Update contacts in DB
            for f in found:
                await conn.execute("""
                    UPDATE contacts
                    SET has_tg = TRUE, tg_user_id = $1, tg_username = $2, updated_at = NOW()
                    WHERE tenant_id = $3 AND phone = $4
                """, f["tg_user_id"], f["tg_username"], tenant_id, f["phone"])

            await client.disconnect()
            return {"found": len(found), "not_found": len(not_found)}

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(_check())
        return result
    except Exception as e:
        raise self.retry(exc=e)
    finally:
        loop.close()
```

- [ ] **Step 2: Add task route to celery_app.py**

```python
# In celery_app.py, add to task_routes:
app.conf.task_routes.update({
    "app.tasks.wa_*": {"queue": "parser"},
})
```

- [ ] **Step 3: Commit**

```bash
git add services/worker/app/tasks/wa_tasks.py services/worker/app/celery_app.py
git commit -m "feat(worker): wa_tasks — Telegram phone check"
```

---

### Task 7: Docker compose update

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add wa-sidecar service**

```yaml
  wa-sidecar:
    build:
      context: ./services/wa-sidecar
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3100:3100"
    environment:
      - WA_SESSION_DIR=/data/wa/sessions
      - WA_SIDECAR_PORT=3100
    volumes:
      - wa_sessions:/data/wa/sessions
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
    networks:
      - internal
      - preyi_preyi_net

# Add volumes section:
volumes:
  wa_sessions:
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(docker): add wa-sidecar service"
```

---

## Phase 2: Frontend

### Task 8: Platform type + sidebar

**Files:**
- Modify: `services/dashboard/src/lib/platform.tsx`
- Modify: `services/dashboard/src/components/Sidebar.tsx`
- Modify: `services/dashboard/src/lib/en.json`
- Modify: `services/dashboard/src/lib/ru.json`

- [ ] **Step 1: Update platform type**

```typescript
// platform.tsx
type Platform = "telegram" | "vkontakte" | "whatsapp";
```

- [ ] **Step 2: Update sidebar platform toggle — narrower buttons + third option**

```tsx
// Sidebar.tsx — replace platform toggle div
<div className="flex items-center gap-0.5 bg-zinc-900 rounded-lg p-0.5">
  <button
    onClick={() => setPlatform("telegram")}
    className={`flex-1 text-[10px] py-1.5 rounded transition min-h-[28px] ${platform === "telegram" ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-500 hover:text-zinc-300"}`}
  >
    TG
  </button>
  <button
    onClick={() => setPlatform("vkontakte")}
    className={`flex-1 text-[10px] py-1.5 rounded transition min-h-[28px] ${platform === "vkontakte" ? "bg-blue-500/20 text-blue-400" : "text-zinc-500 hover:text-zinc-300"}`}
  >
    VK
  </button>
  <button
    onClick={() => setPlatform("whatsapp")}
    className={`flex-1 text-[10px] py-1.5 rounded transition min-h-[28px] ${platform === "whatsapp" ? "bg-green-500/20 text-green-400" : "text-zinc-500 hover:text-zinc-300"}`}
  >
    WA
  </button>
</div>
```

- [ ] **Step 3: Add WA navigation items**

```tsx
// In Sidebar.tsx, add third platform nav:
const NAV_ITEMS = platform === "telegram" ? [ ... ] : platform === "vkontakte" ? [ ... ] : [
  { href: "/wa-overview", label: "WA Overview", icon: ChartBar },
  { href: "/wa-accounts", label: "WA Accounts", icon: UserCircle },
  { href: "/wa-groups", label: "WA Groups", icon: Radio },
  { href: "/contacts", label: t("sidebar.contacts"), icon: UsersGroup },
  { href: "/campaigns", label: t("sidebar.campaigns"), icon: Megaphone },
  { href: "/mailings", label: t("sidebar.mailings"), icon: Send },
  { href: "/billing", label: t("sidebar.billing"), icon: CreditCard },
  { href: "/settings", label: t("sidebar.settings"), icon: Cog },
];
```

- [ ] **Step 4: Add i18n keys**

```json
// en.json additions
{
  "sidebar.waOverview": "WA Overview",
  "sidebar.waAccounts": "WA Accounts",
  "sidebar.waGroups": "WA Groups",
  "sidebar.contacts": "Contacts"
}

// ru.json additions
{
  "sidebar.waOverview": "Обзор WA",
  "sidebar.waAccounts": "Аккаунты WA",
  "sidebar.waGroups": "Группы WA",
  "sidebar.contacts": "Контакты"
}
```

- [ ] **Step 5: Commit**

```bash
git add services/dashboard/src/lib/platform.tsx services/dashboard/src/components/Sidebar.tsx services/dashboard/src/lib/en.json services/dashboard/src/lib/ru.json
git commit -m "feat(sidebar): add WA platform toggle and navigation"
```

---

### Task 9: WA Accounts page

**Files:**
- Create: `services/dashboard/src/app/(dashboard)/wa-accounts/page.tsx`
- Create: `services/dashboard/src/components/WaQRModal.tsx`

- [ ] **Step 1: Create WA Accounts page**

```tsx
// services/dashboard/src/app/(dashboard)/wa-accounts/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Spinner } from "@/components/Spinner";
import { Toast } from "@/components/Toast";
import { UserCircle, LogOut, Wifi, WifiOff } from "@/components/Icons";

interface WaAccount {
  id: string;
  phone: string;
  name: string | null;
  status: string;
  daily_parse_limit: number;
  parses_today: number;
  last_parse_at: string | null;
  created_at: string;
}

export default function WaAccountsPage() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      const data = await api<WaAccount[]>("/api/v1/phone-parser/wa/accounts");
      setAccounts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const resp = await api<{ qr: string | null; status: string }>(
        "/api/v1/phone-parser/wa/connect",
        { method: "POST", body: JSON.stringify({}) }
      );
      if (resp.qr) {
        setQrData(resp.qr);
      }
      await loadAccounts();
    } catch (err) {
      Toast.error("Failed to connect");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect(id: string) {
    try {
      await api(`/api/v1/phone-parser/wa/disconnect/${id}`, { method: "POST" });
      await loadAccounts();
    } catch (err) {
      Toast.error("Failed to disconnect");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this account?")) return;
    try {
      await api(`/api/v1/phone-parser/wa/accounts/${id}`, { method: "DELETE" });
      await loadAccounts();
    } catch (err) {
      Toast.error("Failed to delete");
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">WhatsApp Accounts</h1>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 min-h-[44px]"
        >
          {connecting ? <Spinner className="w-4 h-4" /> : "+ Connect"}
        </button>
      </div>

      {qrData && (
        <WaQRModal qr={qrData} onClose={() => setQrData(null)} />
      )}

      {loading ? (
        <Spinner className="w-8 h-8" />
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <WifiOff className="w-12 h-12 mx-auto mb-4" />
          <p>No WhatsApp accounts connected</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc) => (
            <div key={acc.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  acc.status === "connected" ? "bg-green-500/20" : "bg-zinc-800"
                }`}>
                  <UserCircle className={`w-5 h-5 ${
                    acc.status === "connected" ? "text-green-400" : "text-zinc-500"
                  }`} />
                </div>
                <div>
                  <p className="text-sm text-zinc-100">{acc.phone}</p>
                  <p className="text-xs text-zinc-500">
                    {acc.status === "connected" ? "Connected" : acc.status}
                    {acc.parses_today > 0 && ` · ${acc.parses_today}/${acc.daily_parse_limit} today`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {acc.status === "connected" && (
                  <button onClick={() => handleDisconnect(acc.id)}
                    className="p-2 text-zinc-400 hover:text-yellow-400 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <WifiOff className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => handleDelete(acc.id)}
                  className="p-2 text-zinc-400 hover:text-red-400 min-h-[44px] min-w-[44px] flex items-center justify-center">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create WaQRModal component**

```tsx
// services/dashboard/src/components/WaQRModal.tsx
"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Spinner } from "@/components/Spinner";
import { Cross } from "@/components/Icons";

interface WaQRModalProps {
  qr: string;
  onClose: () => void;
}

export function WaQRModal({ qr, onClose }: WaQRModalProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<"qr_pending" | "connected" | "error">("qr_pending");

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-zinc-100">Connect WhatsApp</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            <Cross className="w-5 h-5" />
          </button>
        </div>

        {status === "qr_pending" && (
          <>
            <p className="text-sm text-zinc-400 mb-4">
              Open WhatsApp → Settings → Linked Devices → Link a Device
            </p>
            <div className="bg-white p-4 rounded-xl inline-block mb-4">
              <img src={`data:image/png;base64,${qr}`} alt="QR Code" className="w-48 h-48" />
            </div>
            <p className="text-xs text-zinc-500">Scan this QR code with WhatsApp</p>
          </>
        )}

        {status === "connected" && (
          <div className="py-8">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <p className="text-zinc-100">Connected!</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add services/dashboard/src/app/\(dashboard\)/wa-accounts/page.tsx services/dashboard/src/components/WaQRModal.tsx
git commit -m "feat(frontend): WA accounts page with QR connect modal"
```

---

### Task 10: WA Groups page

**Files:**
- Create: `services/dashboard/src/app/(dashboard)/wa-groups/page.tsx`

- [ ] **Step 1: Create WA Groups page**

```tsx
// services/dashboard/src/app/(dashboard)/wa-groups/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Spinner } from "@/components/Spinner";
import { Toast } from "@/components/Toast";
import { Radio, Search } from "@/components/Icons";
import { FieldHint } from "@/components/FieldHint";

interface WaGroup {
  id: string;
  group_jid: string;
  name: string | null;
  link: string | null;
  participants_count: number;
  parsed_count: number;
  status: string;
  last_parsed_at: string | null;
}

export default function WaGroupsPage() {
  const { t } = useI18n();
  const [links, setLinks] = useState("");
  const [geoTag, setGeoTag] = useState("");
  const [tags, setTags] = useState("");
  const [parsing, setParsing] = useState(false);
  const [groups, setGroups] = useState<WaGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadGroups(); }, []);

  async function loadGroups() {
    try {
      const data = await api<WaGroup[]>("/api/v1/phone-parser/wa/groups");
      setGroups(data);
    } catch {} finally { setLoading(false); }
  }

  async function handleParse() {
    const linkList = links.split("\n").map(l => l.trim()).filter(l => l);
    if (!linkList.length) return Toast.error("Enter at least one group link");
    setParsing(true);
    try {
      await api("/api/v1/phone-parser/wa/parse", {
        method: "POST",
        body: JSON.stringify({
          group_links: linkList,
          geo_tag: geoTag || null,
          tags: tags ? tags.split(",").map(t => t.trim()) : [],
        }),
      });
      Toast.success("Parsing started");
      setLinks("");
      await loadGroups();
    } catch (err) {
      Toast.error("Parsing failed");
    } finally { setParsing(false); }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-zinc-100">WhatsApp Groups</h1>

      {/* Input section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <label className="text-sm text-zinc-300">Group Links</label>
            <FieldHint hint="Paste WhatsApp group invite links, one per line. Format: https://chat.whatsapp.com/..." />
          </div>
          <textarea
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder={"https://chat.whatsapp.com/xxx\nhttps://chat.whatsapp.com/yyy"}
            className="w-full h-32 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-600 resize-none"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-sm text-zinc-300">Geo Tag</label>
              <FieldHint hint="Location tag, e.g. Phuket_Rent" />
            </div>
            <input value={geoTag} onChange={(e) => setGeoTag(e.target.value)}
              placeholder="Phuket_Rent"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-sm text-zinc-300">Tags</label>
              <FieldHint hint="Comma-separated tags" />
            </div>
            <input value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="rent, phuket"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-600" />
          </div>
        </div>
        <button onClick={handleParse} disabled={parsing}
          className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 min-h-[44px]">
          {parsing ? <Spinner className="w-4 h-4" /> : "Parse Groups"}
        </button>
      </div>

      {/* Groups list */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-100 mb-3">Parsed Groups</h2>
        {loading ? <Spinner className="w-6 h-6" /> : groups.length === 0 ? (
          <p className="text-zinc-500 text-sm">No groups parsed yet</p>
        ) : (
          <div className="space-y-2">
            {groups.map((g) => (
              <div key={g.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-100">{g.name || g.group_jid}</p>
                  <p className="text-xs text-zinc-500">
                    {g.parsed_count} participants
                    {g.last_parsed_at && ` · ${new Date(g.last_parsed_at).toLocaleDateString()}`}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  g.status === "completed" ? "bg-green-500/20 text-green-400" :
                  g.status === "parsing" ? "bg-yellow-500/20 text-yellow-400" :
                  g.status === "error" ? "bg-red-500/20 text-red-400" :
                  "bg-zinc-800 text-zinc-400"
                }`}>
                  {g.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add services/dashboard/src/app/\(dashboard\)/wa-groups/page.tsx
git commit -m "feat(frontend): WA groups parsing page"
```

---

### Task 11: Contacts page

**Files:**
- Create: `services/dashboard/src/app/(dashboard)/contacts/page.tsx`

- [ ] **Step 1: Create Contacts page**

```tsx
// services/dashboard/src/app/(dashboard)/contacts/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Spinner } from "@/components/Spinner";
import { Toast } from "@/components/Toast";
import { Search, CheckCircle, FileText, UsersGroup } from "@/components/Icons";

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  wa_group_source: string | null;
  wa_parsed_at: string | null;
  has_tg: boolean;
  has_viber: boolean;
  tg_username: string | null;
  last_mailing_at: string | null;
  mailing_count: number;
  tags: string[];
}

interface ContactStats {
  total: number;
  with_tg: number;
  with_viber: number;
}

export default function ContactsPage() {
  const { t } = useI18n();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTG, setFilterTG] = useState<boolean | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => { loadContacts(); loadStats(); }, [page, search, filterTG]);

  async function loadContacts() {
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "50" });
      if (search) params.set("search", search);
      if (filterTG !== null) params.set("has_tg", String(filterTG));
      const data = await api<{ items: Contact[]; total: number }>(`/api/v1/phone-parser/contacts?${params}`);
      setContacts(data.items);
      setTotal(data.total);
    } catch {} finally { setLoading(false); }
  }

  async function loadStats() {
    try {
      const data = await api<ContactStats>("/api/v1/phone-parser/contacts/stats");
      setStats(data);
    } catch {}
  }

  async function handleExport() {
    try {
      const resp = await fetch(`/api/v1/phone-parser/contacts/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ filters: { search, has_tg: filterTG, page: 1, page_size: 10000 } }),
      });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "contacts.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch { Toast.error("Export failed"); }
  }

  async function handleCheckTG() {
    const phones = contacts.map(c => c.phone);
    if (!phones.length) return Toast.error("No contacts");
    try {
      await api("/api/v1/phone-parser/contacts/check-tg", {
        method: "POST",
        body: JSON.stringify({ phone_numbers: phones }),
      });
      Toast.success("Telegram check started");
    } catch { Toast.error("Check failed"); }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-zinc-100">Contact Database</h1>
        <div className="flex gap-2">
          <button onClick={handleCheckTG}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm min-h-[44px]">
            Check TG
          </button>
          <button onClick={handleExport}
            className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg text-sm min-h-[44px]">
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-zinc-100">{stats.total}</p>
            <p className="text-xs text-zinc-500">Total</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{stats.with_tg}</p>
            <p className="text-xs text-zinc-500">Telegram</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">{stats.with_viber}</p>
            <p className="text-xs text-zinc-500">Viber</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by phone or name..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600" />
        </div>
        <button onClick={() => setFilterTG(filterTG === null ? true : filterTG === true ? false : null)}
          className={`px-3 py-2 rounded-lg text-sm border min-h-[44px] ${
            filterTG === true ? "bg-blue-500/20 border-blue-500 text-blue-400" :
            filterTG === false ? "bg-red-500/20 border-red-500 text-red-400" :
            "bg-zinc-900 border-zinc-800 text-zinc-400"
          }`}>
          TG: {filterTG === true ? "Yes" : filterTG === false ? "No" : "All"}
        </button>
      </div>

      {/* Contacts table */}
      {loading ? <Spinner className="w-6 h-6" /> : contacts.length === 0 ? (
        <p className="text-zinc-500 text-sm text-center py-8">No contacts found</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left p-3">Phone</th>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Source</th>
                  <th className="text-center p-3">TG</th>
                  <th className="text-center p-3">Viber</th>
                  <th className="text-left p-3">Last Mailing</th>
                  <th className="text-left p-3">Tags</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                    <td className="p-3 text-zinc-100 font-mono">{c.phone}</td>
                    <td className="p-3 text-zinc-300">{c.name || "—"}</td>
                    <td className="p-3 text-zinc-500 text-xs truncate max-w-[200px]">{c.wa_group_source || "—"}</td>
                    <td className="p-3 text-center">{c.has_tg ? <span className="text-blue-400">✓</span> : <span className="text-zinc-600">✗</span>}</td>
                    <td className="p-3 text-center">{c.has_viber ? <span className="text-purple-400">✓</span> : <span className="text-zinc-600">✗</span>}</td>
                    <td className="p-3 text-zinc-500 text-xs">{c.last_mailing_at ? new Date(c.last_mailing_at).toLocaleDateString() : "—"}</td>
                    <td className="p-3">
                      <div className="flex gap-1 flex-wrap">
                        {c.tags?.map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">{tag}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-zinc-100 font-mono">{c.phone}</p>
                    <p className="text-xs text-zinc-500">{c.name || "—"}</p>
                  </div>
                  <div className="flex gap-2">
                    {c.has_tg && <span className="text-blue-400 text-xs">TG✓</span>}
                    {c.has_viber && <span className="text-purple-400 text-xs">Viber✓</span>}
                  </div>
                </div>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {c.tags?.map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center text-sm text-zinc-500">
            <span>{total} contacts</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 bg-zinc-800 rounded disabled:opacity-30">Prev</button>
              <span>Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={contacts.length < 50}
                className="px-3 py-1 bg-zinc-800 rounded disabled:opacity-30">Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add services/dashboard/src/app/\(dashboard\)/contacts/page.tsx
git commit -m "feat(frontend): contacts database page with search, filters, export"
```

---

### Task 12: WA Overview page

**Files:**
- Create: `services/dashboard/src/app/(dashboard)/wa-overview/page.tsx`

- [ ] **Step 1: Create WA Overview dashboard**

```tsx
// services/dashboard/src/app/(dashboard)/wa-overview/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Spinner } from "@/components/Spinner";
import { Wifi, WifiOff, UsersGroup, Radio } from "@/components/Icons";

export default function WaOverviewPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<{ total: number; with_tg: number; with_viber: number } | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api("/api/v1/phone-parser/contacts/stats").catch(() => null),
      api("/api/v1/phone-parser/wa/accounts").catch(() => []),
      api("/api/v1/phone-parser/wa/groups").catch(() => []),
    ]).then(([s, a, g]) => {
      setStats(s);
      setAccounts(a);
      setGroups(g);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6"><Spinner className="w-6 h-6" /></div>;

  const connected = accounts.filter((a: any) => a.status === "connected").length;
  const totalGroups = groups.length;
  const totalParsed = groups.reduce((sum: number, g: any) => sum + (g.parsed_count || 0), 0);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-zinc-100">WhatsApp Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <Wifi className={`w-6 h-6 mx-auto mb-2 ${connected > 0 ? "text-green-400" : "text-zinc-500"}`} />
          <p className="text-2xl font-bold text-zinc-100">{connected}</p>
          <p className="text-xs text-zinc-500">Connected</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <Radio className="w-6 h-6 mx-auto mb-2 text-blue-400" />
          <p className="text-2xl font-bold text-zinc-100">{totalGroups}</p>
          <p className="text-xs text-zinc-500">Groups</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <UsersGroup className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
          <p className="text-2xl font-bold text-zinc-100">{stats?.total || 0}</p>
          <p className="text-xs text-zinc-500">Contacts</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <span className="text-2xl block mb-2">📱</span>
          <p className="text-2xl font-bold text-blue-400">{stats?.with_tg || 0}</p>
          <p className="text-xs text-zinc-500">In Telegram</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add services/dashboard/src/app/\(dashboard\)/wa-overview/page.tsx
git commit -m "feat(frontend): WA overview dashboard page"
```

---

## Phase 3: Integration + Polish

### Task 13: API client additions

**Files:**
- Modify: `services/dashboard/src/lib/api.ts`

- [ ] **Step 1: Add phone parser API functions**

```typescript
// api.ts additions
export async function getWaAccounts() {
  return api<WaAccount[]>("/api/v1/phone-parser/wa/accounts");
}

export async function parseWaGroups(links: string[], geoTag?: string, tags?: string[]) {
  return api("/api/v1/phone-parser/wa/parse", {
    method: "POST",
    body: JSON.stringify({ group_links: links, geo_tag: geoTag, tags }),
  });
}

export async function getContacts(params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return api(`/api/v1/phone-parser/contacts${qs}`);
}

export async function exportContacts(filters: any) {
  const resp = await fetch("/api/v1/phone-parser/contacts/export", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
    body: JSON.stringify({ filters }),
  });
  return resp.blob();
}
```

- [ ] **Step 2: Commit**

```bash
git add services/dashboard/src/lib/api.ts
git commit -m "feat(api): add phone parser API client functions"
```

---

### Task 14: i18n completion

**Files:**
- Modify: `services/dashboard/src/lib/en.json`
- Modify: `services/dashboard/src/lib/ru.json`

- [ ] **Step 1: Add all missing i18n keys**

Search for all `t("wa.` and `t("contacts.` references in the new pages and add missing keys.

- [ ] **Step 2: Commit**

```bash
git add services/dashboard/src/lib/en.json services/dashboard/src/lib/ru.json
git commit -m "feat(i18n): complete WA and contacts translation keys"
```

---

### Task 15: Deploy + verify

**Files:**
- None (deployment only)

- [ ] **Step 1: Deploy sidecar to VPS**

```bash
cd services/wa-sidecar
npm install && npx tsc
docker build -t wa-sidecar .
# SCP to VPS and restart
```

- [ ] **Step 2: Deploy backend migration**

```bash
# Run migration 006 on VPS
```

- [ ] **Step 3: Push frontend to Vercel**

```bash
git push origin main
# Vercel auto-deploys
```

- [ ] **Step 4: Verify all services**

```bash
# Check sidecar health
curl http://localhost:3100/health
# Check API
curl https://api.24go.site/api/v1/phone-parser/wa/accounts
# Check frontend
open https://24go.site/wa-overview
```

---

## Summary

| Phase | Tasks | Est. Days |
|-------|-------|-----------|
| 1: Sidecar + DB + Backend | Tasks 1-7 | 3-4 |
| 2: Frontend | Tasks 8-12 | 3-4 |
| 3: Integration + Polish | Tasks 13-15 | 2-3 |
| **Total** | **15 tasks** | **8-11 days** |
