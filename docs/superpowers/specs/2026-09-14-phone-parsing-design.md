# Design: Phone Parsing Module (WhatsApp + Cross-Platform Contacts)

**Date:** 2026-09-14
**Status:** Final
**Author:** opencode
**Audit:** Self-reviewed, issues resolved inline

---

## 1. Overview

Add a third platform — **WhatsApp** — to the existing Telegram/VKontakte platform switcher. Parse phone numbers from WhatsApp group participants, store as cross-platform contacts, enable messaging via WhatsApp/Telegram/VKontakte.

### Goals
- Parse WhatsApp group participants via Baileys (multi-device protocol)
- Unified `contacts` table with cross-platform identity (phone = key)
- Auto-detect Telegram presence by phone number
- Campaigns/mailings integration with parsed contacts
- CSV export with filtering
- Mobile-responsive, EN/RU

### Non-Goals (v1)
- Viber parsing (future — no public API for group member lists)
- Bulk messaging FROM WhatsApp (TOS limits)
- Real-time group monitoring

---

## 2. Architecture

### 2.1 Baileys Integration: Node.js Sidecar

Baileys is a Node.js library. Two options evaluated:

| | **A) Node.js Sidecar** | **B) Python Subprocess** |
|---|---|---|
| Reliability | High — independent process | Medium — process management |
| Communication | HTTP REST on localhost | stdin/stdout IPC |
| Memory | ~50MB per instance | Same |
| Maintenance | Separate Docker service | Embedded in worker |
| Scaling | Independent scaling | Tied to worker |

**Decision: A) Node.js Sidecar** — production-grade, clean separation.

```
┌──────────────┐     HTTP/localhost     ┌──────────────────┐
│  Backend API │ ◄────────────────────► │  wa-sidecar:3100 │
│  (FastAPI)   │                        │  (Node.js/Baileys)│
└──────┬───────┘                        └────────┬─────────┘
       │                                         │
       ▼                                         ▼
┌──────────────┐                        ┌──────────────────┐
│  PostgreSQL  │                        │  Session files   │
│  (contacts)  │                        │  /data/wa/sess/  │
└──────────────┘                        └──────────────────┘
       │
       ▼
┌──────────────┐
│  Celery      │
│  (wa_tasks)  │
└──────────────┘
```

### 2.2 Sidecar API (wa-sidecar:3100)

```
POST /connect          → Initiate QR connection, returns {qr: base64, status: "qr_pending"}
GET  /status/:id       → Get connection status
POST /disconnect/:id   → Disconnect account
POST /parse-groups     → Parse group participants {account_id, group_links}
GET  /parse-progress/:task_id → Get parsing progress
POST /sessions/:id/export → Export session data (encrypted)
POST /sessions/:id/import → Import session data
GET  /health           → Health check
```

### 2.3 Data Flow

1. User clicks "Connect WhatsApp" → Backend calls sidecar `/connect`
2. Sidecar creates Baileys instance, returns QR code
3. User scans QR → Sidecar confirms connection → Backend saves session to `wa_accounts`
4. User pastes group links → Backend calls sidecar `/parse-groups`
5. Sidecar joins groups, extracts participants → Returns phone numbers
6. Backend upserts into `contacts` table
7. (Optional) Backend runs Telegram check via Telethon API
8. User exports CSV or assigns contacts to campaign

---

## 3. Data Model

### 3.1 Modified Enum

```python
# models.py
class PlatformType(str, enum.Enum):
    telegram = "telegram"
    vkontakte = "vkontakte"
    forum = "forum"
    whatsapp = "whatsapp"  # NEW
```

### 3.2 New Table: `contacts`

```sql
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identity (phone = natural key)
    phone VARCHAR(20) NOT NULL,              -- E.164: "+66812345678"
    name VARCHAR(255),                        -- Display name from WhatsApp
    
    -- WhatsApp source
    wa_jid VARCHAR(50),                       -- "66812345678@s.whatsapp.net"
    wa_group_source VARCHAR(255),             -- Group name/link where parsed
    wa_group_jid VARCHAR(50),                 -- Group JID
    wa_parsed_at TIMESTAMPTZ,
    
    -- Cross-platform
    has_tg BOOLEAN DEFAULT FALSE,
    has_viber BOOLEAN DEFAULT FALSE,
    tg_user_id BIGINT,
    tg_username VARCHAR(255),
    viber_user_id VARCHAR(100),
    
    -- Mailing stats
    last_mailing_at TIMESTAMPTZ,
    last_mailing_campaign_id UUID REFERENCES campaigns(id),
    mailing_count INTEGER DEFAULT 0,
    
    -- Meta
    tags JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, phone)
);

CREATE INDEX idx_contacts_tenant_phone ON contacts(tenant_id, phone);
CREATE INDEX idx_contacts_tenant_tg ON contacts(tenant_id, has_tg) WHERE has_tg = TRUE;
CREATE INDEX idx_contacts_tenant_mailing ON contacts(tenant_id, last_mailing_at);
```

