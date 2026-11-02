# Crawl / sitemap regression checks

Frontend artifact contracts are in `services/dashboard/src/__tests__/crawl-policy.test.ts`, alongside existing canonical-sitemap and blog-freshness tests. Run the affected files through the dashboard's established Vitest toolchain; production builds retain Next's default type validation.

`test_public_dates.py` tests the actual registered public blog endpoint's timestamp serialization in RU/EN. It imports the application from a reviewed backend image and overrides only its DB dependency with synthetic query results. It is not a PostgreSQL storage test or a provider integration test.

Never import this harness on a production-configured host or run the installed backend `tests/conftest.py`. Use an isolated Docker container with the existing application dependencies, no network, no production volumes, synthetic settings and no application lifespan. From the repository root, a Linux Docker operator can run:

```bash
docker run --rm --pull never --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges --memory 512m --cpus 1 --pids-limit 128 \
  --tmpfs /tmp:rw,noexec,nosuid,size=32m --workdir /tmp \
  -e PYTHONDONTWRITEBYTECODE=1 -e PYTHONPATH=/app \
  -e ENVIRONMENT=test -e APP_ENV=test -e JWT_SECRET=synthetic-crawl-fixture-only \
  -e DATABASE_URL=postgresql+asyncpg://fixture:fixture@127.0.0.1:1/fixture \
  -e REDIS_URL=redis://127.0.0.1:1/15 -e CELERY_BROKER_URL=memory:// -e SENTRY_DSN= \
  -v "$PWD/verification/crawl-seo:/harness:ro" \
  YOUR_LOCAL_REVIEWED_BACKEND_IMAGE python /harness/test_public_dates.py
```

The image must be pre-provisioned locally and expose its application at `/app/app`. The real accepted image identity and public acceptance boundary are in [installed v39](../../docs/INSTALLED_RELEASE_V39.md); no public container-registry availability is implied. No real credentials or `.env` are required.
