# Changelog

All notable changes to 24GO are documented here.

## [0.4.0] — 2026-09-16

### Added
- Privacy Policy page (EN/RU)
- Terms of Service page (EN/RU)
- Cookie consent banner (GDPR)
- Sentry error tracking (dashboard)
- Structured JSON logging (backend)
- Prometheus metrics endpoint (`/metrics`)
- Unit tests for auth (CI)
- pytest in GitHub Actions CI
- PWA manifest
- Architecture documentation
- 404 page
- Dashboard loading skeleton
- Health endpoint: `api_version` + `uptime_seconds`

### Security
- `.env.template` cleaned (secrets removed)
- ENCRYPTION_KEY required in production
- Password complexity validation (uppercase+lowercase+digit)
- JWT `iat` + `aud: "24go"` claims
- Cross-tenant audit leak fixed
- Error messages sanitized (6 files)
- Balance credit race condition fixed
- SQL injection whitelist
- Security headers middleware
- Rate limiting on /forgot-password
- API key hashing: SHA-256 → PBKDF2

## [0.3.3] — 2026-09-09

### Added
- VK full integration (listener, poster, scanner, comment scraper)
- Anti-ban module (atomic Lua rate limiter, warmup, proxy rotation)
- VK comprehensive i18n (2831 keys EN/RU)
- Glassmorphism 3D charts
- Mailing read tracking
- Platform filtering (TG/VK toggle)
- PlatformContext (React)
- Free tools (ROI calculator, group analyzer, account checker)
- 5 integration pages + 3 tutorials (EN/RU)
- 89 blog articles
- SEO: RSS, canonical, OG, JSON-LD, sitemap, robots.txt
