# 1. Что сделано

## Инфраструктура (11 контейнеров)
- PostgreSQL 16 (порт 5434) с RLS на 12 таблицах
- Redis 7 — брокер Celery + кэш квот
- FastAPI — 30 API эндпоинтов
- Celery — 5 воркер-пулов (parser/poster/warmup/listener/billing) + Beat-планировщик
- Next.js 14 дашборд (порт 3000)

## Бэкенд (30 эндпоинтов)
- **Auth**: register, login, JWT, RLS middleware
- **CRUD**: tenants, targets, accounts, campaigns, leads (с фильтрами)
- **Orchestration**: dispatch в parser/poster/warmup через `celery.send_task()`
- **Lead Management**: classify (LLM + keyword fallback), upsert, n8n webhook для HOT/WARM, bulk status, CSV export
- **Billing**: subscription, usage, checkout (Stripe/YooKassa mock), webhook для апгрейда плана
- **Analytics**: funnel, geo breakdown, time-series, token/cost stats
- **Listeners**: start/stop/status для Telethon
- **Campaign Scheduler**: Beat каждые 30 мин → poster worker

## Дашборд (8 страниц)
- **Login/Register** — JWT авторизация
- **Analytics** — AreaChart (линии), BarChart (funnel), PieChart (intent), горизонтальный BarChart (geo), метрики стоимости
- **Leads** — Table + Kanban drag-and-drop (4 колонки), qualify-форма, фильтры по intent
- **Targets** — таблица + scan-discovery через parser worker
- **Accounts** — warmup progress bars, daily quota, listener Start/Stop кнопки со статус-индикатором
- **Campaigns** — карточки + create modal со spintax
- **Billing** — subscription status, usage, plan cards со Stripe checkout redirect

## Ключевые решения
- `asyncpg` не принимает `+asyncpg` схему → stripped
- `metadata` — reserved в SQLAlchemy → `meta_info`
- Cyrillic кодировка: работает когда текст приходит целым
- `app.tasks/__init__.py` с явными импортами для autodiscover
- LLM fallback на keyword heuristic когда API key = placeholder
