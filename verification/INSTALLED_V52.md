# Installed API v52 checkpoint

Installed image: sha256:6ceab556de20b77728dd51253d25123559fb4cc58fe68587eeb8fc63291a0fff.

This branch extends accepted installed v45/v46 with v48 account platform guards, v50 inactive campaign/UUID handling and v52 forgot-password Redis alias fix. Production bytes use mixed line endings; Git LF normalization does not alter production.

Exact-image registered-route disposable PostgreSQL acceptance: v48 five methods PASS; v50 six methods PASS; v52 four methods PASS. Provider/broker/SMTP/Redis boundaries are synthetic as applicable. Full object isolation, live provider delivery, real email and reset concurrency are not claimed.

Fixtures are exported under verification/reference-isolation, campaign-contract and auth-isolation. They must run only with a uniquely named disposable PostgreSQL Unix socket, synthetic settings, network-none read-only application container, and without installed destructive conftest or application lifespan. No production database/broker/environment/volumes. These fixture exports have not been rerun from this Git worktree; original exact-image receipts remain authoritative. Use the existing reviewed isolated runner pattern, never bare production pytest.

Acceptance-only v49/v51 additionally exercised lead/tenant/settings/contact/child-reference and invite/scoring/blog/auto-reply boundaries. No product code changed for those checks. Worker parity v47 is packaged, NOT installed; WA durable v34 is NOT installed. Restore v53 is synthetic tool acceptance, NOT production RPO/RTO. Frontend v54 is a candidate, NOT installed, and is deliberately excluded here. Main is unchanged. CI success is not implied by branch upload or Vercel preview.
