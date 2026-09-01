# Final Pre-Launch Audit Plan — 24go.site

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify 100% readiness of 24go.site for production launch with live payments, advertising, and paying customers.

**Architecture:** Multi-tenant B2B SaaS (FastAPI + Celery + Next.js + PostgreSQL + Redis). Users register → trial → connect TG → capture leads → pay via Stripe. All must work flawlessly.

**Tech Stack:** Python 3.11, FastAPI, Celery, PostgreSQL 16, Redis, Next.js 14, Tailwind CSS, Telethon, Stripe, Docker, Caddy reverse proxy

---

## Global Constraints

- Production VPS: `46.250.235.165` (SSH key: `C:\Users\rf24k\.ssh\id_ed25519_generator`)
- Project path on VPS: `/opt/generator-ad/`
- Dashboard: `https://www.24go.site`
- API: `https://api.24go.site`
- Database: `app_db` (user: `app_user`)
- **No tests exist** — all verification is manual/integration
- **Stripe currently in TEST mode** — must switch before launch
- **i18n: 855 keys** in EN and RU (full parity)
- **10 database migrations** (001-010)

---

## Audit Phases

| Phase | Focus | Priority |
|-------|-------|----------|
| 1 | Infrastructure & Deployment | CRITICAL |
| 2 | Security Hardening | CRITICAL |
| 3 | Payment & Billing Flow | CRITICAL |
| 4 | End-to-End User Journey | CRITICAL |
| 5 | Backend API & Data Integrity | HIGH |
| 6 | Frontend & UX | HIGH |
| 7 | Worker & Background Tasks | HIGH |
| 8 | Performance & Reliability | MEDIUM |
| 9 | SEO & Marketing | MEDIUM |
| 10 | Documentation & Handoff | LOW |

---

## Phase 1: Infrastructure & Deployment

### Task 1.1: Verify all containers healthy

- [ ] SSH into VPS: `ssh -i C:\Users\rf24k\.ssh\id_ed25519_generator root@46.250.235.165`
- [ ] Run: `cd /opt/generator-ad && docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"`
- [ ] Verify ALL 11 containers are running:
  - `generator-ad-postgres-1` (healthy)
  - `generator-ad-redis-1` (healthy)
  - `generator-ad-fastapi-1` (healthy)
  - `generator-ad-celery-beat-1`
  - `generator-ad-worker-parser-1`
  - `generator-ad-worker-poster-1`
  - `generator-ad-worker-warmup-1`
  - `generator-ad-worker-listener-1`
  - `generator-ad-worker-billing-1`
  - `generator-ad-dashboard-1`
  - `generator-ad-bot-1`
- [ ] Check no containers are in "Restarting" state

### Task 1.2: Verify API health endpoint

- [ ] Run: `curl -s http://localhost:8001/health`
- [ ] Expected: `{"status":"ok","database":"ok","redis":"ok"}`
- [ ] Run: `curl -s https://api.24go.site/health`
- [ ] Expected: Same response via Caddy

### Task 1.3: Verify database connectivity

- [ ] Run: `docker compose exec postgres psql -U app_user -d app_db -c "SELECT count(*) FROM pg_stat_activity WHERE datname='app_db';"`
- [ ] Verify connection count < 50 (out of 100 max)
- [ ] Run: `docker compose exec postgres psql -U app_user -d app_db -c "\dt"` to list all tables
- [ ] Verify all 12+ tables exist (tenants, users, leads, campaigns, accounts, etc.)

### Task 1.4: Verify Redis

- [ ] Run: `docker compose exec redis redis-cli ping`
- [ ] Expected: `PONG`
- [ ] Run: `docker compose exec redis redis-cli info clients`
- [ ] Verify `connected_clients` < 100

### Task 1.5: Verify SSL certificates

- [ ] Run: `curl -sI https://api.24go.site | head -5`
- [ ] Verify HTTP 200 and valid SSL
- [ ] Run: `curl -sI https://www.24go.site | head -5`
- [ ] Verify HTTP 200 and valid SSL
- [ ] Check certificate expiry: `echo | openssl s_client -connect api.24go.site:443 2>/dev/null | openssl x509 -noout -dates`

### Task 1.6: Verify disk and memory

- [ ] Run: `df -h /` — verify > 50% free
- [ ] Run: `free -h` — verify > 2GB available RAM
- [ ] Run: `docker system df` — verify no excessive image/container bloat

