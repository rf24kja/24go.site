# GitHub main reconciliation v41

The owner expressly authorized main promotion. The installed-release branch was fast-forwarded into main at `a5da69587d0cf3f780aaa57426c6ee0a9f496bc5`, without rewriting history. Remote references and actual main README/source files were read back. The first real main CI run was [41383628523](https://github.com/rf24kja/24go.site/actions/runs/41383628523): dashboard, worker and sidecar passed; backend and lint failed. A Vercel status/comment check was not substituted for these application checks.

## Confirmed root causes and bounded correction

- Lint found one unused module-level `time` import in accounts.py. The actually used function-local `time as _t` remains unchanged.
- Fresh Alembic installs lacked `tenant_vk_discovery_credentials`, although the registered VK discovery reader required it. Revision026 packages the existing separate SQL schema (tenant primary key/FK cascade, encrypted payload field, positive user identity, update timestamp). This is a source/bootstrap reconciliation, not permission to run migrations on production.
- The old VK test still expected missing discovery credentials to produce a false successful empty result. Its assertion now follows the already-installed explicit409 `vk_discovery_not_connected` contract and verifies no provider request. A real PostgreSQL schema test additionally exercises primary-key uniqueness, positive-user check, foreign-key denial and tenant deletion cascade.

The first backend run was51passed/1failed; its actual failure was UndefinedTableError, not a provider quota or live VK rejection. No actual account/provider connection was exercised.

## Runtime boundary

This CI/source correction is not a new installed API image. The production application remains v39; the host Blogger diagnostic script remains v40. The repository-only accounts cleanup removes an unused import and has no intended behavior change, but its bytes are not claimed to match the installed router. Revision026 was **not applied to production** and must not be slipped into a container restart: the existing backend Dockerfile runs `alembic upgrade head` at startup. Any production schema rollout requires its own reviewed, backed-up scope.

The existing CI workflow is the verifier for this corrected exact commit; report its actual result rather than calling a push green. Reuse earlier compiled v39 artifacts and receipts; no unchanged frontend build was requested. No generation retry, paid fallback, manual external publication or credential printout is part of this correction.

## Still external

Daily generation remains blocked by the observed model-route HTTP429. The owner authorized a fresh Blogger loopback consent session; starting that listener is not verified consent, a valid refresh grant, or delivery. Check its current nonsecret completion result separately. Neither this repository repair nor a green CI run proves three consecutive autonomous article deliveries.
