# Installed AI reply timeout repair v69

The complete `_generate_ai_reply` function previously returned None before HTTP because `httpx.Timeout(connect=5, read=20)` is invalid without a default or all four fields. Supply a 20-second default and 5-second connect timeout.

Offline command from repository root:

`python verification/ai-reply-timeout-v69/test_ai_reply_timeout.py services/worker/app/auto_reply.py`

The provider transport is mocked, no credentials or real messages are used. Baseline assertion fails; candidate and each exact listener/scanner/parser/FB image pass. This tests HTTP request construction and response handling, not real AI/provider delivery or the entire auto-reply lifecycle.

Only `/app/app/auto_reply.py` differs in those four role images; complete Python source manifests compared. API, poster, Beat, YT and frontend remain unchanged. Original listener/scanner task IDs and session mounts are preserved. Existing poster/YT copies have the same latent timeout defect but no established active caller in this release; they were not replaced.

Product export explicitly normalizes runtime CRLF to Git LF. No main merge, force push or CI-success claim.
