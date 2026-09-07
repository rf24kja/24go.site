# Free Tools & SEO Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create interactive free tools, integration pages, and tutorials to attract organic traffic from Google/Yandex.

**Architecture:** All pages are server-rendered Next.js pages under `/tools/` and `/integrations/` routes. Public, no auth required. CTA links to registration.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, Lucide icons

## Global Constraints

- Design: dark theme (`bg-zinc-950`, `text-zinc-100`, `emerald-400` accent) — matches existing landing
- i18n: EN/RU toggle on each page via `?locale=en|ru`
- CTA: Every tool ends with "Start free trial" → `/login`
- SEO: `generateMetadata` for each page with title, description, canonical, OG tags
- No external dependencies — pure React + CSS
- Vercel auto-deploy on git push

---

## Task 1: ROI Calculator (`/tools/roi-calculator`)

Interactive calculator: user enters number of accounts, groups, messages/day → gets estimated leads, cost savings, ROI.

**Files:**
- Create: `services/dashboard/src/app/tools/roi-calculator/page.tsx`

**UI:**
- 4 input fields: accounts (1-200), groups (1-500), messages per account per day (5-50), conversion rate (1-20%)
- Real-time calculation as user types
- Results panel: leads/month, cost vs manual, time saved, ROI percentage
- CTA button: "Start generating leads →"
- FAQ section below (5 questions about lead generation ROI)

**Calculation logic:**
```
total_messages = accounts × messages_per_day × 30
leads = total_messages × (conversion_rate / 100)
manual_cost = leads × $2 (manual outreach cost per lead)
our_cost = subscription_price ($75-$499)
savings = manual_cost - our_cost
roi = (savings / our_cost) × 100
```

- [ ] **Step 1: Create the page component**
- [ ] **Step 2: Add generateMetadata for SEO**
- [ ] **Step 3: Add FAQ section with schema.org FAQPage markup**
- [ ] **Step 4: Test build**
- [ ] **Step 5: Commit**

---

## Task 2: Telegram Group Analyzer (`/tools/group-analyzer`)

User enters a Telegram group URL → backend fetches public info (members count, description, recent posts) → displays analysis.

**Files:**
- Create: `services/dashboard/src/app/tools/group-analyzer/page.tsx`
- Modify: `services/backend/app/routers/blog.py` — add public endpoint `/api/v1/tools/analyze-group`

**Flow:**
1. User pastes group URL (e.g., `https://t.me/joinchat/XXX` or `@groupname`)
2. Frontend calls `POST /api/v1/tools/analyze-group` with the URL
3. Backend resolves the group via Telethon (public groups only, no auth needed)
4. Returns: name, description, members_count, is_private, created_date
5. Frontend displays results + CTA

**Backend endpoint:**
```python
@router.post("/analyze-group")
async def analyze_group(body: GroupAnalysisRequest):
    """Public endpoint — analyze a Telegram group without auth."""
    # Resolve via Telethon (use a shared client, no tenant needed)
    # Return public info only
```

- [ ] **Step 1: Create backend endpoint**
- [ ] **Step 2: Create frontend page**
- [ ] **Step 3: Add generateMetadata**
- [ ] **Step 4: Test flow end-to-end**
- [ ] **Step 5: Commit + deploy**

---

## Task 3: Account Health Checker (`/tools/account-checker`)

Interactive checklist: user answers 8-10 questions about their Telegram account → gets a health score + recommendations.

**Files:**
- Create: `services/dashboard/src/app/tools/account-checker/page.tsx`

**Questions (checklist):**
1. How old is the account? (< 1 month / 1-6 months / 6+ months)
2. How many groups are you in? (< 10 / 10-50 / 50+)
3. How many messages do you send per day? (< 10 / 10-50 / 50+)
4. Do you use a proxy? (Yes / No)
5. Do you have 2FA enabled? (Yes / No)
6. How many contacts do you have? (< 50 / 50-200 / 200+)
7. Do you use the same device? (Yes / No)
8. Have you been restricted recently? (Yes / No)

**Scoring:**
- Each answer gets 0-3 points
- Total score → Health rating: Excellent (80+), Good (60-79), Fair (40-59), Poor (<40)
- Recommendations based on weak areas

- [ ] **Step 1: Create the page with checklist UI**
- [ ] **Step 2: Add scoring logic**
- [ ] **Step 3: Add recommendations engine**
- [ ] **Step 4: Add generateMetadata**
- [ ] **Step 5: Commit**

---

## Task 4: Integration Pages (5 pages)

Static pages for each integration, optimized for "Telegram to [CRM]" searches.

**Files:**
- Create: `services/dashboard/src/app/integrations/amo-crm/page.tsx`
- Create: `services/dashboard/src/app/integrations/google-sheets/page.tsx`
- Create: `services/dashboard/src/app/integrations/hubspot/page.tsx`
- Create: `services/dashboard/src/app/integrations/bitrix24/page.tsx`
- Create: `services/dashboard/src/app/integrations/webhook/page.tsx`

**Each page structure:**
- Hero: "Telegram → [CRM] Integration"
- How it works (3 steps)
- Features list
- Setup guide (screenshots placeholder)
- Pricing CTA
- FAQ (3-5 questions)

- [ ] **Step 1: Create AmoCRM page**
- [ ] **Step 2: Create Google Sheets page**
- [ ] **Step 3: Create HubSpot page**
- [ ] **Step 4: Create Bitrix24 page**
- [ ] **Step 5: Create Webhook page**
- [ ] **Step 6: Add generateMetadata to all**
- [ ] **Step 7: Commit**

---

## Task 5: Tutorial Pages (3 pages)

Step-by-step guides, optimized for how-to searches.

**Files:**
- Create: `services/dashboard/src/app/tutorials/telegram-auto-reply/page.tsx`
- Create: `services/dashboard/src/app/tutorials/telegram-lead-scraping/page.tsx`
- Create: `services/dashboard/src/app/tutorials/telegram-warmup/page.tsx`

**Each page structure:**
- Hero: "How to [action] — Step by Step Guide (2026)"
- Prerequisites
- Step 1-5 with code snippets / screenshots placeholder
- Common mistakes section
- Expected results
- CTA: "Automate this with 24GO"

- [ ] **Step 1: Create auto-reply tutorial**
- [ ] **Step 2: Create lead scraping tutorial**
- [ ] **Step 3: Create warmup tutorial**
- [ ] **Step 4: Add generateMetadata to all**
- [ ] **Step 5: Commit**

---

## Task 6: Tools Index Page (`/tools`)

Landing page listing all free tools with cards.

**Files:**
- Create: `services/dashboard/src/app/tools/page.tsx`

**Content:**
- Hero: "Free Telegram Marketing Tools"
- Grid of tool cards (ROI Calculator, Group Analyzer, Account Checker)
- Grid of integration pages
- Grid of tutorials
- CTA: "Ready for more? Start free trial"

- [ ] **Step 1: Create tools index page**
- [ ] **Step 2: Add generateMetadata**
- [ ] **Step 3: Link from landing page**
- [ ] **Step 4: Update sitemap.ts to include new pages**
- [ ] **Step 5: Commit**

---

## Deployment

All frontend changes → git push → Vercel auto-deploy.

Backend changes (Task 2 only) → SCP to VPS → rebuild fastapi container.
