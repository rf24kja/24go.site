# Proxy safety — isolated PostgreSQL regression contracts

This external unittest harness exercises registered API handlers, JWT authentication, ORM writes and both API asyncpg proxy readers. It uses synthetic account/proxy rows, not a real Telegram/WA/FB/VK account or a reachable proxy server. No SDK connection operation is exercised.

## Run

Use Linux, Python3 and authorized Docker operator/root access on a designated development machine. Pre-provision `postgres:16-alpine` and a reviewed backend image with normal runtime dependencies and application at `/app/app`; no image download is performed.

```bash
python3 run.py YOUR_LOCAL_BACKEND_IMAGE
```

A single method can be selected as the second argument, for example `ProxySafety.test_malformed_assignment_returns_422_without_changing_binding`.

The runner uses the same isolation as [lead ownership contracts](../lead-ownership/README.md): fixture PostgreSQL on tmpfs, network-none containers, Unix socket only, synthetic configuration, no production volumes or `.env`, and no application-source overlay. It refuses an existing named fixture. Schema recreation is confined to the fixed fixture socket/database; do not replace its DSN with a real database. Socket files may acquire the PostgreSQL UID and require the same operator privileges on rerun/cleanup.

All six methods passed on the exact release image. The exported runner's malformed-assignment smoke also passed after cleanup/recovery from an interrupted fixture startup; that single smoke is not counted as six extra tests. Existing test-mode encryption/asyncio warnings remain visible. See [installed v38](../../docs/INSTALLED_RELEASE_V38.md) for artifact identities, normalization and unverified concurrency/worker/provider boundaries.
