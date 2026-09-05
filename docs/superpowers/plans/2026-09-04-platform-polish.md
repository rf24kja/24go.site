# 24GO Platform Polish — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement plan task-by-task.

**Goal:** Fix billing limits, auto-reply error, mailings TXT import, expand landing #how with all features, expand help page, add platform switcher placeholder.

**Architecture:** Frontend i18n + backend quota fixes + landing/help page content expansion.

**Tech Stack:** Next.js 14, FastAPI, PostgreSQL, Tailwind CSS, i18n JSON files.

---

## Task 1: Fix Billing Plan Limits

**Files:**
- Modify: `services/backend/app/quota.py:19-44`
- Modify: `services/dashboard/src/lib/en.json:21-42`
- Modify: `services/dashboard/src/lib/ru.json:21-42`

**What to change:**

1. `quota.py` — Update PLAN_LIMITS:
   - Starter: `max_targets: 100` → `50`
   - Pro: `max_targets: 500` → `100`
   - Add `max_leads` key: Starter=500, Pro=5000, Enterprise=999999999

2. `en.json` — Update plan feature strings:
   - Pro accounts: "20 accounts" → "25 accounts"
   - Add leads/mo to each plan's feature list

3. `ru.json` — Same changes in Russian

**Commit:** `fix: update billing plan limits and feature strings`

---

## Task 2: Fix Auto-Replies Schema Mismatch

**Files:**
- Modify: `services/backend/app/schemas.py:281`
- Modify: `services/dashboard/src/lib/en.json` (if auto-reply mode labels need updating)

**What to change:**

1. `schemas.py` line 281 — The `AutoReplyCreate` schema validates mode with pattern `^(keyword|ai|rotation)$` but frontend sends `ai_agent`. Fix:
   ```python
   mode: str = Field(default="keyword", pattern="^(keyword|ai_agent|rotation)$")
   ```

2. Check all backend references to mode value `ai` and update to `ai_agent`:
   - `auto_replies.py` — any filtering by mode value
   - Any worker code that checks auto-reply mode

**Commit:** `fix: align auto-reply mode enum between frontend and backend`

---

## Task 3: Mailings TXT Import Support

**Files:**
- Modify: `services/dashboard/src/app/(dashboard)/mailings/page.tsx:277`
- Modify: `services/dashboard/src/lib/en.json:1134-1135`
- Modify: `services/dashboard/src/lib/ru.json:1134-1135`

**What to change:**

1. `page.tsx` line 277 — Add `.txt` to accepted file types:
   ```tsx
   accept=".csv,.txt,.json"
   ```

2. `en.json` — Update hint text:
   - `"mailings.dropCsv"`: "Drop CSV or TXT file here"
   - `"mailings.csvHint"`: "CSV: username, first_name (optional). TXT: one username per line (without @)"

3. `ru.json` — Same in Russian:
   - `"mailings.dropCsv"`: "Перетащите CSV или TXT файл сюда"
   - `"mailings.csvHint"`: "CSV: username, first_name (необязательно). TXT: один username в строке (без @)"

**Commit:** `feat: support TXT file import for mailing recipients`

---

## Task 4: Expand Landing #how Section

**Files:**
- Modify: `services/dashboard/src/app/page.tsx` — #how section
- Modify: `services/dashboard/src/lib/en.json` — landing.* keys
- Modify: `services/dashboard/src/lib/ru.json` — landing.* keys

**What to change:**

Replace the current 3-step + 6-card #how section with a comprehensive feature showcase. Structure:

### Section 1: "How 24GO Works" (expanded from current 3 steps)
Keep the 3-step flow (Connect → Discover → Convert) but enrich each step with more detail.

### Section 2: "All Platform Features" (NEW — replacing the 6 compact cards)
Organized in a grid of feature cards with icons, each showing:

