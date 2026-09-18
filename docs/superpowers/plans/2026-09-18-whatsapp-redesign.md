# WhatsApp Section Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite WhatsApp section with correct API contracts, 3 auth methods, cross-platform contacts, and comprehensive statistics.

**Architecture:** Baileys sidecar (Node.js) → FastAPI backend → Next.js frontend. Single sidecar instance, Redis-based locking, database-backed sessions.

**Tech Stack:** Baileys 6.7.24, FastAPI, PostgreSQL, Redis, Next.js, TypeScript

## Global Constraints

- Baileys version: `@whiskeysockets/baileys@6.7.24` (stable, NOT 7.x)
- Phone format: always E.164 (`+79001234567`)
- Timestamps: UTC in DB, convert in UI
- Single sidecar instance (no horizontal scaling)
- QR code: in-memory only, no localStorage
- All API calls: 30s timeout max

---

## Phase 1: Sidecar Rewrite

### Task 1: Rewrite sidecar core

**Files:**
- Modify: `services/wa-sidecar/src/index.ts`
- Modify: `services/wa-sidecar/src/session.ts`
- Create: `services/wa-sidecar/src/auth.ts`
- Modify: `services/wa-sidecar/package.json`

**Interfaces:**
- Consumes: None (first task)
- Produces: `SessionManager` class, Express server on port 3100

- [ ] **Step 1: Update package.json with correct dependencies**

```json
{
  "name": "wa-sidecar",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "6.7.24",
    "express": "^4.18.0",
    "qrcode": "^1.5.0",
    "node-cache": "^5.1.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "@types/qrcode": "^1.5.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create auth.ts with session manager**

```typescript
// services/wa-sidecar/src/auth.ts
import { useMultiFileAuthState, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys'
import path from 'path'
import fs from 'fs'

const SESSIONS_DIR = process.env.SESSIONS_DIR || '/data/wa_sessions'

export class SessionManager {
  private sessions: Map<string, any> = new Map()

  async getSession(accountId: string) {
    if (this.sessions.has(accountId)) {
      return this.sessions.get(accountId)
    }

    const sessionDir = path.join(SESSIONS_DIR, accountId)
    if (!fs.existsSync(sessionDir)) {
      return null
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
    this.sessions.set(accountId, { state, saveCreds })
    return { state, saveCreds }
  }

  async createSession(accountId: string) {
    const sessionDir = path.join(SESSIONS_DIR, accountId)
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true })
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
    this.sessions.set(accountId, { state, saveCreds })
    return { state, saveCreds }
  }

  deleteSession(accountId: string) {
    const sessionDir = path.join(SESSIONS_DIR, accountId)
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true })
    }
    this.sessions.delete(accountId)
  }

  hasSession(accountId: string): boolean {
    return this.sessions.has(accountId)
  }
}

export const sessionManager = new SessionManager()
```

- [ ] **Step 3: Rewrite index.ts with proper routes**

```typescript
// services/wa-sidecar/src/index.ts
import express from 'express'
import cors from 'cors'
import makeWASocket, { DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys'
import QRCode from 'qrcode'
import NodeCache from 'node-cache'
import { sessionManager } from './auth'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3100
const groupCache = new NodeCache()

// Store active connections
const connections: Map<string, any> = new Map()
const qrCodes: Map<string, string> = new Map()
const pairingCodes: Map<string, string> = new Map()

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', connections: connections.size })
})

// Connect account
app.post('/connect', async (req, res) => {
  const { accountId, phoneNumber, method } = req.body

  if (connections.has(accountId)) {
    return res.json({ status: 'already_connected' })
  }

  try {
    const { state, saveCreds } = await sessionManager.createSession(accountId)

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, console)
      },
      printQRInTerminal: false,
      cachedGroupMetadata: async (jid) => groupCache.get(jid),
      generateHighQualityLinkPreview: false
    })

    connections.set(accountId, sock)

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, qr, lastDisconnect } = update

      if (qr) {
        const qrImage = await QRCode.toDataURL(qr)
        qrCodes.set(accountId, qrImage)
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode
        if (reason !== DisconnectReason.loggedOut) {
          // Reconnect logic here
          console.log(`Connection closed for ${accountId}, reason: ${reason}`)
        } else {
          connections.delete(accountId)
          qrCodes.delete(accountId)
          sessionManager.deleteSession(accountId)
        }
      }

      if (connection === 'open') {
        qrCodes.delete(accountId)
        pairingCodes.delete(accountId)
      }
    })

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds)

    // Handle pairing code method
    if (method === 'pairing' && phoneNumber) {
      const code = await sock.requestPairingCode(phoneNumber)
      pairingCodes.set(accountId, code)
    }

    res.json({ status: 'connecting', method })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Get QR code
