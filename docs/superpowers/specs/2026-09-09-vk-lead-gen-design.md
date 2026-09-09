# VK Lead Generation Section — Design Spec

**Date:** 2026-09-09
**Status:** Approved
**Scope:** Full VK dashboard section + anti-ban system + bulk operations

---

## 1. Goal

Add a complete VKontakte lead generation section to the dashboard. When the user clicks "VKontakte" in the sidebar platform toggle, the entire dashboard switches to VK mode — showing VK-specific pages, VK-filtered data, and VK settings. Includes anti-ban system with account rotation, rate limiting, and bulk operations.

## 2. Architecture

### 2.1 Platform Context (React)

New context provider wrapping the dashboard:

```
PlatformProvider
├── platform: "telegram" | "vkontakte"
├── setPlatform(platform)
└── Persists to localStorage
```

All pages read `usePlatform()` to filter data by platform. API requests include `?platform=vkontakte` query param.

### 2.2 Sidebar Navigation

When VK is selected, nav items change:

| Telegram | VK Equivalent |
|----------|---------------|
| Analytics | Analytics (VK) |
| Leads | Leads (VK) |
| Lead Rules | Lead Rules |
| Group Search | Group Search (VK) |
| Monitoring | Monitoring (VK) |
| Accounts | VK Communities |
| Proxies | Proxies |
| Campaigns | VK Campaigns |
| Mailings | VK Mailings |
| Blog Admin | Blog Admin |
| Billing | Billing |
| Team | Team |
| Audit | Audit |
| Health | Health |
| Help | Help |
| Settings | VK Settings |

### 2.3 Anti-Ban System

**RateLimiter** (per-account, token bucket):
- `max_actions_per_hour`: 30 (configurable)
- `max_actions_per_day`: 300 (configurable)
- `min_delay`: 15-45s random between actions
- `cooldown_after_batch`: 5-10 min after 10 actions
- `flood_wait_autoretry`: sleep for required time, then retry

**AccountRotation**:
- Pool of active accounts, round-robin selection
- Banned accounts → auto-skip + 24h cooldown
- New accounts → warmup stages (3 days: 5/day → 15/day → 30/day)
- Stripe pattern: spread load across accounts evenly

**ProxyRotation**:
- Per-account proxy assignment
- Round-robin or random selection
- Health check: if proxy fails 3x → mark unhealthy, skip

### 2.4 VK Settings Page

Sections:
1. **API Tokens** — Service token, Community tokens (bulk add), App ID/Secret
2. **Rate Limits** — Messages/hour, messages/day, wall posts/day, comments/hour
3. **Proxy Settings** — Bulk import (textarea: one per line), rotation strategy, health check button
4. **Anti-Ban Config** — Delay range, cooldown, warmup stages, flood wait handling
5. **Account Management** — Bulk import (JSON upload), status overview, warmup progress

### 2.5 Tooltips & Help

Every settings field and complex UI element gets:
- `?` icon button (CircleHelp from lucide)
- On hover: tooltip with explanation of what the field does and recommended values
- FieldHint component already exists in codebase — reuse it

## 3. VK-Specific Features

### 3.1 VK Communities (Accounts)

Similar to TG Accounts but:
- Auth via community token (not phone number)
- Bulk import: JSON file with `{"group_id": N, "token": "..."}`
- Status: active / token_expired / restricted / banned
- Show community info: name, members, description

### 3.2 VK Comment Scraping

- Scrape comments from community wall posts
- AI classification (same pipeline as TG)
- Store as leads with `platform="vkontakte"`
- Scheduled scraping (configurable interval)

### 3.3 VK Outreach (DM)

- Send messages to community members
- Bulk import recipient lists
- Template variables: {name}, {community}, etc.
- Account rotation for sending
- Rate limiting per account

### 3.4 VK Posting

- Post to community walls
- Spintax support (same as TG)
- Image attachment support
- Schedule posts
- UTM tracking

### 3.5 VK Auto-Replies

- Reply to incoming community messages
- Keyword-based + AI mode
- Same auto-reply rules engine as TG

### 3.6 VK Analytics

- Community growth chart
- Post engagement (likes, comments, shares)
- Lead conversion funnel
- Source breakdown (which communities generate most leads)

## 4. Database Changes

No new tables needed. Existing tables already have `platform` field:
- `account_pool.platform` — add "vkontakte" values
- `leads.platform` — filter by "vkontakte"
- `monitored_groups.platform` — filter by "vkontakte"
- `campaigns` — same table, filter by platform
- `mailings` — same table, filter by platform

New settings stored in `tenant_settings` JSONB:
```json
{
  "vk": {
    "service_token": "...",
    "community_tokens": ["..."],
    "app_id": "",
    "rate_limits": {
      "messages_per_hour": 30,
      "messages_per_day": 300,
      "posts_per_day": 10,
      "comments_per_hour": 50
    },
    "anti_ban": {
      "min_delay": 15,
      "max_delay": 45,
      "cooldown_minutes": 5,
      "warmup_days": 3
    }
  }
}
```

## 5. Files to Create/Modify

### New Files
- `src/lib/platform.tsx` — PlatformProvider + usePlatform hook
- `src/app/(dashboard)/vk-settings/page.tsx` — VK Settings page
- `src/components/FieldHint.tsx` — Already exists, reuse

### Modified Files
- `src/components/Sidebar.tsx` — Platform toggle wiring + VK nav items
- `src/app/(dashboard)/layout.tsx` — Wrap with PlatformProvider
- `src/app/(dashboard)/accounts/page.tsx` — Platform filter + VK community auth
- `src/app/(dashboard)/groups/page.tsx` — Platform filter
- `src/app/(dashboard)/campaigns/page.tsx` — Platform filter
- `src/app/(dashboard)/leads/page.tsx` — Platform filter
- `src/app/(dashboard)/mailings/page.tsx` — Platform filter
- `src/app/(dashboard)/settings/page.tsx` — Add VK settings section
- `src/lib/api.ts` — Add VK-specific API functions
- `src/lib/en.json` / `src/lib/ru.json` — VK translation keys

## 6. Implementation Order

1. PlatformContext + sidebar wiring
2. VK Settings page
3. Accounts page — VK community auth + bulk import
4. Groups page — VK group filter
5. Campaigns page — VK filter
6. Leads page — VK filter
7. Mailings page — VK filter
8. Anti-ban system (rate limiter, rotation)
9. VK Comment scraper integration
10. VK Outreach integration
11. Tooltips and help icons everywhere