### Task 1.7: Verify backups

- [ ] Run: `ls -la /opt/generator-ad/backups/ 2>/dev/null || echo "No backups dir"`
- [ ] Verify backup files exist (one per day, ~57KB each)
- [ ] Run the latest backup to verify it's valid: `gunzip -t /opt/generator-ad/backups/*.sql.gz 2>&1 | tail -5`

### Task 1.8: Verify Caddy config

- [ ] Run: `cat /etc/caddy/Caddyfile`
- [ ] Verify `api.24go.site` → reverse proxy to `fastapi:8000`
- [ ] Verify `www.24go.site` → reverse proxy to `dashboard:3000`
- [ ] Verify TLS auto-redirect

---

## Phase 2: Security Hardening

### Task 2.1: Verify environment secrets

- [ ] Run: `grep -E "(SECRET_KEY|JWT_SECRET|ENCRYPTION_KEY|STRIPE)" /opt/generator-ad/.env | sed 's/=.*/=***REDACTED***/'`
- [ ] Verify NO default/weak secrets in production
- [ ] Verify `STRIPE_SECRET_KEY` starts with `sk_live_` (currently `sk_test_`)
- [ ] Verify `STRIPE_WEBHOOK_SECRET` starts with `whsec_`

### Task 2.2: Verify authentication flow

- [ ] Test registration: `POST https://api.24go.site/api/v1/auth/register` with valid data
- [ ] Test login: `POST https://api.24go.site/api/v1/auth/login` with valid credentials
- [ ] Test unauthorized access: `GET https://api.24go.site/api/v1/leads` without token → should return 401
- [ ] Test expired token: Use an old JWT → should return 401
- [ ] Test rate limiting: Send 11 login attempts rapidly → 11th should return 429

### Task 2.3: Verify SQL injection protection

- [ ] Read `services/backend/app/database.py` — verify UUID validation before SET LOCAL
- [ ] Test with invalid tenant_id in JWT: Should be rejected by UUID regex validation
- [ ] Verify all database queries use parameterized queries (no f-string SQL)

### Task 2.4: Verify CORS configuration

- [ ] Run: `curl -sI -X OPTIONS -H "Origin: https://www.24go.site" -H "Access-Control-Request-Method: GET" https://api.24go.site/health`
- [ ] Verify `Access-Control-Allow-Origin` header is set correctly

### Task 2.5: Verify webhook security

- [ ] Test Stripe webhook without signature → should return error
- [ ] Test YooKassa webhook with invalid payload → should return 400
- [ ] Verify HMAC secret is required for n8n webhooks

### Task 2.6: Verify encryption at rest

- [ ] Read `services/backend/app/crypto.py` — verify `ENCRYPTION_KEY` is required in production
- [ ] Verify Telegram session data is encrypted in `account_sessions` table

### Task 2.7: Verify CORS headers on dashboard

- [ ] Run: `curl -sI https://www.24go.site/ | grep -i "x-frame-options\|content-security-policy\|x-content-type"`
- [ ] Verify security headers are present

---

## Phase 3: Payment & Billing Flow

### Task 3.1: Switch Stripe to LIVE mode (MANUAL)

> ⚠️ **This is the ONLY manual step — requires user action**

- [ ] **User action:** Go to Stripe Dashboard → Developers → API keys
- [ ] **User action:** Copy `sk_live_...` secret key
- [ ] **User action:** Create webhook endpoint: `https://api.24go.site/api/v1/billing/stripe-webhook`
- [ ] **User action:** Events to subscribe: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`
- [ ] **User action:** Copy `whsec_...` webhook secret
- [ ] **Deploy:** Update `.env` on VPS with live keys
- [ ] **Deploy:** `cd /opt/generator-ad && docker compose up -d --build --no-deps fastapi worker-billing`

### Task 3.2: Verify Stripe checkout flow

- [ ] Test: `POST https://api.24go.site/api/v1/billing/checkout` with plan="starter"
- [ ] Verify response contains `checkout_url` starting with `https://checkout.stripe.com`
- [ ] Verify URL loads Stripe checkout page (can test in browser)

### Task 3.3: Verify Stripe webhook processing

- [ ] Read `services/backend/app/routers/billing.py` — verify webhook signature verification
- [ ] Verify `_process_payment` creates/updates subscription
- [ ] Verify idempotency (same webhook twice → no duplicate charges)

