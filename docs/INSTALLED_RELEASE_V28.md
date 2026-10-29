# Installed frontend/API source snapshot — v28 / v26

This branch synchronizes the accepted frontend v28 and backend API v26 source inputs from the running VPS release. It is not an automatic deployment or a claim that the whole service is production-complete.

## Verified serving versions

- Website: https://www.24go.site/
- Blog, Russian: https://www.24go.site/blog?locale=ru
- Blog, English: https://www.24go.site/blog?locale=en
- API health: https://api.24go.site/health
- Frontend BUILD_ID: `HSa25axg6aHb342Y-wc60`
- Frontend image: `sha256:52b35e5d4dad7d31c0d690786a6517423d543e1df919a8fb23ff5ad3cf4036e4`
- API image: `sha256:a9c379ccc847f7d11ccec3990695a962e66049fccbca157118e2982e79331d5d`

Frontend inputs were checked against the accepted 193-file build manifest; API application inputs against the accepted 59-file snapshot and final v26 delta. Scoped Git attributes normalize text line endings in the index; source semantics are unchanged. No environment files, credentials, customer data, build caches or session stores are included in this update.

## Included behavior

- TG/VK bounded batch discovery: synchronous per-query results and failures, at most six combinations, up to twenty results per query, explicit non-atomic/partial persistence.
- Viewer operational read-only enforcement for JWT and explicitly supported API-key endpoints, preserving other existing roles.
- MAX explicit onboarding/webhook setup, account/team error handling, tenant/platform navigation and previously accepted public SEO/localization changes.
- Narrow-screen flex shrink fix: forms fit while wide tables retain local horizontal scrolling.

## Evidence and limitations

Frontend v28 completed one production build including normal Next type validation, 25 focused component tests, eight exact-image and eight public geometry combinations, and eight exact-image/public functional combinations. API v26 passed twelve isolated contract methods. Public browser acceptance used synthetic authentication and intercepted APIs: it is not real social-message delivery or proof of PostgreSQL RLS.

This commit updates frontend and backend application inputs only. Worker/sidecar sources, migrations and deployment files require their own reconciliation; do not assume this snapshot alone reproduces every installed consumer or deploy it over the existing VPS automatically. The current VPS uses SIX Compose files (base, seo, backend, vk-dispatch, platform, listener-capacity last); preserve every sibling image pin. In-progress WA sender development is excluded.

## Content automation check

Public inventory checked on 2026-10-29: 105 matching slugs per locale, not 210 different articles. The most recent public API record was created on 2026-10-27. No records have creation dates of October 28 or 29; `created_at` is not independent proof of publication time. Scheduler, editorial, delivery, internal links and external placement checks remain separate acceptance stages.

Most recent article:
- Russian: https://www.24go.site/blog/telegram-group-migration-crm-chat-id?locale=ru
- English: https://www.24go.site/blog/telegram-group-migration-crm-chat-id?locale=en

Do not interpret an enabled publisher/syndicator or an empty-queue success as evidence that new articles are generated and published daily. No new publication or external placement was performed for this audit.