### 3.3 New Table: `wa_accounts`

```sql
CREATE TABLE wa_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    phone VARCHAR(20) NOT NULL,
    jid VARCHAR(50),
    name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'disconnected', -- disconnected, qr_pending, connected, banned
    session_file_path VARCHAR(500),             -- Path to Baileys session dir on VPS
    
    -- Anti-ban
    daily_parse_limit INTEGER DEFAULT 50,
    parses_today INTEGER DEFAULT 0,
    last_parse_at TIMESTAMPTZ,
    cooldown_until TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wa_accounts_tenant ON wa_accounts(tenant_id, status);
```

### 3.4 New Table: `wa_groups`

```sql
CREATE TABLE wa_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES wa_accounts(id) ON DELETE CASCADE,
    
    group_jid VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    link VARCHAR(500),
    participants_count INTEGER DEFAULT 0,
    parsed_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'idle',  -- idle, parsing, completed, error
    last_parsed_at TIMESTAMPTZ,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, group_jid)
);

CREATE INDEX idx_wa_groups_tenant ON wa_groups(tenant_id, status);
```

---

## 4. Backend API

### 4.1 Router: `routers/phone_parser.py`

Prefix: `/api/v1/phone-parser`

#### WhatsApp Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/wa/connect` | Initiate QR connection |
| GET | `/wa/qr/{account_id}` | Get QR code (polling) |
| GET | `/wa/status` | Connection status |
| POST | `/wa/disconnect/{id}` | Disconnect |
| GET | `/wa/accounts` | List accounts |
| DELETE | `/wa/accounts/{id}` | Remove account |

#### Group Parsing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/wa/parse` | Start parsing (links + tags) |
| GET | `/wa/parse-status/{task_id}` | Check parse progress |
| GET | `/wa/groups` | List parsed groups |
| DELETE | `/wa/groups/{id}` | Remove group |

#### Contacts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/contacts` | List (filters: search, tg, tags, date) |
| GET | `/contacts/{id}` | Detail |
| PUT | `/contacts/{id}` | Update tags/notes |
| DELETE | `/contacts/{id}` | Delete |
| POST | `/contacts/check-tg` | Check phones against Telegram |
| POST | `/contacts/export` | CSV export |
| GET | `/contacts/stats` | Statistics |
| POST | `/contacts/bulk-tag` | Bulk tag |
| POST | `/contacts/assign-campaign` | Assign to campaign/mailing |

### 4.2 Schemas

```python
class WhatsAppParseRequest(BaseModel):
    group_links: list[str]
    geo_tag: str | None = None
    tags: list[str] = []

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

class ContactFilter(BaseModel):
    search: str | None = None
    has_tg: bool | None = None
    tags: list[str] | None = None
    parsed_after: datetime | None = None
    parsed_before: datetime | None = None
    page: int = 1
    page_size: int = 50
```

---

## 5. Worker Tasks

### 5.1 New File: `tasks/wa_tasks.py`

Queue: `parser` (reuse existing worker)

```python
# Task: wa_parse_groups
# 1. Call sidecar HTTP to join groups and get participants
# 2. Upsert each phone into contacts table
# 3. Update wa_groups status
# 4. Anti-ban: 15-45s delay between groups

# Task: wa_check_telegram
# 1. Use Telethon import_contacts() + get_contacts()
# 2. Match phones → Telegram users
# 3. Update contacts.has_tg, tg_user_id, tg_username
```

### 5.2 Anti-Ban

```python
WA_PARSE_LIMITS = {
    "groups_per_hour": 5,
    "groups_per_day": 30,
    "delay_between_groups": (15, 45),  # random seconds
}
```

---

## 6. Frontend

### 6.1 Platform Switcher

Three buttons (TG / VK / WA), narrower:

```tsx
// platform.tsx
type Platform = "telegram" | "vkontakte" | "whatsapp";
```

Sidebar buttons: `text-[10px]`, `min-h-[28px]`, `gap-0.5`

### 6.2 Navigation (when whatsapp)

```
/wa-overview    — Dashboard
/wa-accounts    — Connect WA accounts
/wa-groups      — Parse groups
/contacts       — Contact database
/campaigns      — Campaigns (reuse)
/mailings       — Mailings (reuse)
/billing        — Billing (reuse)
/settings       — Settings (reuse)
```

### 6.3 Pages