### Task 3.4: Verify trial flow

- [ ] Register new user → verify trial subscription created (14 days, 100 posts, 100k tokens)
- [ ] Verify `current_period_end` is 14 days from now
- [ ] Verify `expire_trials` task will catch expired trials (runs daily at 2am UTC)
- [ ] Test: Manually set a subscription's `current_period_end` to yesterday → verify it gets expired on next check

### Task 3.5: Verify quota enforcement

- [ ] Read `services/backend/app/quota.py` — verify plan limits exist for all plans
- [ ] Verify `check_quota` checks: status, plan limits, period dates
- [ ] Verify `record_usage` uses atomic UPDATE (WHERE balance >= cost)

### Task 3.6: Verify billing page

- [ ] Visit `https://www.24go.site/billing`
- [ ] Verify 3 plan cards visible (Starter $75, Pro $199, Enterprise $499)
- [ ] Verify current subscription info displays correctly
- [ ] Verify "Upgrade" button triggers Stripe checkout redirect

### Task 3.7: Verify email notifications

- [ ] Test SMTP: `POST https://api.24go.site/api/v1/notifications/test-smtp`
- [ ] Verify email arrives at `rf24krsk@gmail.com`
- [ ] Verify trial email sequence (Day 1, 3, 7, 12) — can test by manually triggering the task

---

## Phase 4: End-to-End User Journey

### Task 4.1: Registration → Trial

- [ ] Visit `https://www.24go.site`
- [ ] Click "Get Started" → Registration page
- [ ] Fill in: company name, email, password
- [ ] Submit → verify redirect to dashboard
- [ ] Verify onboarding wizard appears (3 screens)
- [ ] Verify trial subscription visible on billing page
- [ ] Verify "How to Use" page accessible from sidebar

### Task 4.2: Connect Telegram Account

- [ ] Go to Accounts page
- [ ] Click "+ Add Account"
- [ ] Enter phone number → click "Send Code"
- [ ] Enter verification code
- [ ] If 2FA: Enter password
- [ ] Verify account status changes to "Warming Up"
- [ ] Verify listener task is dispatched

### Task 4.3: Discover Target Groups

- [ ] Go to Groups page
- [ ] Click "Auto-Discover Groups"
- [ ] Enter GEO and niche
- [ ] Click "Discover"
- [ ] Verify groups are found and displayed
- [ ] Click "+ Add" on a group
- [ ] Verify group appears in monitored groups list

### Task 4.4: Lead Capture

- [ ] Wait for listener to capture a DM (or use "Qualify" form on Leads page)
- [ ] Verify lead appears in Leads list
- [ ] Verify lead has correct intent (HOT/WARM/COLD)
- [ ] Verify lead has message content
- [ ] Verify WebSocket delivers real-time update

### Task 4.5: Lead Management

- [ ] Click on a lead → verify detail view opens
- [ ] Change lead status (New → In Progress → Converted)
- [ ] Verify status change is saved
- [ ] Export leads to CSV → verify file downloads
- [ ] Import leads from CSV → verify they appear in list

### Task 4.6: Campaign Creation & Posting

- [ ] Go to Campaigns page
- [ ] Click "New Campaign"
- [ ] Fill in: name, text (with spintax), schedule, target GEOs
- [ ] Save campaign
- [ ] Click "Run" to trigger immediate post
- [ ] Verify post is published to target group
- [ ] Verify posting log appears in campaign stats

### Task 4.7: A/B Testing

- [ ] Edit campaign → enable A/B testing
- [ ] Add 2 variants with different text
- [ ] Set weights (50/50)
- [ ] Run campaign → verify variant is selected
- [ ] Check A/B stats page for variant performance

### Task 4.8: Settings & Configuration

- [ ] Go to Settings page
- [ ] Test each section: AI, Warmup, Posting, Notifications, Groups, Account
- [ ] Verify settings save correctly
- [ ] Verify auto-reply configuration (add multiple replies, test random/cyclic)
- [ ] Verify n8n webhook configuration (add URL, test connection)

### Task 4.9: Blog

- [ ] Visit `https://www.24go.site/blog`
- [ ] Verify blog posts are listed with titles and excerpts
- [ ] Click on a post → verify full content loads
- [ ] Toggle language (EN/RU) → verify content switches
- [ ] Verify SEO meta tags in page source
- [ ] Visit `/sitemap.xml` → verify blog URLs included

