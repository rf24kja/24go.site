# 2. Что надо сделать

## Высокий приоритет
- **Telegram Listeners**: полноценный Telethon daemon (слушает чаты, парсит сообщения, передаёт в lead pipeline). Инфраструктура готова, не хватает `TG_API_ID` + `TG_API_HASH`
- **Campaign Posting**: реальная публикация через Telethon (poster worker). Инфраструктура готова, нужен аккаунт с Telegram API
- **Account Warmup**: реальный прогресс (текущий warmup Stage 0→3 увеличивает `daily_action_limit`). Worker готов, нужен Telegram API

## Средний приоритет
- ~~Real-time updates~~: ✅ WebSocket + HTTP polling fallback (Vercel compatible)
- ~~Telegram Bot~~: ✅ /start /qualify /status /leads + conversation flow
- ~~Rate limiting~~: ✅ Redis sliding window per tenant
- ~~Связка с n8n~~: ✅ webhook secret, HMAC signature, test endpoint
- ~~CSV Export UI~~: ✅ + Import + Kanban + Real-time WebSocket
- ~~Scoring Rules~~: ✅ Custom rules + keyword heuristic + DB persistence
- ~~Lead Pipeline~~: ✅ Custom rules → LLM → keyword fallback chain
- ~~Billing~~: ✅ Stripe + YooKassa + webhook verification + idempotency

## Низкий приоритет
- A/B тестирование spintax вариантов
- Multi-language support (i18n)
- ~~Audit log~~: ✅ Full audit trail with entity_type filter
- ~~Dark/Light theme~~: ✅ Dark theme (zinc-950)
- ~~Mobile-responsive~~: ✅ Hamburger menu + responsive sidebar

## Deployment
- ✅ Vercel config (`vercel.json`)
- ✅ GitHub Actions CI/CD (`.github/workflows/ci.yml`)
- ✅ Landing page for 24go.site
- ✅ CORS whitelist for 24go.site
- ⬜ Push to `github.com/rf24kja/24go.site`
- ⬜ Connect Vercel to repo
- ⬜ Set env `NEXT_PUBLIC_API_URL` in Vercel
- ⬜ Configure DNS: `A 24go.site → 76.76.21.21`
- ⬜ Deploy backend on VPS via `docker compose up -d`
