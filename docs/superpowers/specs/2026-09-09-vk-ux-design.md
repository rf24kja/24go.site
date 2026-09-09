# VK Interface Improvements — Design Spec

**Date:** 2026-09-09
**Status:** Approved
**Scope:** VK Dashboard Overview, Account Health Visualization, Settings Fixes

## 1. VK Overview Page (`/vk-overview`)

New page landing when platform=vk. Sidebar replaces "Analytics (VK)" with "VK Overview".

### Layout

**Summary Cards (top row):**
- Total Leads (30d)
- Hot Leads (HOT intent, 30d)
- Active Accounts (active status / total)
- Conversion Rate (converted / total leads)

**Lead Funnel:**
Horizontal bar chart showing conversion drop-off:
1. Comments scraped → 2. Leads created → 3. Qualified (HOT+WARM) → 4. Contacted → 5. Converted

Each bar shows count + percentage of previous step. Animated fill on load.

**Account Health Cards:**
One card per VK account. Each card shows:
- Community name + member count
- Warmup progress bar (4 segments, animated fill)
- Stage label: "Stage 3/4 → Full in ~8h"
- Actions today / daily limit (mini progress bar)
- Actions this hour / hourly limit
- Proxy status (green check / amber warning / red cross)
- Last action timestamp + type
- Last error or flood wait (if recent, with warning styling)

**Activity Timeline:**
Last 10 VK actions, chronological. Each entry:
- Timestamp (relative: "2min ago")
- Icon (📝 post, 💬 comment, ✉️ DM, 🔥 warmup, ⚠️ error)
- Description with community name
- "View All →" link to audit log

**Community Performance Table:**
Columns: Community | Total Leads | Hot % | Engagement Rate | Status
Sorted by lead count descending.

**Quick Actions:**
3 contextual buttons:
- "Scrape [top community]" → targets page filtered
- "Post to Wall" → campaigns page
- "DM [N] new leads" → mailings page with pre-filled recipients

### Backend

New endpoint: `GET /api/v1/vk/overview`
Returns: summary stats, account health, activity timeline, community performance.
Query params: `days` (default 30).

### Animations

- Summary cards: fade-in with stagger (100ms delay between cards)
- Progress bars: animated fill from 0 to value (600ms ease-out)
- Activity timeline: items slide in from left with stagger
- Hover on account cards: subtle lift (translateY(-2px)) + shadow
- Action buttons: press animation (scale 0.97 on click)
- Data load: skeleton shimmer → content fade-in

---

## 2. Account Health Visualization (Accounts Page)

Enhance VK account cards on `/accounts`.

### Per-Account Card Layout

```
[Status Indicator] Community Name (@handle)     Member Count
Status: [badge]    Warmup: Stage N/4
[Progress bar — 4 segments, animated]
Actions Today: N/M  [mini bar]   Actions Hour: N/M  [mini bar]
Proxy: [status]    Last Action: [time] ([type])
[Error banner if recent flood/ban]
[Action buttons row]
```

### Status Badge Colors
- active (stage 4): emerald
- warming_up (stage 1-3): amber with pulse
- cooldown: orange
- banned: rose
- paused: slate

### Warmup Progress Bar
- 4 equal segments
- Filled segments = current stage
- Color: amber for stages 1-3, emerald for stage 4
- Animated fill on mount (CSS transition)
- Below bar: "Stage N/4 → Full in ~Xh" (estimated time based on stage advance rate)

### Actions Budget
- Two mini progress bars: daily + hourly
- Green when < 70%, amber when 70-90%, red when > 90%
- Label: "12/30 today"

### Animations
- Card hover: translateY(-2px), box-shadow increase
- Progress bars: animated width transition
- Status badge: pulse animation on warming_up
- Error banner: slide-in from top with shake on flood wait

---

## 3. Settings Fixes

### 3a. Bulk Import → Actual Account Creation

**Current:** Saves JSON text to `settings.vk.bulk_accounts`. Never creates accounts.

**Fix:** New backend endpoint `POST /api/v1/accounts/bulk-import-vk`

Request: `{ accounts: [{ group_id: number, token: string }] }`

For each account:
1. Validate token via `vk_api.groups.getById()`
2. Verify group_id matches
3. Create `AccountPool` entry with `platform='vkontakte'`, `account_identifier=group_id`
4. Store encrypted token in `account_sessions`
5. Return results: `{ imported: N, failed: N, errors: [...] }`

Frontend: Replace "Parse & Preview" with actual import button. Show results inline.

