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
