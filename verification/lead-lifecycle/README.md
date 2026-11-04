# Lead lifecycle v57 — INSTALLED

API-only image `sha256:eb043e53c7309307239f5fac230baa08a48dfa7609c6dfc0a155999ca8ae0de1`; source `/app/app/routers/leads.py` SHA256 `649809229b24a4e1ac47ba66a1c0d30c22b345debf78172e152a2222bf06a063`.

Own lead status now commits with its actor/tenant-bound audit record in one request transaction. A failed audit no longer silently commits a successful status change; unchanged status creates no duplicate audit. Invalid lead UUID returns422, missing/foreign404, viewer403. `SELECT FOR UPDATE` serializes this handler's read/write; no claim about other bulk writers or global concurrency is made.

Actual UI trace: `leads/page.tsx` handlers196/206 and `leads/[id]/page.tsx` handler50 → `lib/api.ts:updateLeadStatus`481 → registered PATCH `/api/v1/leads/{lead_id}` → existing SQLAlchemy Lead and audit_log. No frontend contract or worker change.

Baseline:3 methods,2 assertion FAIL/1 PASS, zero fixture errors. Candidate and exact packaged image: same3 methods PASS with full-app routes, real JWT/ORM and disposable PostgreSQL; provider/pipeline mocked, external egress disabled. Tested audit CHECK rejection/rollback, successful status+one matching audit, repeat no duplicate, foreign/missing/malformed identity and viewer denial. Exact run has no product-source mounts. Logs retain expected synthetic environment/asyncio warnings; not a full backend suite or live-provider acceptance.

Only leads.py differs in full app/Alembic Python/SQL manifests; CMD/ENTRYPOINT unchanged. Installed through existing full9Compose with current image/container/config checks and existing schema-column metadata precheck. No migrations. Independently read back complete runtime manifest, image, all unchanged siblings, public API401/DB+Redis health, public YT/settings/campaign/mailing v56 BUILD. Canonical one-file source reconciled with before-hash backup/readback; five unrelated unknowns untouched.

Receipts: BASELINE.json, MANIFEST.json, IMAGE.json, receipts/{baseline,candidate,exact}.{log,json}, PREFLIGHT.json, INSTALLED.json, INDEPENDENT_READBACK.json. Rollback: `generator-ad-backend:rollback-before-lead-lifecycle-v57` and `compose.yt.before.yaml`, restore only fastapi through same9 files. Dashboard remains ccc8eaa…/`ZELiswwbGkFI7gRo8UgCr`; all YT/API-settings modules preserved. No builder/process outstanding. Billing/worker/WA maintenance and live resources remain separately gated; W3 whole package remains open.
