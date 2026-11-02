# Installed editorial queue selector v43

The daily full-cycle instruction now invokes `automation/scripts/statejnik_delivery_queue.py` instead of leaving queue selection to prose interpretation alone. The installed helper and exported source are byte-identical.

## Contract

- Read the owning profile's configured work tree and explicit native24go publication scope. A disabled publication target or wrong origin fails closed.
- Consider only complete, explicitly scoped `review`/`review` pairs with matching slug and RU/EN locale identity. Published pairs and explicitly foreign-site pairs are not selected. Mixed/incomplete pairs and symlinked inputs are blocked.
- Check timezone-aware creation dates, both7000-character body limits, real independent-review evidence, freshness, hashes and raw-plan replay through the existing `editorial_gate`.
- Inspect each candidate independently: an older rejected pair must not starve a newer accepted pair. Sort genuinely eligible pairs by creation instant normalized to UTC, then slug.
- Return `selected`, `eligible`, individual `blocked` entries, acceptance digest and exact source digests. Recheck source bytes after validation to detect concurrent changes during selection.
- `selected` means **ready for the subsequent render/browser/admission checks**, not already approved for publication. Native admission and CMS gates must revalidate before use.

The helper does not invoke models, contact providers or CMS, create cron jobs, modify articles/statuses, write config, consume a daily claim, or supply acceptance. The ordinary daily job reads its JSON before choosing a candidate and reads it again after a permitted repair; it may not manufacture a path from a directory name or reuse stale output.

## Actual installation verification

Five offline contracts passed on candidate, installed and portable-export code using the actual evidence gate and synthetic model transports:

1. Old rejected/no-acceptance pair does not block a newer accepted pair; article/evidence bytes remain unchanged.
2. Oldest accepted pair is chosen by timestamp instant, not folder order or timezone spelling.
3. Changed content cannot reuse prior acceptance.
4. Published, foreign, mixed, incomplete and symlinked inputs are not promoted.
5. Disabled or wrong-origin target configuration fails closed.

The initial regression failed because there was no executable selector. A live read-only run returned no currently accepted pending candidate and one separate blocker for the older `telegram-bot-429-notification-recovery` pair (`FileNotFoundError` in its evidence gate). The already delivered allowed_updates article was not re-enqueued or republished. Empty current selection is not failure to deliver an eligible new article.

No fresh generation, model retry, article publication, schema change, container restart, credential change or schedule/model change was performed for this package. The explicit SOL09:00Bangkok full-cycle job remains the owner of normal daily execution. This package makes queue selection executable; it does not prove three consecutive successful scheduled cycles or repair the old article's substantive acceptance.

## Operator command

On the owning VPS/profile:

```
python3 /home/hermes-admin/.hermes/scripts/statejnik_delivery_queue.py --config /home/hermes-admin/.hermes/skills/statejnik/config.yaml --work-dir /home/hermes-admin/.hermes/skills/statejnik/work
```

The source export mirrors scripts and skills layout, but a clone contains no credentials, live config or publication authority. Offline test from repository root:

```
python verification/editorial-queue/test_queue.py
```

The existing credential-free editorial Actions workflow now runs these contracts alongside patch-recovery contracts. Report its exact commit result separately from local execution. Local private receipts are under `dev-runs/editorial-queue-v43/`, including INSTALL_RECEIPT.json, LIVE_QUEUE.json and INSTALLED_TESTS.log; no article or provider response bodies are exported.
