# GitHub main reconciliation v41

The owner expressly authorized main promotion. The installed-release branch was fast-forwarded into main at `a5da69587d0cf3f780aaa57426c6ee0a9f496bc5`, without rewriting history. Remote references and actual main README/source files were read back. The first real main CI run was [41383628523](https://github.com/rf24kja/24go.site/actions/runs/41383628523): dashboard, worker and sidecar passed; backend and lint failed. A Vercel status/comment check was not substituted for these application checks.

## Confirmed root causes and bounded correction

- Lint found one unused module-level `time` import in accounts.py. The actually used function-local `time as _t` remains unchanged.
- Fresh Alembic installs lacked `tenant_vk_discovery_credentials`, although the registered VK discovery reader required it. Revision026 packages the existing separate SQL schema (tenant primary key/FK cascade, encrypted payload field, positive user identity, update timestamp). This is a source/bootstrap reconciliation, not permission to run migrations on production.
- The old VK test still expected missing discovery credentials to produce a false successful empty result. Its assertion now follows the already-installed explicit409 `vk_discovery_not_connected` contract and verifies no provider request. A real PostgreSQL schema test additionally exercises primary-key uniqueness, positive-user check, foreign-key denial and tenant deletion cascade.

The first backend run was51passed/1failed; its actual failure was UndefinedTableError, not a provider quota or live VK rejection. No actual account/provider connection was exercised.

## Runtime boundary

This CI/source correction is not a new installed API image. The production application remains v39; the host Blogger diagnostic script remains v40. The repository-only accounts cleanup removes an unused import and has no intended behavior change, but its bytes are not claimed to match the installed router. Revision026 was **not applied to production** and must not be slipped into a container restart: the existing backend Dockerfile runs `alembic upgrade head` at startup. Any production schema rollout requires its own reviewed, backed-up scope.

The corrected code commit `dfa3c0dffe4ced6e3698b44bd1a7e63de5d9fc91` passed all five real jobs in [CI run41384717280](https://github.com/rf24kja/24go.site/actions/runs/41384717280): backend, dashboard, worker, sidecar and lint. The result was read back as completed/success. A following documentation-only checkpoint does not repeat the unchanged application suites; it is not a claim that a different code revision was tested. Earlier compiled v39 artifacts remain in use; no unchanged frontend build was requested. No generation retry, paid fallback, manual external publication or credential printout is part of this correction.

## Still external

The last scheduled daily generation stopped on model-route HTTP429 before creating today's pair; model capacity has not been re-probed by a manual retry. The owner completed the authorized Blogger loopback session: process exit0, a real refresh grant and access to the expected blog were verified, and fresh nonsecret result.json was read back. Blogger authorization is repaired; its next scheduled delivery still needs separate remote confirmation. Neither this repository repair nor a green CI run proves three consecutive autonomous article deliveries.
