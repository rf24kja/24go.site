# Installed API delta v37 — lead references

Status: **installed**, not merely prepared. Frontend/WA-sidecar stay at their previous v29 versions; no worker, social connection or scheduler was replaced.

## Behavior

- Optional qualification references must belong to the authenticated tenant and requested platform. Invalid IDs are rejected before classification; missing/inaccessible references receive the same404 response.
- A lead detail's related target name is resolved within tenant and platform boundaries, including legacy inconsistent references.
- Unknown platform values are rejected before classification. All six pre-existing schema values are retained, including `forum`; this is not a claim of a forum integration.
- Manual classification without references remains supported. Existing viewer read-only behavior applies through JWT and explicitly supported API-key authentication.

`account_id` in this API references `account_pool`, as defined by the existing `leads.account_id` foreign key. A separate WA-sidecar account ID is not silently reinterpreted as an account-pool identity.

## Acceptance

Six unique registered-route methods passed against a disposable PostgreSQL16 on both candidate and packaged image. Fixtures cover two tenants, owner/admin/member/viewer, JWT/API-key behavior, valid own references, rejected inaccessible/missing/platform-mismatched references and target-name visibility. Classifier/provider boundaries are mocked; real DB constraints, queries and HTTP authentication execute. This is not the destructive installed backend test suite.

The exact image was tested without application-source overlays. Separate assertion-only failures were retained before each repair. A repository-export runner was also exercised against the exact installed image for the reference-denial contract.

## Installed artifact

- Image: `sha256:5cc3e590f5e048d82e4af4b4245fa4ff42eae5af7dac8e0eb971977fe0147a94`.
- Deployed router SHA256: `1489edf10c866dcbf747b8405552e6a9d8758d38dd7392bdaf5dc7bf33b337c7`.
- Git's existing text normalization stores the same router with LF: SHA256 `c93d96331907280d6529c5b8051c85b9b5e1abd0bf4dc79b1642613f9abaed8c`. This is an explicit line-ending-only export normalization; deployed bytes were not rewritten for Git.
- Only API service replaced; complete six-file Compose chain retained, canonical source backed up, rollback image retained.
- Independent readback confirmed image/source/public schema, API/database/Redis health, unauthenticated protection and unchanged sibling container IDs. No migration or production-data fixture ran.

## Remaining boundaries

This closes only this reference-ownership slice of W3. It does **not** establish complete object-family coverage, PostgreSQL RLS, atomic ownership revocation, live social delivery, billing or autonomous daily publishing. No existing customer references were read or repaired by these tests.

Regression harness: [verification/lead-ownership](../verification/lead-ownership/README.md). Broader exit criteria remain in [the completion plan](RELEASE_COMPLETION_PLAN.md).
