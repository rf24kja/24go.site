# WhatsApp Section Redesign — Design Spec

**Date:** 2026-09-18
**Status:** Approved (post-audit)
**Scope:** Complete rewrite of WhatsApp section (frontend + backend + sidecar)
**Audits:** Technical Feasibility, UX/Flow, Security & Edge Cases

## 1. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│  wa-overview │ wa-accounts │ wa-groups │ contacts       │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API
┌───────────────────────▼─────────────────────────────────┐
│                  Backend (FastAPI)                       │
│  /wa/* endpoints    │    /contacts/* endpoints          │
│  (WA-specific)      │    (cross-platform)               │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP
┌───────────────────────▼─────────────────────────────────┐
│               WA Sidecar (Node.js/Baileys)              │
│  /connect  /qr  /status  /disconnect  /parse-groups     │
└───────────────────────┬─────────────────────────────────┘
                        │ WebSocket
┌───────────────────────▼─────────────────────────────────┐
│              WhatsApp Web (Baileys)                      │
└─────────────────────────────────────────────────────────┘
```

### API Contracts

| Frontend → Backend | Backend → Sidecar | Sidecar → WhatsApp |
|---|---|---|
| `POST /wa/connect` | `POST /connect` | QR code / pairing code |
| `GET /wa/qr/{id}` | `GET /qr/{id}` | QR image |
| `GET /wa/status/{id}` | `GET /status/{id}` | Connected/disconnected |
| `POST /wa/disconnect/{id}` | `POST /disconnect/{id}` | Session closed |
| `POST /wa/parse` | `POST /parse-groups` | Group participants |

### Contacts (cross-platform)

- `POST /contacts/check-platforms` — check TG/VK/WA/Viber by phone
- `POST /contacts/refresh-platforms` — refresh platform status
- `GET /contacts` — list with filters

## 2. WhatsApp Authorization (3 Methods)

### Method 1: QR Code

```
1. Frontend: POST /wa/connect { phone_number, method: "qr" }
2. Backend: save account, call sidecar
3. Sidecar: Baileys generates QR
4. Frontend: GET /wa/qr/{id} → show QR
5. User scans with phone
6. Sidecar: webhook → Backend: account connected
7. Frontend: poll GET /wa/status/{id} → "connected"
```

- QR expires in ~20 seconds. Auto-refresh every 15 seconds.
- Show countdown timer.

### Method 2: Pairing Code (Phone + Code)

```
1. Frontend: POST /wa/connect { phone_number, method: "pairing" }
2. Sidecar: Baileys requestPairingCode(phone)
3. Backend: GET /wa/pairing-code/{id} → "123-456"
4. Frontend: show code to user
5. User enters code in WhatsApp on phone
6. Sidecar: webhook → Backend: account connected
```

- WhatsApp gives 2 minutes to enter code. Show countdown.
- Code is 8 digits: `XXX-XXXX`.

### Method 3: Existing Session

```
1. Frontend: POST /wa/connect { phone_number, method: "existing" }
2. Sidecar: check if saved session exists
3. If yes → restore without QR
4. If no → fallback to QR
```

- Baileys multi-device sessions stored in `creds.json`
- If session expired (30 days inactive) → auto-fallback to QR

### Account Lifecycle

```
disconnected → connecting → connected → error
                  ↑            │
                  └────────────┘ (reconnect)
```

### Rate Limits

- QR requests: 5/min
- Pairing code: 3/hour
- Reconnect: 3/5min

### Error Handling

- "Invalid code" — wrong pairing code
- "Session expired" — need re-auth
- "Number blocked" — WhatsApp banned
- Handle push confirmation status (WhatsApp requires phone approval)

## 3. Contacts (Central Table)

### Contact Structure

```json
{
  "id": "uuid",
  "phone": "+79001234567",
  "name": "Иван",
  "country": "RU",
  "source_group": "SAAS Founders",
  "platforms": {
    "telegram": { "exists": true, "username": "@ivan", "last_seen": "2026-09-15" },
    "vkontakte": { "exists": false },
    "whatsapp": { "exists": true, "last_seen": "2026-09-18" },
    "viber": { "exists": false }
  },
  "tags": ["SAAS", "Москва", "Активный"],
  "last_mailing": { "date": "2026-09-17", "platform": "vk", "message": "..." },
  "quality_score": 85,
  "created_at": "2026-09-10"
}
```

### Table (Desktop)

| Телефон | Имя | Страна | TG | VK | WA | Viber | Последнее сообщение | Качество |
|---|---|---|---|---|---|---|---|---|
| +79001234567 | Иван | RU | ✓ | ✗ | ✓ | ✗ | 17.09 VK | 85% |

Mobile: card layout.

### Filters

- Phone (text)
- Country (dropdown: RU, UA, KZ, ALL)
- Platform (TG/VK/WA/Viber)
- Tags (multiple select)
- Quality (high/medium/low)

### Auto-Tags

From group name:
- `SAAS Founders Moscow` → `Тема: SAAS`, `Город: Москва`
- `Crypto English` → `Тема: Крипто`, `Язык: Английский`

From activity:
- `Активный`, `Неактивный`, `Давно не был онлайн`

From responses:
- `Ответил`, `Не отвечал`, `Заблокировал`

## 4. WA Overview (Dashboard)

### Stat Cards

```
┌──────────┬──────────┬──────────┬──────────┐
│ Аккаунты │ Группы   │ Контакты │ Охват    │
│ 3 / 5    │ 12       │ 1,234    │ 45,678   │
│ (active) │ (parsed) │ (total)  │ (reach)  │
└──────────┴──────────┴──────────┴──────────┘
┌──────────┬──────────┬──────────┬──────────┐
│ Отправлен│ Доставлен│ Прочитан │ Ответы   │
│ 1,234    │ 1,100    │ 890      │ 123      │
│ (today)  │ (89%)    │ (72%)    │ (10%)    │
└──────────┴──────────┴──────────┴──────────┘
```

### Charts

- Send/delivery/read dynamics by day
- Platform effectiveness (VK vs TG vs WA)
- Top groups by conversion

### Mailing History

| Дата | Рассылка | Платформа | Получателей | Доставлено | Прочитано | Ответы |
|---|---|---|---|---|---|---|
| 18.09 | Promo #5 | WA | 500 | 480 | 350 | 45 |

### Contact Quality

- Distribution by quality (high/medium/low)
- Top contacts by activity

## 5. WA Groups (Parsing)

### Form

```
┌─────────────────────────────────────────────┐
│ Ссылки на группы (по одной на строку):      │
│ https://chat.whatsapp.com/ABC123            │
│ https://chat.whatsapp.com/DEF456            │
├─────────────────────────────────────────────┤
│ Аккаунт: [Dropdown: +79001234567 ✓]        │
│ Теги: [SAAS, Москва]                        │
├─────────────────────────────────────────────┤
│ [Парсить участников]                        │
└─────────────────────────────────────────────┘
```

### After Parsing

- List of found contacts
- Auto-tags from group name
- "Add to database" button
- Stats: how many new, how many duplicates

### Anti-Ban

- 5 groups/hour
- 30 groups/day
- 15-45 sec delay between groups

## 6. Campaigns (Per-Platform)

Each platform has own campaigns:
- `/campaigns` — TG campaigns
- `/vk-campaigns` — VK campaigns
- `/wa-campaigns` — WA campaigns

### Platform Priority (Configurable)

Default: VK → TG → WA → Viber
Settings: [⬆️ VK] [⬆️ TG] [⬇️ WA] [⬇️ Viber]

### Sending Logic

1. Take contacts from campaign
2. For each contact: check platforms by priority
3. Send through first available
4. Log: "sent via VK 18.09 14:30"

### Tariff Limits

| Тариф | Аккаунты WA | Сообщений/день |
|---|---|---|
| Free | 0 | 0 |
| Start | 2 | 100 |
| Pro | 5 | 1,000 |
| Enterprise | ∞ | ∞ |

## 7. Security & Reliability

- QR code not stored in localStorage
- Sessions encrypted on disk
- Circuit breaker for sidecar (fallback on failure)
- Audit log for all actions
- Rate limiting on API
- Session persistence (Baileys creds.json in wa_sessions volume)
- Webhook from sidecar on status change (not just polling)
- Inactive contact marking (>3 months)
- Deduplication by phone on import
- CSV import (manual contact entry)
- Account inactivity marking (>1 month offline)

## 8. Statistics (Comprehensive)

### Metrics Tracked

1. **Delivery** — sent, delivered, read, errors
2. **Responses** — who replied, through which platform
3. **Response time** — how quickly people respond
4. **Optimal send time** — when people read most
5. **Cost per reach** — which platform is cheapest
6. **Platform effectiveness** — delivery rate by platform
7. **Group performance** — which groups give best contacts
8. **Contact quality score** — composite based on activity, responses, platforms
9. **Churn** — who unsubscribed / blocked

### Tracking Implementation

- Event logging to `mailing_events` table
- Aggregation queries for dashboard
- Background worker for quality score calculation

## 9. Technical Feasibility (Audit 1)

### Baileys Version
- Use `@whiskeysockets/baileys@6.7.24` (stable)
- 7.0.0-rc14 has breaking changes — avoid

### Key APIs
- `requestPairingCode(phone)` — pairing code auth (printQRInTerminal: false required)
- `connection.update` event — QR code as string, convert via `qrcode` npm
- `useMultiFileAuthState('folder')` — session persistence
- `groupAcceptInvite(code)` — join group via invite link
- `groupGetInviteInfo(code)` — get group info WITHOUT joining
- `groupMetadata(jid)` — get participants
- `onWhatsApp(jid)` — check if number exists on WhatsApp
- `sock.ev.process()` — batch event processing

### Production Requirements
- **`cachedGroupMetadata`** — MANDATORY for group messaging (avoids 429)
- **Database-backed auth state** — replace `useMultiFileAuthState` for production
- **`makeCacheableSignalKeyStore`** — 5-minute TTL cache for Signal keys

### WhatsApp Rate Limits (Observed)
- ~20 unique recipients/day before flagging
- ~15-20 messages to non-saved contacts/day
- ~3.5 seconds minimum between sends
- Group burst triggers 429 without caching

## 10. UX/Flow Fixes (Audit 2)

### Flow 1: Account Connection
- Add method selection UI (QR / Pairing / Existing)
- Add QR countdown timer (15s refresh)
- Add redirect to WA Accounts after successful connect
- Add fallback: QR expired → auto-refresh + "Try again" button

### Flow 2: Group Parsing
- Add progress bar (real-time via WebSocket)
- Add account connection check before parse start
- Add cancel button for long-running parses
- Add timeout handling (30s per group)

### Flow 3: Cross-Platform Check
- Add timeout per contact (10s)
- Add retry button per contact
- Add bulk update (select all → refresh)
- Add progress indicator for bulk operations

### Flow 4: Campaign Sending
- Add preview: "Кому отправим через какую платформу"
- Add dry-run mode (test send to 5 contacts)
- Add cancel button (abort after start)
- Add confirmation dialog before send

### Flow 5: Platform Refresh
- Add bulk update (checkboxes → "Обновить выбранные")
- Add progress indicator
- Add partial refresh (skip contacts checked < 1 hour ago)

## 11. Security & Edge Cases (Audit 3)

### Race Conditions
1. **Dual connect** — two users connect same WA number → lock account during connect, reject second request
2. **Parse + Send contention** — parsing group while sending to it → queue operations per account
3. **Platform refresh + send** — contact becomes unavailable during send → retry next platform

### Data Loss Prevention
4. **Sidecar crash during parse** — wrap in transaction, commit on success only
5. **Backend crash during send** — idempotency keys, log before send
6. **Duplicate contacts** — upsert by normalized phone (always E.164 format)

### Abuse Prevention
7. **Invalid group links** — validate URL format before sidecar call
8. **Spam parsing** — rate limit: 5 groups/hour, 30 groups/day
9. **XSS in group names** — sanitize all user input before display

### Error Handling
10. **Sidecar timeout** — 30s timeout, return "Service unavailable" (not infinite spinner)
11. **QR generation failed** — show specific error, offer retry
12. **Session kicked** — auto-reconnect with exponential backoff

### Data Integrity
13. **Stale platform data** — refresh intervals: daily auto + manual on demand
14. **Phone format normalization** — always store E.164 (`+79001234567`)
15. **Timezone** — store all timestamps as UTC, convert in UI

### Concurrency
16. **Multiple sidecar instances** — single sidecar only (no horizontal scaling for WA)
17. **Multiple workers** — Redis-based distributed lock per account

## 12. UX Improvements (from audits)

### QR Code Flow
```
┌─────────────────────────────────────┐
│  Выберите способ подключения:       │
│  ○ QR-код (сканировать телефоном)   │
│  ○ Код парирования (ввести на PHONE)│
│  ○ Существующая сессия              │
├─────────────────────────────────────┤
│  [Подключить]                       │
└─────────────────────────────────────┘
```

### QR Display with Timer
```
┌─────────────────────────────────────┐
│  Сканируйте QR-код:                 │
│  ┌─────────────┐                    │
│  │  QR IMAGE   │  Обновится через:  │
│  │             │       12 сек       │
│  └─────────────┘                    │
├─────────────────────────────────────┤
│  [Отмена]                           │
└─────────────────────────────────────┘
```

### Group Parse Progress
```
┌─────────────────────────────────────┐
│  Парсинг групп...                   │
│  ████████████░░░░░░░░  2/5 групп    │
│                                     │
│  ✓ SAAS Founders — 150 участников   │
│  ✓ Crypto Moscow — 89 участников    │
│  ⏳ Parsing next group...           │
└─────────────────────────────────────┘
```

### Campaign Preview
```
┌─────────────────────────────────────┐
│  Preview рассылки:                  │
│  Всего контактов: 500               │
│  ─────────────────────────────      │
│  VK: 320 (64%)                      │
│  TG: 120 (24%)                      │
│  WA: 60 (12%)                       │
│  ─────────────────────────────      │
│  [Тест отправки 5] [Отправить]      │
└─────────────────────────────────────┘
```

## 13. Improvements (consolidated)

1. **Retry logic for sidecar** — health-check + circuit breaker
2. **Rate limiting on sidecar** — Baileys account protection
3. **Session persistence** — Baileys sessions on disk (wa_sessions volume)
4. **Webhook from sidecar** — status change notifications
5. **Inactive contact marking** — >3 months = "stale"
6. **Deduplication** — upsert by phone on import
7. **CSV import** — manual contact entry
8. **Account limits per tariff** — Free=0, Start=2, Pro=5, Enterprise=∞
9. **Audit logging** — all actions logged
10. **QR security** — in-memory only, no localStorage
11. **cachedGroupMetadata** — mandatory for group messaging
12. **Database-backed auth state** — production session storage
13. **Phone normalization** — always E.164 format
14. **Bulk operations** — batch refresh, batch delete
15. **Progress indicators** — all long-running operations
16. **Dry-run mode** — test sends before real campaign
17. **Idempotency keys** — prevent duplicate sends
18. **Single sidecar** — no horizontal scaling for WA
19. **Distributed lock** — Redis-based per-account locking
20. **Timeout handling** — 30s max for sidecar calls