### Task 4.10: Help Page

- [ ] Go to Help page from sidebar
- [ ] Verify 6-step guide is displayed
- [ ] Verify FAQ section works (expand/collapse)
- [ ] Toggle EN/RU → verify all content translates

---

## Phase 5: Backend API & Data Integrity

### Task 5.1: Test all 75 API endpoints

For each endpoint, verify:
- [ ] Auth required → 401 without token
- [ ] Valid request → 200/201
- [ ] Invalid request → 400/422
- [ ] Not found → 404
- [ ] Rate limiting → 429 when exceeded

### Task 5.2: Verify tenant isolation

- [ ] Create 2 test tenants
- [ ] Tenant A creates a lead
- [ ] Tenant B tries to read Tenant A's lead → should get 404 or empty
- [ ] Verify RLS (Row-Level Security) is enforced via `SET LOCAL app.current_tenant`

### Task 5.3: Verify data consistency

- [ ] Check for orphaned records:
  ```sql
  SELECT count(*) FROM leads WHERE tenant_id NOT IN (SELECT id FROM tenants);
  SELECT count(*) FROM campaigns WHERE tenant_id NOT IN (SELECT id FROM tenants);
  SELECT count(*) FROM accounts WHERE tenant_id NOT IN (SELECT id FROM tenants);
  ```
- [ ] All should return 0

### Task 5.4: Verify audit logging

- [ ] Create a lead → verify audit_log entry exists
- [ ] Change lead status → verify audit_log entry
- [ ] Verify IP address is recorded

### Task 5.5: Verify blog CRUD

- [ ] Create blog post via admin API
- [ ] Read via public API
- [ ] Update blog post
- [ ] Delete blog post
- [ ] Verify slug is unique

---

## Phase 6: Frontend & UX

### Task 6.1: Verify all pages load

- [ ] Visit every page in dashboard (16 pages)
- [ ] Verify no blank screens or JavaScript errors
- [ ] Check browser console for errors

### Task 6.2: Verify i18n coverage

- [ ] Toggle to RU → verify all text is Russian
- [ ] Toggle to EN → verify all text is English
- [ ] Check for any hardcoded English strings remaining

### Task 6.3: Verify animations

- [ ] Navigate between pages → verify fadeSlideIn animation
- [ ] Click toggles → verify smooth transition
- [ ] Trigger toast → verify slide-in animation
- [ ] Click buttons → verify press effect

### Task 6.4: Verify responsive design

- [ ] Test on mobile viewport (375px width)
- [ ] Verify sidebar collapses to hamburger menu
- [ ] Verify tables are scrollable
- [ ] Verify modals are centered and scrollable

### Task 6.5: Verify onboarding wizard

