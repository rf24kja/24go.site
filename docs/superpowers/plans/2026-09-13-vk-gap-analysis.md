# VK Lead Generation Platform — Gap Analysis & Priority Fixes

> **Goal:** Identify and fix the functional gaps preventing VK from working end-to-end.

## Executive Summary

The VK integration is **substantially built**. Backend endpoints, workers, frontend UI, and database schema all exist. The main gaps are in wiring, edge cases, and missing VK-specific status checks. Below are the prioritized gaps.

---

## 1. VK End-to-End Flow Status

### Connect VK Account ✅ DONE
- Frontend: `accounts/page.tsx:492-497` — VK Connect modal, token + group_id input
- Backend: `accounts.py:1112-1204` — `/connect-vk` validates token via `vk_api`, stores encrypted, auto-dispatches listener
- Worker: `vk_listener.py` — starts on connect
- **Gap:** None. This is fully wired.

### Add VK Group to Monitor ⚠️ PARTIAL
- Frontend: `groups/page.tsx` — supports VK groups in add form (identifier input)
- Backend: `groups.py:136-244` — `add_group` handles both platforms
- **Gap:** When platform=vk, the backend doesn't fetch VK group info (title, members_count). It only does this for Telegram (lines 179-214). VK groups will have `title=None, members_count=0`.

### Start Group Scanner ✅ DONE
- Frontend: `groups/page.tsx:571` — start/stop buttons work for all platforms
- Backend: `groups.py` start endpoint dispatches `vk_group_scanner.start_vk_group_scanner`
- Worker: `vk_group_scanner.py` — handles VK Groups LongPoll events
- **Gap:** None.

### Post to VK Wall ✅ DONE
- Frontend: `campaigns/page.tsx` — create/edit campaigns, run button
- Backend: `campaigns.py` `run_campaign` dispatches `vk_poster.post_to_vk` when platform=vkontakte
- Worker: `vk_poster.py` — spintax rendering, anti-ban, wall.post
- **Gap:** None.

### Receive VK Message ✅ DONE
- Frontend: `leads/page.tsx` — shows VK leads (platform filter works)
- Backend: `leads.py` — returns leads with platform=vkontakte
- Worker: `vk_listener.py` — Groups LongPoll, type 4 events → lead pipeline
- **Gap:** None.

### Scrape VK Comments ✅ DONE
- Frontend: `targets/page.tsx:525` — scrape comments button, post list modal
- Backend: `targets.py:316+` — `/scrape-comments` dispatches `vk_comment_scraper.scrape_vk_comments`
- Worker: `vk_comment_scraper.py` — fetches comments, thread replies, classifies
- **Gap:** None.

---

## 2. Missing VK Functionality (vs Telegram)

### 2a. VK Status Display in Accounts Table ⚠️ GAP
- **Telegram:** Has `tg-status` endpoint, shows online/offline indicator per account
- **VK:** No equivalent `vk-status` endpoint. The frontend only fetches TG statuses (`getTelegramStatus`). VK accounts show no connection status indicator.
- **Impact:** Users can't tell if VK accounts are connected/working.
- **Fix:** Add `GET /accounts/{id}/vk-status` endpoint (read `vk_status:{id}` from Redis) + frontend fetch + display.

### 2b. VK Account Disconnect/Reconnect ⚠️ GAP
- **Telegram:** Full disconnect/reconnect flow (disconnect removes session, reconnect restarts listener)
- **VK:** No disconnect endpoint for VK. The "reconnect" button on VK accounts calls `deleteTelegram` (wrong endpoint). The "reconnect" button calls `reconnectTelegram` (also wrong).
- **Impact:** Users can't cleanly disconnect or reconnect VK accounts.
- **Fix:** Add `POST /accounts/{id}/disconnect-vk` and `POST /accounts/{id}/reconnect-vk` endpoints. Update frontend action buttons for VK accounts.

### 2c. VK Group Title Fetch on Add ⚠️ GAP
- **Telegram:** Fetches group title + member count via Telethon on add
- **VK:** Doesn't fetch group info on add. Groups show identifier only.
- **Fix:** In `groups.py:add_group`, when platform=vk, use `vk_api` to fetch group info.