| Feature | Description |
|---------|-------------|
| Multi-Account Management | Connect unlimited TG accounts with dedicated proxies, auto-warmup, daily quotas |
| Group Monitoring | Real-time scanning of 30+ groups per account, 24/7 lead capture |
| AI Lead Classification | HOT/WARM/COLD scoring with keyword rules + AI models |
| Auto-Replies | Instant response to HOT leads — keyword, AI-agent, or rotation modes |
| Mass Mailings | Personalized bulk messaging with {variables}, anti-spam protection, CSV/TXT import |
| Campaign Publishing | Scheduled post publishing to groups with A/B testing |
| Lead Rules Engine | Custom keyword-based classification with priority and scoring weights |
| Group Discovery | Free search + TgStat integration with AI query expansion |
| Proxy Management | Dedicated SOCKS5 proxies, bulk import, random assignment, health monitoring |
| Analytics Dashboard | Real-time metrics: leads, conversion, campaign performance, AI accuracy |
| CRM Integration | Webhook delivery to HubSpot, Salesforce, AmoCRM + REST API |
| Team Management | Role-based access: Owner, Admin, Member, Viewer |
| Audit Log | Full action tracking with entity filtering and IP logging |
| System Health | API, DB, Redis, WebSocket, Celery worker monitoring |
| Settings & Config | AI models, warmup params, UTM tracking, notifications, n8n integration |

### i18n keys needed:
- `landing.allFeaturesTitle`: "Everything You Need"
- `landing.allFeaturesDesc`: "15+ tools in one platform"
- `landing.feature.{n}Title` / `landing.feature.{n}Desc` for each feature

**Commit:** `feat: expand landing page #how section with all platform features`

---

## Task 5: Expand Help Page with Detailed Sections

**Files:**
- Modify: `services/dashboard/src/app/(dashboard)/help/page.tsx`
- Modify: `services/dashboard/src/lib/en.json` — wiki.* keys
- Modify: `services/dashboard/src/lib/ru.json` — wiki.* keys

**What to change:**

Expand each help section with more detail. Add new sections for features not currently covered.

### Existing sections to expand:
1. **Accounts** — Add account types info (already done), add proxy setup details
2. **Monitoring** — Add expected timelines, performance tips
3. **Mailings** — Add variable list ({first_name}, {username}, {group}), add anti-spam tips
4. **Lead Rules** — Add scoring formula, priority explanation, example rules by industry
5. **Campaigns** — Add A/B testing details, scheduling options

### New sections to add:
6. **Auto-Replies** — New section explaining keyword, AI-agent, rotation modes
7. **Proxies** — New section explaining proxy types, assignment, health monitoring
8. **Settings** — New section explaining AI config, warmup, notifications, n8n

### i18n keys needed:
- `wiki.section.autoReplies.*` — title, forWhat, howTo, expect, tip
- `wiki.section.proxies.*` — title, forWhat, howTo, expect, tip
- `wiki.section.settings.*` — title, forWhat, howTo, expect, tip

**Commit:** `feat: expand help page with detailed sections and new features`

---

## Task 6: Add Platform Switcher Placeholder (VK)

**Files:**
- Modify: `services/dashboard/src/components/Sidebar.tsx`
- Modify: `services/dashboard/src/lib/en.json`
- Modify: `services/dashboard/src/lib/ru.json`

**What to change:**

Add a platform switcher (TG/VK) in the sidebar below the language switcher. For now, VK is disabled with a "Coming soon" tooltip. This is a UI placeholder — no VK functionality yet.

### Changes:
1. `Sidebar.tsx` — Add platform toggle component below language switcher:
   - Two buttons: TG logo + VK logo
   - TG is active (green), VK is disabled (grey) with "Скоро" / "Coming soon" tooltip
   - When VK is selected, show a placeholder message

2. `en.json` — Add keys:
   - `sidebar.platform`: "Platform"
   - `sidebar.platformTg`: "Telegram"
   - `sidebar.platformVk`: "VKontakte"
   - `sidebar.comingSoon`: "Coming soon"

3. `ru.json` — Same in Russian

**Commit:** `feat: add platform switcher placeholder for VK`

---

## Execution Order

1. Task 1 (Billing) — Quick fix, independent
2. Task 2 (Auto-replies schema) — Quick fix, independent
3. Task 3 (Mailings TXT) — Quick fix, independent
4. Task 4 (Landing #how) — Large content task
5. Task 5 (Help page) — Large content task
6. Task 6 (Platform switcher) — Small UI task

Tasks 1-3 can run in parallel. Tasks 4-5 are independent. Task 6 is independent.

---

## Deployment

After all tasks:
1. Git push → Vercel auto-deploys frontend
2. SCP backend changes to VPS → rebuild fastapi container
3. Rebuild dashboard container on VPS (for landing/help changes baked into Docker)
