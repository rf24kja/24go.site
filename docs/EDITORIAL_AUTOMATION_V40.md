# Editorial cron v40 — installed diagnostics; autonomy still blocked

Observed 2026-11-02, Asia/Bangkok. This is a narrow host-automation release, not a new API/frontend image and not evidence of a fully autonomous publishing service.

## Actual scheduler and pipeline state

| Stage | Actual result | Remaining condition |
|---|---|---|
| Daily research/author/review cycle, 09:00 Bangkok | Today's scheduled attempt failed with `HTTP 429: The usage limit has been reached`; zero new pairs and no day claim | Available capacity on the existing approved model/provider route; no repeated failed canary, paid fallback or model substitution |
| Primary CMS publisher, every 5 minutes | Scheduled normally; no ready drafts. Separate read-only native CMS probe verified existing owner authority | A genuinely accepted, fresh, exact-version RU/EN pair with browser QA/admission |
| Pending editorial pair | One pair remains `review`/`review`; not promoted or published | Independent acceptance, not an operator status override |
| Syndicator, every hour | One existing article remains incomplete for Blogger. Its DEV and Telegraph checkpoints are retained | Blogger authorization; no manual external publishing was invoked |
| Blogger maintenance, every 15 minutes | First normal scheduled execution of installed v40 returned the actual `400 invalid_grant` | Owner-mediated OAuth consent/settings repair; no password, refresh token or callback code in chat |

Public inventory was read completely: 106 unique article slugs. An empty publisher queue or a scheduler `ok` is not proof that today's article was generated or delivered. Public creation timestamps are not publication-time evidence.

## Installed correction

`automation/scripts/refresh_blogger_token.py` mirrors the installed host script:

- Validate Blogger access with the documented read-only `blogs.listByUser` endpoint and an Authorization header, never an access token in a URL query.
- Preserve actual HTTP status and allowlisted OAuth error codes. Network errors and server errors no longer become a fabricated `401 unauthorized_client` or an unsupported client-mismatch claim.
- Never log raw provider descriptions or credential values; close HTTP error responses.
- Refer rejected grants to the prepared loopback OAuth helper, not the legacy manual/OOB flow.
- Preserve the existing token-return contract and nonzero failure exit. No credential repair, change of account, OAuth consent, or publication was performed by the installation/tests.

Four regression cases failed on the original script; the existing success-return contract passed. All five pass on the candidate and installed script, with portable export verification documented separately. A response-closure assertion was also proven red before its fix. The installed script was additionally exercised by the ordinary scheduler: its 10:16 Bangkok failure accurately identified `400 invalid_grant`. This is live diagnostic adoption, **not** successful authorization or delivery.

## GitHub versus deployment

The application remains on installed v39 API/frontend images. Production runs on the VPS, not GitHub Pages. After this report, the owner expressly authorized the release branch's fast-forward into main; remote references and main content were verified. The first actual main CI exposed two source/bootstrap issues addressed in [v41](GITHUB_RECONCILIATION_V41.md). This is not full repository/runtime reconciliation or a claim of green CI or a new VPS deployment. The legacy Vercel snapshot deployment job remains paused; no VPS deploy-on-push was enabled.

## Closure gates

1. Restore capacity on the existing approved author/editor/verifier route; then observe the next ordinary scheduled cycle, without repeating the quota-failed canary.
2. Restore Blogger through the approved interactive OAuth path. Preserve existing platform checkpoints and reconcile before any external write.
3. Verify three consecutive scheduled independently accepted RU/EN deliveries with exact public body/archive/sitemap readback, plus per-target syndication results.
4. Complete source/runtime reconciliation and exact-commit CI before treating the release branch as a fully reproducible default-branch release. Merge requires its own authorized workflow.

Schedules, publication enablement, models, review policy and rejected draft states were not changed. No fresh generation or manual CMS/social publication was launched. The local machine-readable receipts remain outside the repository under `dev-runs/editorial-cron-v40/`: `INSTALL_RECEIPT.json`, `AUTOMATION_CURRENT.json`, and the candidate/installed test logs.
