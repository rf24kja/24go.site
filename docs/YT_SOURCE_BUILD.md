## Latest accepted frontend: v55 campaign/mailing reliability — INSTALLED

Image `sha256:4e134835c7db0b42bc5a47aebf981c47463b2a771022be599d5c6117e2ba0fb5`; BUILD_ID `v0rLO-_uFfdWkN4W063cj`. Authority: `/home/hermes-admin/.hermes/projects/24go-site/dev-runs/campaign-mailing-ui-v55/INSTALLED_HANDOFF.md` and `PUBLIC_READBACK.json`. This section supersedes older current frontend/build instructions below, not accepted YT/API/admin settings.

Already installed, no rebuild/redeploy: dashboard only through full nine-file Compose chain; all sibling containers preserved. Exact-image and public synthetic intercepted RU/EN × TG/VK campaign/mailing contexts passed (8 contexts). Failure/retry, retained rows, selected-platform payload, read-check failure; null/undefined auth and async identity race component coverage. Focused 14 PASS; separate both-page null harness 14 PASS overlaps and is not additive. Corrected build exit0, frozen inputs verified. Historical full suite 318 PASS/9 inherited baseline FAIL; NOT new full-suite green. Mobile/narrow-screen UNVERIFIED (final browser viewport 1440×1600). Real sends/provider/live integration NOT tested.

Canonical reconciliation uses only seven manifest delta paths with before-hash guard, backups and readback: `CANONICAL_V55.json`. Preserve five unknown canonical paths (PlatformOverview, homepage-platform-scroll test, icon, apple-icon, vitest config); full canonical rebuild parity remains NOT established. Accepted next-build sources are the manifest-verified release checkout and `/home/hermes-admin/.hermes/projects/24go-site/dev-runs/campaign-mailing-ui-v55/candidate/dashboard`, never blindly `/opt`. Existing prepare_build.py now reads accepted latest v55 manifest. Source upload is not deployment/main merge/CI. Rollback: `generator-ad-dashboard:rollback-before-v55`, `compose.frontend.before.yaml`; preserve all nine Compose files and unchanged API/workers/Beat.

No provider/kaio/Redis/customer changes. YT tenant Settings remains the secure onboarding path; Google external prerequisite and monitoring/posting gates unchanged. Next work remains the existing finite W1–W12 scope, selected one confirmed unblocked workflow at a time; no new audit or feature queue is created by this closure.

# Accepted source build entry — installed YT/settings

Do not use `docker compose build` from the unversioned `/opt/generator-ad` tree as a release build entry. Canonical source reconciliation is scoped, not full-tree rebuild parity. Preserve the installed image pins and complete nine-file chain in `dev-runs/yt-settings/INSTALLED.json`.

## Frontend

From the verified `release/installed-yt-settings` checkout:

```
python verification/yt-settings/verify_export.py
python verification/yt-settings/prepare_build.py /absolute/new/isolated/dashboard-context
```

The entry checks every accepted frontend input before writing a new context. It copies manifest-listed source/public and actual root configs (including tailwind.config.js), never `/opt` unknown bytes, environment, caches or node_modules. `red.config.ts` is historical candidate-only tooling and intentionally excluded. SOURCE_IDENTITY.json records actual raw/Git-LF identities. This is source preparation, not compilation or reproducible-build acceptance. Provision compatible dependencies and use the established sanitized build runner; a new compiled artifact requires its own exact-image acceptance. Do not rerun the already installed build merely for this source reconciliation.

## Backend and workers

The accepted API modules now exist in canonical services/backend with the accepted schema adjacency. This does not wire `app.main`/Celery factories, reconcile requirements, authorize automatic Alembic, or establish whole backend/worker parity. Do not replace role-specific worker/Beat modules with API settings versions. A future bounded release must derive from each actual role image and copy only its accepted role manifest, preserve entrypoint/CMD/dependencies and full Compose chain, then import packaged modules in isolation. Stateful restart and schema application remain separate gates.

## Preserved unknown provenance — do not overwrite

- services/dashboard/src/components/PlatformOverview.tsx
- services/dashboard/src/__tests__/homepage-platform-scroll.test.tsx
- services/dashboard/src/app/icon.tsx
- services/dashboard/src/app/apple-icon.tsx
- services/dashboard/vitest.config.ts

Before-hashes, baseline classification, backups and per-file readback: `dev-runs/yt-settings/CANONICAL_RECONCILIATION.json`. These files block full canonical frontend rebuild parity; use the accepted isolated export rather than guessing their provenance. No production rebuild/restart was performed. Offline canonical-module tests are source-overlay API-dependency tests, not worker-image or full-app acceptance.