### 2d. VK Membership Check ⚠️ GAP
- **Telegram:** `check-membership` endpoint uses Telethon to verify
- **VK:** No VK membership check implementation. The endpoint only works for Telegram.
- **Impact:** VK targets always show "not joined".
- **Fix:** Add VK branch to `check_membership` endpoint using VK API `groups.isMember`.

### 2e. VK Join Group ⚠️ GAP
- **Telegram:** `join_target` endpoint joins groups via Telethon
- **VK:** No VK join implementation.
- **Fix:** Add VK branch to `join_target` using VK API `groups.join`.

### 2f. VK Listener Start/Stop via UI ⚠️ GAP
- **Telegram:** Listeners page has start/stop buttons that dispatch Celery tasks
- **VK:** The listeners endpoint only dispatches `app.tasks.listener.start_lead_listener` (Telegram). No `start_vk_listener` dispatch from the listeners page.
- **Impact:** VK listeners can only be started via connect-vk, not from the listeners page.
- **Fix:** Add VK branch to `listeners.py:start_listener` that dispatches `app.tasks.vk_listener.start_vk_listener`.

### 2g. VK Health Check ⚠️ GAP
- **Telegram:** `vk_health_check.py` exists but doesn't appear wired to any scheduler or API.
- **Fix:** Add periodic task dispatch + API endpoint to check VK account health.

---

## 3. Backend Endpoint Coverage

All frontend API calls have corresponding backend endpoints. No orphan endpoints found.

Frontend `bulkImportVkAccounts` calls `/accounts/bulk-import-vk` → exists ✅
Frontend `getVkOverview` calls `/analytics/vk-overview` → exists ✅
Frontend `connectVK` calls `/accounts/{id}/connect-vk` → exists ✅

---

## 4. Database Schema ✅ DONE

- `account_pool.platform` supports `'vkontakte'` enum value ✅
- `account_sessions` stores encrypted VK tokens ✅
- `monitored_groups.platform` supports vkontakte ✅
- `targets.platform` supports vkontakte ✅
- `leads.platform` supports vkontakte ✅

---

## 5. Configuration ✅ DONE

- `VK_SERVICE_TOKEN` and `VK_GROUP_TOKEN` are in `config.py:36-37` ✅
- `vk_api` library is used for token validation ✅
- `VK_MIN_DELAY` / `VK_MAX_DELAY` are handled in `vk_client.py` anti-ban logic ✅

---

## Prioritized Fix List

### P0 — Must fix for VK to work end-to-end

| # | Gap | Files | Effort |
|---|-----|-------|--------|
| 1 | VK status display (missing vk-status endpoint) | `backend/app/routers/accounts.py`, `dashboard/src/lib/api.ts`, `dashboard/src/app/(dashboard)/accounts/page.tsx` | Small |
| 2 | VK disconnect endpoint | `backend/app/routers/accounts.py`, `dashboard/src/app/(dashboard)/accounts/page.tsx` | Small |
| 3 | VK reconnect endpoint (correct Celery task dispatch) | `backend/app/routers/accounts.py`, `dashboard/src/app/(dashboard)/accounts/page.tsx` | Small |
| 4 | VK listener start/stop from listeners page | `backend/app/routers/listeners.py` | Small |

### P1 — Important for full feature parity

| # | Gap | Files | Effort |
|---|-----|-------|--------|
| 5 | VK group info fetch on add (title + members_count) | `backend/app/routers/groups.py` | Small |
| 6 | VK membership check | `backend/app/routers/targets.py` | Medium |
| 7 | VK join group | `backend/app/routers/targets.py` | Medium |

### P2 — Nice to have

| # | Gap | Files | Effort |
|---|-----|-------|--------|
| 8 | VK health check wiring | `backend/app/routers/accounts.py`, `services/worker/app/tasks/vk_health_check.py` | Small |
| 9 | VK auto-reply (if needed) | Worker | Medium |

---

## Quick Wins (< 1 hour each)

1. **VK status endpoint:** Copy tg-status pattern, read `vk_status:{id}` from Redis
2. **VK disconnect:** Copy disconnect_telegram, delete VK session, revoke VK listener task
3. **VK reconnect:** Fix to dispatch `vk_listener.start_vk_listener` instead of TG listener
4. **VK group info on add:** Use `vk_api.groups.getById()` in add_group when platform=vk
