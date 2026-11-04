# Installed TG scheduler v68

Worker-poster image `sha256:7754c2c872fd60bff08985cfbf334a5085a17eeed6a5f83df3933580bfc37d58`, derived from installed v66. Only campaign_scheduler.py changed in the complete application/Alembic manifest; v65 mailing lock, v66 poster SDK/eventloop fixes and all scoped service readers preserved.

Manual-only campaigns no longer enter scheduled dispatch. Concurrent due dispatch uses atomic Redis SET NX with a 300-second expiry; lock failure skips rather than sends. Lock admission follows cron eligibility. This is bounded concurrent-dispatch protection, not a DB/broker transaction, crash-safe exactly-once transport or live-provider acceptance.

Installed after fresh empty active/reserved/scheduled/queued/unacked inspection, through all nine effective Compose files. Only worker-poster container replaced; same mounts, command and queue. APIv64, frontendv67, Beat and other siblings preserved. Independently read back full source manifest, actual task registry, public DB/Redis health and frontend BUILD `a-RGCt66fke1VhhJ11-vl`.

Acceptance: actual v66 baseline has three assertion failures (manual-only, concurrent double enqueue, Redis failure-open). Candidate and exact packaged worker image pass eight scheduler contracts using real disposable PostgreSQL16 and mocked broker/Redis/settings, network disabled. Current exact APIv64 registered JWT/ORM producer passes create→read→manual run→disable→run denial→soft-delete persistence and foreign-tenant denial with a mocked broker. Exported same8+1 pass (not additive cases). Initial fixture diagnostics retained separately; no whole suite claim.

Tests here are isolated harness inputs, not production fixtures. Run only in network-none disposable images with an empty synthetic PostgreSQL database `fixture` on Unix socket `/fixture`, never a production DSN. Source evidence and bounded launcher: project `dev-runs/tg-functional-v68/{run.py,run_export.py,receipts,INSTALLED.json,INSTALLED_READBACK.json,MANIFEST.json}`. No provider sends/joins/reconnect/customer writes. Canonical scheduler baseline-guarded/backed up/read back separately; whole API/worker source rebuild or repository parity NOT asserted.

Next finite engineering stage: existing autoreply matching/rotation/AI→DM outcome, then monitoring→lead lifecycle. External authorized TG recipient/group still absent, separately tracked; Google invalid_grant is unrelated.
