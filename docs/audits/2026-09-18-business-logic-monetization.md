# Аудит 3: Бизнес-логика и монетизация — Отчёт

**Дата:** 2026-09-18
**Статус:** Завершён

## Критические проблемы (2)

| ID | Проблема | Влияние | Решение |
|----|----------|---------|---------|
| B1 | Лимиты постов и токенов **не применяются** | Пользователи могут постить бесконечно | Вызвать `record_post()` и `record_usage()` в воркерах |
| B2 | `deduct_balance()` имеет TOCTOU race condition | Баланс может уйти в минус | Использовать атомарный SQL |

## Важные проблемы (3)

| ID | Проблема | Решение |
|----|----------|---------|
| B3 | Stripe checkout создаёт новый Price на каждую сессию | Использовать Price IDs |
| B4 | Нет self-service cancellation endpoint | Добавить `POST /billing/cancel` |
| B5 | Нет invoice/receipt generation | Добавить генерацию и скачивание |

## Средние проблемы (4)

| ID | Проблема | Решение |
|----|----------|---------|
| B6 | Upgrade сбрасывает текущий период | Добавить prorating |
| B7 | Нет data retention после cancellation | Добавить cleanup task |
| B8 | Нет downgrade path | Добавить downgrade flow |
| B9 | Campaigns/mailings без лимитов по тарифу | Добавить limits |

## Минорные проблемы (3)

| ID | Проблема | Решение |
|----|----------|---------|
| B10 | Trial 14 дней (не 3) | Обновить документацию |
| B11 | Нет MRR/churn/LTV analytics | Добавить endpoints |
| B12 | `target_name` в analytics.py не существует | Исправить |

## Subscription Plans

| Plan | Price | Posts | Tokens | Accounts | Targets |
|------|-------|-------|--------|----------|---------|
| trial | Free | 100 | 100K | ∞ | 10 |
| starter | $25 | 1,500 | 1M | ∞ | 50 |
| pro | $75 | 7,500 | 5M | ∞ | 100 |
| enterprise | $300 | ∞ | ∞ | ∞ | ∞ |

## Quota Enforcement

| Limit | Defined | Enforced |
|-------|---------|----------|
| Account count | No (removed) | No |
| Target count | Yes | ✅ Yes |
| Campaign count | No | No |
| Monthly posts | Yes | ❌ NOT wired |
| Token credits | Yes | ❌ NOT wired |
| Daily account actions | Yes | ✅ Yes |

## Stripe Integration

| Feature | Status |
|---------|--------|
| Checkout | ⚠️ Creates new Price per session |
| Webhooks | ✅ Signature verified |
| Subscription lifecycle | ⚠️ No upgrade/downgrade sync |
| Payment failure | ✅ Logged |
| Proration | ❌ Not implemented |

## YooKassa Integration

| Feature | Status |
|---------|--------|
| Payment creation | ✅ With idempotency |
| Webhook verification | ✅ Callback verification |
| Configured | ⚠️ Needs env vars |

## Balance System

| Aspect | Status |
|--------|--------|
| Top-up | ✅ Stripe one-time checkout |
| Atomic credit | ✅ ON CONFLICT DO UPDATE |
| Atomic deduct | ❌ TOCTOU race condition |
| Usage | TgStat API queries |

## Trial Period

| Aspect | Status |
|--------|--------|
| Duration | 14 days (not 3) |
| Auto-creation | ✅ On first access |
| Expiration | ✅ Daily Celery task |
| Email sequence | ✅ 4 emails |
| Bypass risk | ⚠️ New tenant = new trial |

## Revenue Metrics

| Metric | Available |
|--------|-----------|
| MRR | ❌ Not exposed |
| Churn rate | ❌ Not tracked |
| LTV | ❌ Not calculated |
| Payment history | ✅ In DB |
| Usage tracking | ✅ In DB |

## Приоритеты исправления

1. **Немедленно:** B1 (wire quota enforcement), B2 (atomic deduct)
2. **На этой неделе:** B3 (Stripe Price IDs), B4 (cancel endpoint), B5 (invoices)
3. **В этом месяце:** B6-B9
4. **Когда будет время:** B10-B12