- [ ] Register new user → verify wizard appears
- [ ] Complete all 3 screens
- [ ] Verify localStorage flag set (wizard won't show again)
- [ ] Clear localStorage → verify wizard reappears

### Task 6.6: Verify error handling

- [ ] Disconnect network → verify error messages appear
- [ ] Try accessing invalid URL → verify 404 page
- [ ] Try submitting empty forms → verify validation messages

---

## Phase 7: Worker & Background Tasks

### Task 7.1: Verify Celery Beat schedules

- [ ] Run: `docker compose exec celery-beat celery -A app.celery_app inspect scheduled`
- [ ] Verify 7 scheduled tasks are registered
- [ ] Verify cron expressions are correct

### Task 7.2: Verify worker connectivity

- [ ] Run: `docker compose exec worker-poster celery -A app.celery_app inspect ping`
- [ ] Verify all workers respond

### Task 7.3: Verify Telegram client

- [ ] Check worker-listener logs for "Connected" message
- [ ] Verify no "Not a valid string" errors
- [ ] Verify no "Cannot run event loop" errors

### Task 7.4: Verify LLM classification

- [ ] Send a test message through the qualify endpoint
- [ ] Verify it reaches the LLM classifier
- [ ] Verify classification result (HOT/WARM/COLD/SPAM)
- [ ] Verify fallback to keyword classification works

### Task 7.5: Verify email sending

- [ ] Trigger `send_trial_emails` task manually
- [ ] Verify email is sent (check SMTP logs)
- [ ] Verify email HTML renders correctly

### Task 7.6: Verify auto-reply

- [ ] Configure auto-reply in settings (enable, add 3 replies)
- [ ] Send a HOT lead message
- [ ] Verify auto-reply is sent after delay
- [ ] Verify rate limiting works (send > 10 in an hour → blocked)

### Task 7.7: Verify n8n webhooks

- [ ] Configure n8n webhook URL in settings
- [ ] Capture a new lead
- [ ] Verify webhook is fired with correct payload
- [ ] Verify HMAC signature is correct

---

## Phase 8: Performance & Reliability

### Task 8.1: Load test API

- [ ] Run: `for i in {1..100}; do curl -s -o /dev/null -w "%{http_code}" https://api.24go.site/health & done; wait`
- [ ] Verify all return 200
- [ ] Check response time < 500ms

### Task 8.2: Check connection pools

- [ ] Verify PostgreSQL connections < 50/100
- [ ] Verify Redis memory < 100MB
- [ ] Verify no connection leaks in worker logs

### Task 8.3: Check memory usage

- [ ] Run: `docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}"`
- [ ] Verify no container uses > 500MB RAM
- [ ] Verify total memory usage < 8GB (out of 11GB)

### Task 8.4: Check disk I/O

- [ ] Run: `iostat -x 1 3` (if available)
- [ ] Verify no I/O bottleneck

---

## Phase 9: SEO & Marketing

### Task 9.1: Verify landing page SEO

- [ ] Visit `https://www.24go.site`
- [ ] View page source → verify `<title>`, `<meta description>`, `<meta keywords>`
- [ ] Verify Open Graph tags (og:title, og:description, og:image)
- [ ] Verify Twitter Card tags

### Task 9.2: Verify blog SEO

- [ ] Visit a blog post → verify unique title and meta description
- [ ] Verify Schema.org JSON-LD structured data
- [ ] Verify canonical URL

### Task 9.3: Verify sitemap

- [ ] Visit `https://www.24go.site/sitemap.xml`
- [ ] Verify all 19+ URLs are included
- [ ] Verify blog posts are included with correct dates

### Task 9.4: Verify robots.txt

- [ ] Visit `https://www.24go.site/robots.txt`
- [ ] Verify crawl rules allow search engines
- [ ] Verify sitemap reference

### Task 9.5: Verify Yandex verification

- [ ] Visit `https://www.24go.site/yandex_25d1260e478746bd.html`
- [ ] Verify file is accessible
- [ ] User action: Click "Подтвердить" in Yandex Webmaster

### Task 9.6: Verify Google verification

- [ ] Check Google Search Console for sitemap submission status
- [ ] Verify no indexing errors

---

## Phase 10: Documentation & Handoff

### Task 10.1: Verify help page

- [ ] Visit `/help` from admin dashboard
- [ ] Verify all 6 steps are accurate and up-to-date
- [ ] Verify all 8 FAQ entries are accurate
- [ ] Verify email support link works

### Task 10.2: Verify llms.txt

- [ ] Visit `https://www.24go.site/llms.txt`
- [ ] Verify AI-readable site description is accurate

### Task 10.3: Create operations checklist

- [ ] Document all environment variables and their purposes
- [ ] Document backup/restore procedure
- [ ] Document scaling procedure
- [ ] Document incident response steps

---

## Launch Checklist Summary

| # | Check | Status |
|---|-------|--------|
| 1 | All containers running | ⬜ |
| 2 | API health OK | ⬜ |
| 3 | SSL valid on both domains | ⬜ |
| 4 | Database healthy | ⬜ |
| 5 | Redis healthy | ⬜ |
| 6 | Backups working | ⬜ |
| 7 | Stripe LIVE keys configured | ⬜ |
| 8 | Stripe webhook configured | ⬜ |
| 9 | Registration → Trial works | ⬜ |
| 10 | TG Connect works | ⬜ |
| 11 | Lead capture works | ⬜ |
| 12 | AI classification works | ⬜ |
| 13 | Campaign posting works | ⬜ |
| 14 | Payment flow works | ⬜ |
| 15 | Email notifications work | ⬜ |
| 16 | i18n EN/RU works | ⬜ |
| 17 | SEO meta tags present | ⬜ |
| 18 | Sitemap valid | ⬜ |
| 19 | Help page accurate | ⬜ |
| 20 | No console errors | ⬜ |

**All 20 checks must pass before launch.**
