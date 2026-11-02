# Installed API release v44 — contact batch reliability

## Installed behavior

- `POST /api/v1/contacts/refresh-platforms` processes each validated contact UUID once. Canonical and uppercase spellings parse to the same UUID; duplicate inputs no longer inflate `updated` or repeat provider checks.
- `POST /api/v1/contacts/check-platforms` reuses checks for the same normalized phone **within one request**, while preserving one result per input and its order. No cache is shared across requests, tenants or accounts.
- Existing tenant/role predicates, owned connected-WA-account selection and TG/VK/WA unknown semantics remain unchanged. Unknown responses do not clear previously known contact fields. This does not make unsupported TG/VK phone lookup available.

## Evidence

Three registered-route contracts ran with actual JWT authentication/roles, PostgreSQL16 and ORM persistence in isolated Unix-socket fixtures; only provider functions were mocked. The immutable baseline produced two assertion failures: checks3instead of2 for repeated phones and updated2instead of1 for repeated contact IDs. Candidate and exact packaged image passed all three methods. The exported fixture runner also passed against that exact image without app-source overlays.

The negative contract verifies foreign-only IDs, viewer refresh and unauthenticated checks make no provider calls. The refresh contract confirms unknown TG/VK/WA results preserve existing fields for both tenants. The phone-check contract preserves output order/cardinality and binds every mocked WA request to the actor's own connected account. No real customer fixtures, phone lookup, social send or connected-account action was performed.

## Runtime and deployment scope

- API image: `sha256:a8b80d4bd5a5a8138f3b176f4cd2017743f90eb83a81acbcc98b141c67f75eef`.
- Tag: `generator-ad-backend:contact-batch-v44`.
- Exact installed base: v39 `sha256:33838f362a53f80c7d8b596e213ec6eb35d54bc09562abc6d67514aeccf5a9f8`.
- Only copied artifact: `/app/app/routers/contacts.py`. Full app/Alembic Python manifests and inherited CMD/ENTRYPOINT were compared; only that router changed. **No new migration, including repository-only026, was introduced or applied.**
- All six effective Compose files retained; only fastapi was replaced. Frontend, workers, WA sidecar and unrelated container IDs stayed unchanged. No new dependency, model, schedule, billing or credentials change.
- Public API/database/Redis health passed; the registered unauthenticated route denied access401 with an invalid empty payload that cannot trigger number checks. Runtime and canonical router hashes were read back separately.

Runtime/canonical source SHA256: `d61236210aa29d4adc65981eee6178c14af1c1524000e888ca60be82062b6c23`.
Git's declared CRLF-to-LF export SHA256: `4e39216d76cd0898b6c507def73ff1287238b81a2ea9414c9d3d69fd995766c1`. Export normalization does not rewrite the accepted runtime artifact.

Rollback image: `generator-ad-backend:rollback-before-contact-batch-v44`; prior last-override content is retained in the private release receipt. Restore only fastapi with the complete six-file chain, no whole-project restart.

## Verification and limits

See [portable fixture instructions](../verification/contact-batch/README.md). Do not run installed `tests/conftest.py` against production. Local raw receipts remain under `dev-runs/contact-batch-v44/`: baseline/candidate/exact logs, IMAGE.json, INSTALLED.json, build/deploy logs and source/override backups. Exact remote commit and CI must be read back before reporting GitHub success.

This is a bounded Contacts reliability improvement, not full W3/RLS/concurrent-revocation acceptance or live-provider acceptance. Editorial v42/v43 and its published article remain in place; no article was generated or republished for this release. The finite W1–W12 plan and external maintenance/permission gates remain applicable.