app.get('/qr/:accountId', (req, res) => {
  const qr = qrCodes.get(req.params.accountId)
  if (!qr) {
    return res.status(404).json({ error: 'No QR code available' })
  }
  res.json({ qr })
})

// Get pairing code
app.get('/pairing-code/:accountId', (req, res) => {
  const code = pairingCodes.get(req.params.accountId)
  if (!code) {
    return res.status(404).json({ error: 'No pairing code available' })
  }
  res.json({ code })
})

// Get connection status
app.get('/status/:accountId', (req, res) => {
  const sock = connections.get(req.params.accountId)
  if (!sock) {
    return res.json({ status: 'disconnected' })
  }
  res.json({ status: 'connected' })
})

// Disconnect
app.post('/disconnect/:accountId', (req, res) => {
  const sock = connections.get(req.params.accountId)
  if (sock) {
    sock.end()
    connections.delete(req.params.accountId)
    qrCodes.delete(req.params.accountId)
    pairingCodes.delete(req.params.accountId)
  }
  sessionManager.deleteSession(req.params.accountId)
  res.json({ status: 'disconnected' })
})

// Parse group participants
app.post('/parse-groups', async (req, res) => {
  const { accountId, groupLinks } = req.body

  const sock = connections.get(accountId)
  if (!sock) {
    return res.status(400).json({ error: 'Account not connected' })
  }

  try {
    const allParticipants: any[] = []

    for (const link of groupLinks) {
      // Extract invite code from URL
      const code = link.split('/').pop()
      if (!code) continue

      // Get group info without joining
      const info = await sock.groupGetInviteInfo(code)
      
      // Join the group
      const groupJid = await sock.groupAcceptInvite(code)
      
      // Get participants
      const metadata = await sock.groupMetadata(groupJid)
      
      for (const participant of metadata.participants) {
        const phone = participant.id.replace('@s.whatsapp.net', '')
        allParticipants.push({
          phone: `+${phone}`,
          groupName: metadata.subject,
          groupId: groupJid,
          joinedAt: new Date().toISOString()
        })
      }

      // Cache group metadata
      groupCache.set(groupJid, metadata)

      // Leave group after parsing (optional)
      // await sock.groupLeave(groupJid)

      // Delay between groups (anti-ban)
      await new Promise(resolve => setTimeout(resolve, 15000 + Math.random() * 30000))
    }

    res.json({ participants: allParticipants, total: allParticipants.length })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Check if number is on WhatsApp
app.post('/check-whatsapp', async (req, res) => {
  const { accountId, phoneNumbers } = req.body

  const sock = connections.get(accountId)
  if (!sock) {
    return res.status(400).json({ error: 'Account not connected' })
  }

  try {
    const results = []
    for (const phone of phoneNumbers) {
      const [result] = await sock.onWhatsApp(`${phone}@s.whatsapp.net`)
      results.push({ phone, exists: result.exists, jid: result.jid })
    }
    res.json({ results })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`wa-sidecar listening on port ${PORT}`)
})
```

- [ ] **Step 4: Install dependencies and test build**

Run: `cd services/wa-sidecar && npm install && npm run build`

- [ ] **Step 5: Commit**

```bash
git add services/wa-sidecar/
git commit -m "feat(wa-sidecar): rewrite with Baileys 6.7.24, 3 auth methods, proper routes"
```

### Task 2: Update Dockerfile

**Files:**
- Modify: `services/wa-sidecar/Dockerfile`

**Interfaces:**
- Consumes: Task 1 output
- Produces: Working Docker image

- [ ] **Step 1: Update Dockerfile**

```dockerfile
FROM node:20-slim

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY dist/ ./dist/

EXPOSE 3100

CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Build and test locally**

Run: `cd services/wa-sidecar && docker build -t wa-sidecar-test .`

- [ ] **Step 3: Commit**

```bash
git add services/wa-sidecar/Dockerfile
git commit -m "fix(wa-sidecar): update Dockerfile for new build"
```

---

## Phase 2: Backend Rewrite

### Task 3: Rewrite phone_parser router

**Files:**
- Modify: `services/backend/app/routers/phone_parser.py`
- Modify: `services/backend/app/schemas.py`
- Modify: `services/backend/app/models.py`

**Interfaces:**
- Consumes: Task 1-2 output (sidecar routes)
- Produces: Correct API contracts for frontend

- [ ] **Step 1: Add new schemas to schemas.py**

```python
# services/backend/app/schemas.py

# WhatsApp Account schemas
class WaAccountCreate(BaseModel):
    phone_number: str
    method: str = "qr"  # qr, pairing, existing

class WaAccountResponse(BaseModel):
    id: uuid.UUID
    phone_number: str
    status: str
    created_at: datetime

class WaQRResponse(BaseModel):
    qr: str

class WaPairingCodeResponse(BaseModel):
    code: str

class WaStatusResponse(BaseModel):
    status: str  # connected, disconnected, connecting

class WaParseRequest(BaseModel):
    account_id: uuid.UUID
    group_links: List[str]
    tags: List[str] = []

class WaParseResponse(BaseModel):
    participants: List[dict]
    total: int

# Contact schemas
class ContactResponse(BaseModel):
    id: uuid.UUID
    phone: str
    name: Optional[str]
    country: Optional[str]
    source_group: Optional[str]
    platforms: dict
    tags: List[str]
    last_mailing: Optional[dict]
    quality_score: int
    created_at: datetime

class ContactCheckRequest(BaseModel):
    phone_numbers: List[str]

class ContactRefreshRequest(BaseModel):
    contact_ids: List[uuid.UUID]
```

- [ ] **Step 2: Rewrite phone_parser.py router**

```python
# services/backend/app/routers/phone_parser.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.security import get_current_user
from app.models import WaAccount, Contact
from app.schemas import (
    WaAccountCreate, WaAccountResponse, WaQRResponse,
    WaPairingCodeResponse, WaStatusResponse, WaParseRequest,
    WaParseResponse, ContactResponse, ContactCheckRequest,
    ContactRefreshRequest
)
import httpx
import os

router = APIRouter(prefix="/wa", tags=["whatsapp"])

SIDECAR_URL = os.environ.get("SIDECAR_URL", "http://wa-sidecar:3100")

# WhatsApp Account endpoints
@router.post("/connect", response_model=WaAccountResponse)
async def connect_whatsapp(
    data: WaAccountCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    # Create account in DB
    account = WaAccount(
        tenant_id=user.tenant_id,
        phone_number=data.phone_number,
        status="connecting"
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)

    # Call sidecar
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(f"{SIDECAR_URL}/connect", json={
            "accountId": str(account.id),
            "phoneNumber": data.phone_number,
            "method": data.method
        })
        if response.status_code != 200:
            raise HTTPException(500, "Failed to connect to sidecar")

    return account

@router.get("/qr/{account_id}", response_model=WaQRResponse)
async def get_qr(
    account_id: str,
    user=Depends(get_current_user)
):
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{SIDECAR_URL}/qr/{account_id}")
        if response.status_code != 200:
            raise HTTPException(404, "No QR code available")
        return response.json()

@router.get("/pairing-code/{account_id}", response_model=WaPairingCodeResponse)
async def get_pairing_code(
    account_id: str,
    user=Depends(get_current_user)
):
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{SIDECAR_URL}/pairing-code/{account_id}")
        if response.status_code != 200:
            raise HTTPException(404, "No pairing code available")
        return response.json()

@router.get("/status/{account_id}", response_model=WaStatusResponse)
async def get_status(
    account_id: str,
    user=Depends(get_current_user)
):
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{SIDECAR_URL}/status/{account_id}")
        return response.json()

@router.post("/disconnect/{account_id}")
async def disconnect(
    account_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(f"{SIDECAR_URL}/disconnect/{account_id}")

    # Update DB
    account = await db.get(WaAccount, account_id)
    if account:
        account.status = "disconnected"
        await db.commit()

    return {"status": "disconnected"}

@router.get("/accounts")
async def list_accounts(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    accounts = await db.execute(
        select(WaAccount).where(WaAccount.tenant_id == user.tenant_id)
    )
    return accounts.scalars().all()

@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    account = await db.get(WaAccount, account_id)
    if not account or account.tenant_id != user.tenant_id:
        raise HTTPException(404, "Account not found")

    # Disconnect from sidecar
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(f"{SIDECAR_URL}/disconnect/{account_id}")

    await db.delete(account)
    await db.commit()
    return {"status": "deleted"}

# Group parsing
@router.post("/parse", response_model=WaParseResponse)
async def parse_groups(
    data: WaParseRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(f"{SIDECAR_URL}/parse-groups", json={
            "accountId": str(data.account_id),
            "groupLinks": data.group_links
        })
        if response.status_code != 200:
            raise HTTPException(500, "Failed to parse groups")
        return response.json()

@router.get("/groups")
async def list_groups(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    # Query wa_groups table
    groups = await db.execute(
        select(WaGroup).where(WaGroup.tenant_id == user.tenant_id)
    )
    return groups.scalars().all()
```

- [ ] **Step 3: Test endpoints**

Run: `cd services/backend && python -m pytest tests/test_phone_parser.py -v`

- [ ] **Step 4: Commit**

```bash
git add services/backend/app/routers/phone_parser.py services/backend/app/schemas.py
git commit -m "feat(backend): rewrite phone_parser with correct sidecar contracts"
```

### Task 4: Add cross-platform contact management

**Files:**
- Create: `services/backend/app/routers/contacts.py`
- Create: `services/backend/app/services/platform_checker.py`

**Interfaces:**
- Consumes: Task 3 output
- Produces: `/contacts/*` endpoints

- [ ] **Step 1: Create platform_checker.py**

```python
# services/backend/app/services/platform_checker.py
import httpx
import os

TELEGRAM_API_URL = os.environ.get("TELEGRAM_API_URL", "http://bot:8000")
VK_API_URL = os.environ.get("VK_API_URL", "http://worker-poster:8000")

async def check_telegram(phone: str) -> dict:
    """Check if phone number is on Telegram"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(f"{TELEGRAM_API_URL}/check-user", json={"phone": phone})
            if response.status_code == 200:
                return response.json()
    except:
        pass
    return {"exists": False}

async def check_vkontakte(phone: str) -> dict:
    """Check if phone number is on VKontakte"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(f"{VK_API_URL}/check-user", json={"phone": phone})
            if response.status_code == 200:
                return response.json()
    except:
        pass
    return {"exists": False}

async def check_whatsapp(phone: str, account_id: str) -> dict:
    """Check if phone number is on WhatsApp via sidecar"""
    try:
        sidecar_url = os.environ.get("SIDECAR_URL", "http://wa-sidecar:3100")
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(f"{sidecar_url}/check-whatsapp", json={
                "accountId": account_id,
                "phoneNumbers": [phone]
            })
            if response.status_code == 200:
                data = response.json()
                if data.get("results"):
                    return data["results"][0]
    except:
        pass
    return {"exists": False}
```

- [ ] **Step 2: Create contacts.py router**

```python
# services/backend/app/routers/contacts.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.security import get_current_user
from app.models import Contact
from app.services.platform_checker import check_telegram, check_vkontakte, check_whatsapp
from typing import List, Optional
import re

router = APIRouter(prefix="/contacts", tags=["contacts"])

def normalize_phone(phone: str) -> str:
    """Normalize phone to E.164 format"""
    phone = re.sub(r'[^\d+]', '', phone)
    if not phone.startswith('+'):
        phone = '+' + phone
    return phone

@router.get("/")
async def list_contacts(
    search: Optional[str] = None,
    platform: Optional[str] = None,
    country: Optional[str] = None,
    tags: Optional[List[str]] = Query(None),
    quality: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    query = select(Contact).where(Contact.tenant_id == user.tenant_id)

    if search:
        query = query.where(Contact.phone.contains(search) | Contact.name.contains(search))
    if country:
        query = query.where(Contact.country == country)
    if quality:
        if quality == "high":
            query = query.where(Contact.quality_score >= 80)
        elif quality == "medium":
            query = query.where(Contact.quality_score.between(50, 79))
        elif quality == "low":
            query = query.where(Contact.quality_score < 50)

    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    return result.scalars().all()

@router.post("/check-platforms")
async def check_platforms(
    data: ContactCheckRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    """Check TG/VK/WA/Viber for phone numbers"""
    results = []
    for phone in data.phone_numbers:
        phone = normalize_phone(phone)
        tg = await check_telegram(phone)
        vk = await check_vkontakte(phone)
        # WA check requires an account
        wa = {"exists": False}
        
        results.append({
            "phone": phone,
            "telegram": tg,
            "vkontakte": vk,
            "whatsapp": wa
        })
    return results

@router.post("/refresh-platforms")
async def refresh_platforms(
    data: ContactRefreshRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    """Refresh platform status for contacts"""
    for contact_id in data.contact_ids:
        contact = await db.get(Contact, contact_id)
        if contact and contact.tenant_id == user.tenant_id:
            tg = await check_telegram(contact.phone)
            vk = await check_vkontakte(contact.phone)
            contact.platforms = {
                **contact.platforms,
                "telegram": tg,
                "vkontakte": vk
            }
            await db.commit()
    return {"status": "refreshed"}

@router.post("/bulk-tag")
async def bulk_tag(
    contact_ids: List[str],
    tags: List[str],
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    """Add tags to multiple contacts"""
    for contact_id in contact_ids:
        contact = await db.get(Contact, contact_id)
        if contact and contact.tenant_id == user.tenant_id:
            contact.tags = list(set(contact.tags + tags))
    await db.commit()
    return {"status": "tagged"}
```

- [ ] **Step 3: Register router in main.py**

Add to `services/backend/app/main.py`:
```python
from app.routers import contacts
app.include_router(contacts.router)
```

- [ ] **Step 4: Commit**

```bash
git add services/backend/app/routers/contacts.py services/backend/app/services/platform_checker.py
git commit -m "feat(backend): add cross-platform contact management"
```

---

## Phase 3: Frontend Rewrite

### Task 5: Rewrite WA Accounts page

**Files:**
- Modify: `services/dashboard/src/app/(dashboard)/wa-accounts/page.tsx`
- Modify: `services/dashboard/src/components/WaQRModal.tsx`
- Modify: `services/dashboard/src/lib/api.ts`

**Interfaces:**
- Consumes: Task 3 output (backend endpoints)
- Produces: Working WA Accounts UI

- [ ] **Step 1: Update api.ts with correct endpoints**

```typescript
// services/dashboard/src/lib/api.ts

// WhatsApp endpoints
export async function connectWhatsApp(token: string, data: { phone_number: string; method: string }) {
  const res = await fetch(`${API_URL}/api/v1/wa/connect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to connect')
  return res.json()
}

export async function getWhatsAppQr(token: string, accountId: string) {
  const res = await fetch(`${API_URL}/api/v1/wa/qr/${accountId}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('No QR available')
  return res.json()
}

export async function getWhatsAppPairingCode(token: string, accountId: string) {
  const res = await fetch(`${API_URL}/api/v1/wa/pairing-code/${accountId}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('No pairing code')
  return res.json()
}

export async function getWhatsAppStatus(token: string, accountId: string) {
  const res = await fetch(`${API_URL}/api/v1/wa/status/${accountId}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  return res.json()
}

export async function disconnectWhatsApp(token: string, accountId: string) {
  const res = await fetch(`${API_URL}/api/v1/wa/disconnect/${accountId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
  return res.json()
}

export async function getWaAccounts(token: string) {
  const res = await fetch(`${API_URL}/api/v1/wa/accounts`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  return res.json()
}

export async function deleteWaAccount(token: string, accountId: string) {
  const res = await fetch(`${API_URL}/api/v1/wa/accounts/${accountId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
  return res.json()
}
```

- [ ] **Step 2: Rewrite wa-accounts/page.tsx**

Full component with method selection, QR display, pairing code display, and account list. (Full code in implementation)

- [ ] **Step 3: Rewrite WaQRModal.tsx with timer**

Full component with QR display, 15s auto-refresh, countdown timer, and cancel button. (Full code in implementation)

- [ ] **Step 4: Commit**

```bash
git add services/dashboard/src/app/\(dashboard\)/wa-accounts/ services/dashboard/src/components/WaQRModal.tsx services/dashboard/src/lib/api.ts
git commit -m "feat(frontend): rewrite WA Accounts with 3 auth methods"
```

### Task 6: Rewrite WA Groups page

**Files:**
- Modify: `services/dashboard/src/app/(dashboard)/wa-groups/page.tsx`

**Interfaces:**
- Consumes: Task 3 output
- Produces: Working WA Groups UI with progress bar

- [ ] **Step 1: Rewrite wa-groups/page.tsx**

Full component with progress bar, real-time updates, cancel button, and account status check. (Full code in implementation)

- [ ] **Step 2: Commit**

```bash
git add services/dashboard/src/app/\(dashboard\)/wa-groups/
git commit -m "feat(frontend): rewrite WA Groups with progress tracking"
```

### Task 7: Rewrite Contacts page

**Files:**
- Modify: `services/dashboard/src/app/(dashboard)/contacts/page.tsx`

**Interfaces:**
- Consumes: Task 4 output
- Produces: Cross-platform contacts table

- [ ] **Step 1: Rewrite contacts/page.tsx**

Full component with cross-platform columns, filters (phone, platform, country, tags, quality), bulk actions, and CSV export. (Full code in implementation)

- [ ] **Step 2: Commit**

```bash
git add services/dashboard/src/app/\(dashboard\)/contacts/
git commit -m "feat(frontend): rewrite Contacts with cross-platform view"
```

### Task 8: Rewrite WA Overview page

**Files:**
- Modify: `services/dashboard/src/app/(dashboard)/wa-overview/page.tsx`

**Interfaces:**
- Consumes: Tasks 3-4 output
- Produces: Dashboard with all statistics

- [ ] **Step 1: Rewrite wa-overview/page.tsx**

Full component with stat cards, charts, mailing history, and contact quality distribution. (Full code in implementation)

- [ ] **Step 2: Commit**

```bash
git add services/dashboard/src/app/\(dashboard\)/wa-overview/
git commit -m "feat(frontend): rewrite WA Overview with comprehensive stats"
```

### Task 9: Add i18n keys

**Files:**
- Modify: `services/dashboard/src/lib/en.json`
- Modify: `services/dashboard/src/lib/ru.json`

**Interfaces:**
- Consumes: Tasks 5-8 output
- Produces: All text translated

- [ ] **Step 1: Add EN keys**

Add all WA-related i18n keys to en.json. (Full keys in implementation)

- [ ] **Step 2: Add RU keys**

Add all WA-related i18n keys to ru.json. (Full keys in implementation)

- [ ] **Step 3: Commit**

```bash
git add services/dashboard/src/lib/en.json services/dashboard/src/lib/ru.json
git commit -m "feat(i18n): add WA section translations"
```

---

## Phase 4: Deploy & Verify

### Task 10: Deploy to VPS

**Files:**
- None (deployment only)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Running services on VPS

- [ ] **Step 1: Run migration**

```bash
ssh root@46.250.235.165 "docker exec -i generator-ad-postgres-1 psql -U app_user -d app_db < /tmp/006_phone_parser.sql"
```

- [ ] **Step 2: Deploy sidecar**

```bash
scp -r services/wa-sidecar root@46.250.235.165:/opt/generator-ad/services/
ssh root@46.250.235.165 "cd /opt/generator-ad && docker compose up -d --build --force-recreate wa-sidecar"
```

- [ ] **Step 3: Deploy backend**

```bash
scp -r services/backend root@46.250.235.165:/opt/generator-ad/services/
ssh root@46.250.235.165 "cd /opt/generator-ad && docker compose up -d --build --force-recreate fastapi"
```

- [ ] **Step 4: Push frontend**

```bash
git push origin main
```

- [ ] **Step 5: Verify all services**

```bash
ssh root@46.250.235.165 "docker ps --format '{{.Names}} {{.Status}}'"
curl -s https://api.24go.site/health
```

- [ ] **Step 6: Commit deployment notes**

```bash
git commit --allow-empty -m "deploy: WA redesign v1.0"
```
