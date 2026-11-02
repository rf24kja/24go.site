# Installed API v45/v46 source synchronization

Release branch only; main is not promoted. No application build, deployment,
migration, worker, scheduler or provider action is part of this synchronization.

Installed API v46: `sha256:05c39becc39f5f757c51679633d5bb94b2fc51ffef983ebac74c89fbdd8dc437`.
v45 added tenant ownership before warmup dispatch and UUID validation/canonicalization.
v46 validates campaign ownership before contact assignment. Only tasks.py and
phone_parser.py are synchronized as product files.

## Reproduce (Docker access required)

From any directory, invoke either module-relative runner:

```
python3 verification/object-isolation/run.py [local-image-id]
python3 verification/shared-isolation/run.py [local-image-id]
```

Default is the exact installed v46 image; no pull/build is performed. Runners import
actual packaged modules, not source substitutes. Each creates its own network-none
PostgreSQL16 tmpfs fixture with a unique Unix socket, then a read-only network-none
API container with explicit synthetic settings and mocked provider/Celery boundaries.
No installed tests/conftest.py or application lifespan is invoked. Cleanup removes
only its uniquely named fixture; logs/receipts live in a newly created temporary
directory outside the repository. Requires locally available postgres:16-alpine
and the specified API image. No production DB/broker volumes or env files are used.

Accepted original exact-image receipts: v45 object suite 7 methods PASS (exit0),
v46 shared suite 6 methods PASS (exit0), both without product overlays. These are
existing installed acceptance results, not a newly executed portable-runner result.
Portable files parse successfully; fresh execution requested through the scoped
privileged helper is pending execution approval. No new GREEN result is claimed.
Full W3, PostgreSQL RLS and live providers remain outside these bounded contracts.
Shared suite emitted ResourceWarnings despite successful unittest completion.

## Source provenance and line endings

Working product copies preserve installed bytes. Git attributes normalize CRLF to
LF during staging; the explicit hashes below distinguish the two representations.

- `tasks.py` installed SHA256 `dd0e5440cf1a04fb2002588e31a0d6c9ed409904df96822d1d8346df620079c1`; Git-LF SHA256 `9db80d0c57f631373a01b4312efa1835e8431c42476005f4fb71010d51489d98`.
- `phone_parser.py` installed SHA256 `664c9a8147700b01dca4856944135992163e37a500e5f51d7baf4cecba12200a`; Git-LF SHA256 `069eb8f686a88495165fcdae299d64bf35bcd45e5c94de1ddafac8a85d4d6fc0`.

Local source evidence: dev-runs/object-isolation-v45 and
shared-isolation-v45 MANIFEST.json, receipts/exact.json, and
INDEPENDENT_READBACK.json. Those candidate-era manifests contain historical
not-installed status text; post-install readback and CURRENT_RELEASE are the
installation authority. Frontend branding provenance, worker parity and other
unreconciled service deltas are not silently included in this branch.

Existing Actions workflows trigger on main pushes or PRs to main, not this release
branch. Check exact SHA Actions/check-run APIs after publication; lack of runs is
not CI success. This branch is neither a main merge nor a deployment.
