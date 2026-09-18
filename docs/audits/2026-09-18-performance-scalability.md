# Аудит 2: Производительность и масштабируемость — Отчёт

**Дата:** 2026-09-18
**Статус:** Завершён

## Критические проблемы (2)

| ID | Проблема | Влияние | Решение |
|----|----------|---------|---------|
| P0-1 | N+1 в `campaign_scheduler.py` | 400-2000 запросов каждые 5 мин | Batch query + JOIN |
| P0-2 | `quota.py` открывает новое соединение на каждый вызов | Исчерпание соединений | Использовать shared pool |

## Важные проблемы (3)

| ID | Проблема | Влияние | Решение |
|----|----------|---------|---------|
| P1-1 | Нет Redis connection pooling | Connection churn | Shared aioredis instance |
| P1-2 | VK LongPoll использует sync httpx | TCP churn, ~4 conn/s | Persistent client |
| P1-3 | Нет индекса на `posting_logs.campaign_id` | Медленные запросы scheduler | Добавить индекс |

## Средние проблемы (5)

| ID | Проблема | Решение |
|----|----------|---------|
| P2-1 | Health check создаёт Redis conn на каждый запрос | Reuse existing Redis |
| P2-2 | Нет лимита WebSocket connections | Per-tenant cap |
| P2-3 | Нет кэша для `get_subscription_plan()` | Redis cache |
| P2-4 | Stripe/YooKassa без timeout | Добавить explicit timeout |
| P2-5 | Analytics запускает запросы последовательно | `asyncio.gather()` |

## Минорные проблемы (3)

| ID | Проблема | Решение |
|----|----------|---------|
| P3-1 | `search_cache` / `usage_logs` растут бесконечно | Periodic cleanup job |
| P3-2 | `SELECT *` в mailer | Select specific columns |
| P3-3 | Listener tasks блокируют worker thread | Separate listener pool |

## Redis Usage

| Purpose | Status |
|---------|--------|
| Rate limiting | ✅ Working |
| Quota cache | ⚠️ No shared pool |
| Celery broker | ✅ Working |
| Event dedup | ✅ Working |
| Daily action limits | ✅ Working |
| Account locks | ✅ Working |

## Database Performance

| Metric | Status |
|--------|--------|
| Connection pool | ✅ 20+10=30 max |
| N+1 queries | ❌ campaign_scheduler critical |
| Missing indexes | ⚠️ posting_logs.campaign_id |
| SELECT * | ⚠️ mailer.py |
| Pagination | ✅ Most endpoints |

## WebSocket Scalability

| Aspect | Status |
|--------|--------|
| Single-process | ⚠️ In-memory only |
| Connection limits | ❌ None |
| Event buffer | ✅ deque(50) per tenant |
| Horizontal scaling | ❌ Needs Redis pub/sub |

## Memory Usage

| Risk | Status |
|------|--------|
| Connection churn | ⚠️ quota.py, lead_pipeline.py |
| Unbounded lists | ⚠️ campaign_scheduler loads all |
| Event buffer | ⚠️ 500MB with 10K tenants |
| Generally clean | ✅ Proper cleanup |

## Disk Usage

| Aspect | Status |
|--------|--------|
| Logging | ✅ stdout only |
| Session files | ✅ In DB |
| Temp files | ✅ In-memory |

## External API Calls

| API | Timeout | Retry | Status |
|-----|---------|-------|--------|
| LLM | ✅ 15s | ✅ Fallback | Good |
| Telegram | ⚠️ No timeout | ⚠️ No retry | Needs fix |
| VK | ⚠️ Sync per poll | ⚠️ No retry | Needs fix |
| Stripe | ❌ No timeout | N/A | Add timeout |
| YooKassa | ❌ No timeout | N/A | Add timeout |

## Приоритеты исправления

1. **Немедленно:** P0-1 (N+1), P0-2 (connection per call)
2. **На этой неделе:** P1-1 (Redis pool), P1-2 (VK client), P1-3 (index)
3. **В этом месяце:** P2-1 through P2-5
4. **Когда будет время:** P3-1 through P3-3