### 3b. Proxy Wiring

**Current:** VK settings page saves `proxy_list` to `tenant_settings.vk.proxy_list`. VK client reads `VK_PROXY_URL` env var.

**Fix:**
1. Backend: `connect-vk` endpoint reads proxy from `tenant_settings.vk.proxy_list` and stores proxy_url in `account_sessions` alongside token
2. Worker: `get_vk_group_session_for()` reads proxy from `account_sessions` and passes to `vk_api.VkApi(proxy=...)`
3. Account rotation: round-robin proxy assignment from the pool

### 3c. VK Help Icons

Replace all `lucide-react` imports in `vk-help/page.tsx` with custom `Icons.tsx` components:
- `BookOpen` → `FileText`
- `Users` → `UsersGroup`
- `Search` → `Radar`
- `Eye` → `Crosshair`
- `Send` → `Send` (already in Icons)
- `UserCheck` → `UserCircle`
- `Filter` → `Scales`
- `Megaphone` → `Megaphone` (already in Icons)
- `CreditCard` → `CreditCard` (already in Icons)
- `UserCog` → `Cog`
- `Lightbulb` → `Zap`
- `AlertTriangle` → `Shield`
- `ArrowRight` → keep as SVG inline
- `Menu` → `Menu` (already in Icons)
- `X` → `Cross` (already in Icons)
- `MessageSquare` → `Send`
- `Shield` → `Shield` (already in Icons)
- `Settings` → `Cog` (already in Icons)
- `Globe` → `ExternalLink`

### 4d. Settings Page — Hide TG Sections in VK Mode

In `settings/page.tsx`, filter sections based on platform:
- `tgstat` → hide when platform=vk
- `webhooks` → hide when platform=vk (n8n is TG-specific)
- All other sections remain visible

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/app/(dashboard)/vk-overview/page.tsx` | **CREATE** — VK Overview page |
| `src/components/Sidebar.tsx` | **MODIFY** — Add VK Overview link, replace Analytics (VK) |
| `src/app/(dashboard)/accounts/page.tsx` | **MODIFY** — Enhanced account cards with health viz |
| `src/app/(dashboard)/settings/page.tsx` | **MODIFY** — Hide TG sections in VK mode |
| `src/app/(dashboard)/vk-help/page.tsx` | **MODIFY** — Replace lucide-react with Icons.tsx |
| `src/lib/api.ts` | **MODIFY** — Add `getVkOverview()` function |
| `services/backend/app/routers/accounts.py` | **MODIFY** — Add bulk-import-vk endpoint |
| `services/worker/app/vk_client.py` | **MODIFY** — Read proxy from DB session |

---

## Animation Specifications

### CSS Classes (add to globals.css)

```css
/* Stagger children animation */
.stagger-children > * {
  opacity: 0;
  transform: translateY(8px);
  animation: stagger-in 0.3s ease-out forwards;
}
.stagger-children > *:nth-child(1) { animation-delay: 0ms; }
.stagger-children > *:nth-child(2) { animation-delay: 80ms; }
.stagger-children > *:nth-child(3) { animation-delay: 160ms; }
.stagger-children > *:nth-child(4) { animation-delay: 240ms; }

@keyframes stagger-in {
  to { opacity: 1; transform: translateY(0); }
}

/* Progress bar fill animation */
.progress-fill {
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

/* Card hover lift */
.card-hover {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.card-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.3);
}

/* Button press */
.btn-press:active {
  transform: scale(0.97);
}

/* Status pulse */
@keyframes status-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
.status-pulse { animation: status-pulse 2s ease-in-out infinite; }

/* Slide in from left */
@keyframes slide-in-left {
  from { opacity: 0; transform: translateX(-12px); }
  to { opacity: 1; transform: translateX(0); }
}
.slide-in-left { animation: slide-in-left 0.3s ease-out forwards; }

/* Error shake */
@keyframes error-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
.error-shake { animation: error-shake 0.3s ease-in-out; }
```

### Transition Patterns

| Element | Trigger | Animation |
|---------|---------|-----------|
| Summary cards | Page load | Stagger fade-in (80ms delay) |
| Progress bars | Data load | Width transition 0.6s ease-out |
| Account cards | Hover | translateY(-2px) + shadow |
| Status badge | warming_up | Pulse 2s infinite |
| Action buttons | Click | Scale 0.97 (100ms) |
| Activity items | Page load | Slide-in-left stagger |
| Error banner | Appears | Slide-down + shake |
| Toast | Appears | Slide-in from right |
