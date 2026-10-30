# Installed API delta v38 — proxy assignment safety

**Installed**, not just a candidate. Image `sha256:95fbdafda47518d8d519576acafdcae0c7da14c4380474be21bcc9ee9612dab3` derives from v37 and changes only three backend routers. Frontend, workers and WA transport were not replaced.

## User-visible/API behavior

- Bulk assignment with `reset_first: false` keeps existing bindings and allocates only currently unused active tenant-owned proxies to unassigned tenant-owned accounts. A sequential repeat without free proxies makes no new assignments.
- `reset_first: true` retains explicit reset behavior. The existing frontend confirmation sends true; this release does not invent a new UI checkbox or change that confirmation.
- Counters reflect actual unassigned accounts and unused active proxies after the operation, including preserved assignments.
- Malformed single-assignment proxy IDs return422 rather than500 and leave the existing binding unchanged. Null unassignment, valid UUID spellings, role checks and missing/foreign/inactive denials remain supported.
- The account and group API proxy readers check that the proxy and account share a tenant, including legacy inconsistent foreign-key references.

The registered single-assignment handler now reuses the existing shared assignment helper instead of maintaining a second copy of the same mutation logic.

## Verification and limits

Six unique contracts passed against real disposable PostgreSQL16 on both candidate and exact image, without application-source overlays for image acceptance. They exercise registered HTTP/auth/ORM writes, real asyncpg proxy lookups, two tenants, role denials, own positive paths, null unassignment, reset/no-reset and unchanged state after rejection. No real social account, proxy server or provider was contacted. The exported Docker runner was additionally smoke-tested for malformed-assignment handling after an interrupted fixture startup was cleaned up.

Independent deployment readback verified API image, all three canonical/runtime hashes, unchanged v37 lead router, public API/database/Redis health and unchanged sibling container identities. Only API was replaced with all six Compose files retained; no migration or real customer fixture ran.

This is API-only coverage, not acceptance of worker proxy consumers, real connection behavior, atomic concurrent allocation or a database-enforced global one-proxy-per-account rule. No legacy customer rows were inspected or repaired by tests. Broader W3 remains open.

## Source provenance

| Router | Deployed SHA256 | Git-normalized LF SHA256 |
|---|---|---|
| `proxies.py` | `cd185b57acba00502920ab2d725fabb66e6f83ddbd8c239c28deba1bbad8a574` | `5d1fb0caa815736790da16bb6fc0293ac5d5d6ce086e1d871c346eb458316a91` |
| `accounts.py` | `42c21f45f5f7a6280251b217ae1bf26a34c84a5c71f4043806f34c918065faf5` | `7a8bae7bf941ab7d198eb18b70ee3a41740ed9396eb169eecf21e74b845d3db6` |
| `groups.py` | `ad61bfaeb1b6c8c02b013b3e650248a6ad3200583d336be4b6e0cab2eabcdc1b` | Same |

Only existing Git line-ending normalization is applied to exported text. Deployed files were not rewritten for Git. Regression harness: [verification/proxy-safety](../verification/proxy-safety/README.md). Previous installed [lead boundary](INSTALLED_RELEASE_V37.md) is retained.
