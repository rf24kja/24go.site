# Lead ownership — isolated PostgreSQL contracts

This is an external unittest harness, not `services/backend/tests/conftest.py`. It reuses actual registered routes, authentication and ORM models from a **locally reviewed backend image**. The image must expose the application at `/app/app` and contain its normal runtime dependencies.

## Requirements

- Linux, Python3 stdlib and Docker operator/root access.
- Pre-provisioned `postgres:16-alpine` and the reviewed backend image. The runner uses `--pull never`; it does not download dependencies or alter a Hermes environment.
- No real tokens, accounts, sessions, `.env`, production volumes or production DB access are needed.

Run from this directory on a designated development machine:

```bash
python3 run.py YOUR_LOCAL_BACKEND_IMAGE
```

The installed image ID is recorded in [the release snapshot](../../docs/INSTALLED_RELEASE_V37.md); it is a local artifact identity, not a promise that a public registry hosts it. A bounded individual contract may be selected as the second argument, e.g. `Ownership.test_rejects_foreign_wrong_platform_and_missing_references_before_pipeline`.

The runner refuses an existing fixture-container name. It creates a disposable PostgreSQL with tmpfs data, no TCP listener and no network. The API test container also has network disabled, read-only root filesystem, dropped capabilities and synthetic configuration. A dedicated Unix-socket directory is its only DB connection. No application-source bind mount is used. Cleanup removes only the named fixture container; local receipts/socket directories are ignored by Git. Docker may give that socket directory a PostgreSQL UID; rerunning/cleaning it may require the same operator privileges.

The harness recreates **only its fixture database's public schema**, after checking database identity. Do not edit the fixed fixture socket DSN to point at a real database. It does not run application lifespan hooks. AI classification and provider work are mocked, so passing tests are PostgreSQL/auth/reference contracts, not real external-platform acceptance.

All six methods passed on the exact release image; the exported runner was additionally exercised for the reference-denial contract. Existing test-mode encryption and asyncio slow-task warnings are not suppressed or presented as production findings. See the release snapshot for the acceptance boundary and deployment identity.
