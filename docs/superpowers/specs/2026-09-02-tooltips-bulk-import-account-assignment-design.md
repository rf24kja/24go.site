# Design: Tooltips, Bulk Group Import, Smart Account Assignment

## Overview
Three related features for the 24GO dashboard:
1. FieldHint tooltips on remaining form fields
2. Mass group import with backend endpoint
3. Smart account assignment with ratio info card

## 1. Tooltips (FieldHint)

**Already done:** Campaigns, Groups, Targets, Settings pages already use FieldHint on most fields.

**Remaining pages:**
- **Scoring** (`scoring/page.tsx`): Add FieldHint to rule name, intent, keywords, min confidence, priority fields
- **Mailings** (`mailings/page.tsx`): Add FieldHint to mailing name, message text, platform, delay, recipients file
- **Billing** (`billing/page.tsx`): Add tooltips to plan feature lists (plan limits as tooltips on each card)

**Implementation:** Use existing `FieldHint` component (no changes needed). Add `FieldHint` imports where missing, wrap labels with `<>{label} <FieldHint hint={t("hints.xxx")} /></>`.

**i18n:** Add `hints.scoring.*`, `hints.mailings.*`, `hints.billing.*` keys to en.json and ru.json.

## 2. Mass Group Import

### Backend (`services/backend/app/routers/groups.py`)
- New endpoint: `POST /api/v1/groups/bulk-import`
- Request body: `{ groups: [{ group_identifier: string, platform: string }] }`
- Logic: iterate, create `MonitoredGroup` records, auto-assign least-loaded account
- Response: `{ imported: N, skipped: N, errors: [...] }`
- Reuse existing `GroupCreateRequest` validation logic

### Frontend (`groups/page.tsx`)
- "Bulk Import" button next to "Add Group"
- Modal with textarea (one group per line: `@groupname` or `https://t.me/groupname`)
- Parse input, extract usernames, detect platform
- Preview list before import
- Show results after import

### API client (`lib/api.ts`)
- Add `bulkImportGroups(token, groups[])` function

## 3. Smart Account Assignment

### Backend auto-assign (`groups.py`)
- In `add_group` endpoint: if no `account_id` provided, query least-loaded active account
- SQL: `SELECT account_id, COUNT(*) as group_count FROM monitored_groups WHERE tenant_id=X AND is_active=true GROUP BY account_id ORDER BY group_count ASC LIMIT 1`
- Set `account_id` on the new group

### Frontend info card (`groups/page.tsx`)
- Banner at top showing account-to-group ratio
- Fetch accounts count and groups count
- Color-coded: green (>20 groups/account), yellow (10-20), red (<10)
- Link to Accounts page

### Frontend table update (`groups/page.tsx`)
- Add "Account" column showing assigned account identifier
- Show account status badge

## 4. i18n

Add all new strings to both `en.json` and `ru.json`:
- `hints.scoring.*` — rule name, intent, keywords, confidence, priority
- `hints.mailings.*` — name, message, platform, delay, recipients
- `hints.billing.*` — plan feature tooltips
- `groups.bulkImport` — button text
- `groups.bulkImportTitle` — modal title
- `groups.bulkImportHint` — textarea placeholder
- `groups.bulkImportPreview` — preview header
- `groups.bulkImportResult` — result message
- `groups.accountRatio` — info card title
- `groups.accountRatioDesc` — description
- `groups.accountsCount` — accounts count
- `groups.groupsCount` — groups count
- `groups.recommended` — recommended accounts
- `groups.addMoreAccounts` — link text
- `groups.colAccount` — table column header

## Files Changed

1. `services/dashboard/src/app/(dashboard)/scoring/page.tsx` — add FieldHint
2. `services/dashboard/src/app/(dashboard)/mailings/page.tsx` — add FieldHint
3. `services/dashboard/src/app/(dashboard)/billing/page.tsx` — add FieldHint to plan cards
4. `services/dashboard/src/app/(dashboard)/groups/page.tsx` — bulk import modal, info card, account column
5. `services/dashboard/src/lib/api.ts` — bulkImportGroups function
6. `services/dashboard/src/lib/en.json` — new hint keys + groups import/assignment keys
7. `services/dashboard/src/lib/ru.json` — new hint keys + groups import/assignment keys
8. `services/backend/app/routers/groups.py` — bulk-import endpoint + auto-assign logic
