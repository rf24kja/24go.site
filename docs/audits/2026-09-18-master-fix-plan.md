# Master Fix Plan — 31 Issues from 5 Audits

**Created:** 2026-09-18
**Status:** In Progress

## Batch 1: Infrastructure Quick Wins (I1, I3)
Priority: DO FIRST — prevents data loss

| Issue | Fix |
|-------|-----|
| I1: No DB backups | Create `scripts/backup-db.sh` + cron on VPS |
| I3: No log rotation | Add `logging` config to docker-compose.yml |

## Batch 2: Security (C1-C4, I1-I7)
Priority: CRITICAL — attack surface

| Issue | Fix |
|-------|-----|
| C1: .env secrets | Ensure .env in .gitignore, rotate if exposed |
| C2: No JWT revocation | Add token blacklist table + middleware check |
| C3: RLS policies | Create proper RLS policies in migration |
| C4: raw asyncpg bypasses RLS | Route all queries through SQLAlchemy |
| I1: token audience | Add `aud` claim verification |
| I2: rate limiter fails open | Log warning, fail closed |
| I3: password complexity | Already implemented (uppercase+lowercase+digit) |
| I4: hardcoded owner email | Move to env var |
| I5: CORS allow_methods=* | Restrict to specific methods |
| I6: incomplete account deletion | Add cascade deletes |
| I7: WebSocket JWT audience | Verify `aud` in WS auth |

## Batch 3: Performance (P0-1, P0-2, P1-1-P1-3)
Priority: HIGH — production stability

| Issue | Fix |
|-------|-----|
| P0-1: N+1 campaign_scheduler | Batch queries, use asyncpg pool |
| P0-2: quota.py new connection | Use shared db_pool |
| P1-1: No Redis connection pooling | Add connection pool |
| P1-2: VK LongPoll sync httpx | Keep sync (correct for LongPoll) |
| P1-3: Missing index | CREATE INDEX on posting_logs.campaign_id |

## Batch 4: Business Logic (B1-B5)
Priority: HIGH — revenue impact

| Issue | Fix |
|-------|-----|
| B1: Quota enforcement | Wire record_post() + record_usage() in workers |
| B2: deduct_balance TOCTOU | Use atomic SQL UPDATE...WHERE balance >= amount |
| B3: Stripe Price IDs | Use existing prices instead of creating new |
| B4: Cancel endpoint | Add POST /billing/cancel |
| B5: Invoice generation | Add Stripe invoice PDF download |

## Batch 5: UX (U1-U5)
Priority: HIGH — conversion

| Issue | Fix |
|-------|-----|
| U1: No auto-onboarding | Redirect to /onboarding after registration |
| U2: Empty analytics | Add CTA cards pointing to setup steps |
| U3: No email verification | Add optional verification flow |
| U4: No retention emails | Add post-signup drip sequence |
| U5: Price inconsistency | Centralize prices in one config |

## Batch 6: CI/CD + Monitoring (I2, I4)
Priority: MEDIUM — operational maturity

| Issue | Fix |
|-------|-----|
| I2: No CI/CD | GitHub Actions with pytest + lint |
| I4: No alerting | Sentry on backend + healthcheck cron |