**`/wa-overview`**: Status card, total contacts, quick actions
**`/wa-accounts`**: Connect (QR modal), list accounts, disconnect
**`/wa-groups`**: Link input, geo tag, parse button, group list
**`/contacts`**: Search, filters (TG/tags/date), table (Phone, Name, TG, Last Mailing, Tags), bulk actions, CSV export

### 6.4 Mobile

- Tables → cards on mobile
- QR modal → full-screen
- Filter chips instead of dropdowns
- Min 44px tap targets

### 6.5 i18n Keys

```json
{
  "sidebar.waOverview": { "en": "WA Overview", "ru": "Обзор WA" },
  "sidebar.waAccounts": { "en": "WA Accounts", "ru": "Аккаунты WA" },
  "sidebar.waGroups": { "en": "WA Groups", "ru": "Группы WA" },
  "sidebar.contacts": { "en": "Contacts", "ru": "Контакты" },
  "wa.connect": { "en": "Connect WhatsApp", "ru": "Подключить WhatsApp" },
  "wa.scanQR": { "en": "Scan QR with WhatsApp", "ru": "Отсканируйте QR в WhatsApp" },
  "wa.parsing": { "en": "Parsing...", "ru": "Парсинг..." },
  "contacts.title": { "en": "Contact Database", "ru": "База контактов" },
  "contacts.exportCSV": { "en": "Export CSV", "ru": "Экспорт CSV" },
  "contacts.checkTG": { "en": "Check in Telegram", "ru": "Проверить в Telegram" }
}
```

---

## 7. Campaign/Mailing Integration

- Contacts page: "Assign to Campaign" button → select campaign
- Campaign creation: new section "Select Contacts" with filters
- After mailing sent: auto-update `contacts.last_mailing_at`, `contacts.mailing_count`
- Platform field: `whatsapp` for WA-sourced contacts

---

## 8. VK Integration (Future Phase)

Phone numbers can be used to:
- Search VK users by phone
- Add as friends via VK API
- Send messages via VK messages

Schema supports via `has_vk`, `vk_user_id` columns (add later).

---

## 9. Security

- Session files encrypted on VPS (Fernet via ENCRYPTION_KEY)
- Phone numbers: E.164 format only
- All queries scoped to `tenant_id` (app-level RLS)
- Plan-based contact limits
- Rate limits enforced

---

## 10. Implementation Plan

### Phase 1: Sidecar + Core Backend (3-4 days)
1. Node.js sidecar service (`services/wa-sidecar/`)
2. Docker compose: add `wa-sidecar` service
3. Database migration `006_phone_parser.sql`
4. Backend router `phone_parser.py` + schemas
5. Worker task `wa_tasks.py`

### Phase 2: Frontend Core (3-4 days)
1. Platform type + sidebar update
2. `/wa-accounts` page (QR connect)
3. `/wa-groups` page (parse groups)
4. `/contacts` page (list, search, filter)

### Phase 3: Integration + Export (2-3 days)
1. Campaign/mailing integration
2. CSV export
3. Telegram phone check
4. i18n completion

### Phase 4: Polish (1-2 days)
1. Mobile responsive fixes
2. Error handling
3. Testing

---

## 11. Files to Create/Modify

### New Files
```
services/wa-sidecar/
  package.json
  src/index.ts          -- Express server (port 3100)
  src/baileys.ts        -- Baileys wrapper
  src/session.ts        -- Session management
  Dockerfile

services/backend/app/routers/phone_parser.py
services/backend/app/tasks/wa_tasks.py
services/backend/migrations/006_phone_parser.sql

services/dashboard/src/app/(dashboard)/wa-overview/page.tsx
services/dashboard/src/app/(dashboard)/wa-accounts/page.tsx
services/dashboard/src/app/(dashboard)/wa-groups/page.tsx
services/dashboard/src/app/(dashboard)/contacts/page.tsx
services/dashboard/src/components/WaQRModal.tsx
services/dashboard/src/components/ContactTable.tsx
```

### Modified Files
```
services/backend/app/models.py          -- PlatformType enum + new models
services/backend/app/schemas.py         -- New schemas
services/backend/app/main.py            -- Include router
services/backend/app/celery_app.py      -- Task routes
services/backend/requirements.txt       -- (no changes needed)
services/dashboard/src/lib/platform.tsx -- Add "whatsapp"
services/dashboard/src/components/Sidebar.tsx -- 3 buttons + WA nav
services/dashboard/src/lib/api.ts       -- New API calls
services/dashboard/src/lib/en.json      -- i18n keys
services/dashboard/src/lib/ru.json      -- i18n keys
docker-compose.yml                      -- wa-sidecar service
```
