# Аудит 1: Безопасность и комплаенс — Отчёт

**Дата:** 2026-09-18
**Статус:** Завершён

## Критические проблемы (4)

| ID | Проблема | Файл | Решение |
|----|----------|------|---------|
| C1 | Реальный OpenAI ключ в `.env`, placeholder JWT_SECRET | `.env` | Ротировать ключи, генерировать реальные секреты |
| C2 | Нет JWT revocation / refresh tokens | `security.py` | Добавить blacklist в Redis или refresh token flow |
| C3 | PostgreSQL RLS policies не созданы | SQL файлы | Создать `CREATE POLICY` для всех tenant-таблиц |
| C4 | Raw asyncpg обходит RLS middleware | `tenant_settings.py` | Перейти на SQLAlchemy sessions везде |

## Важные проблемы (7)

| ID | Проблема | Файл | Решение |
|----|----------|------|---------|
| I1 | Password reset tokens без audience | `security.py` | Добавить audience на все токены |
| I2 | Rate limiter fails open при падении Redis | `rate_limiter.py` | Fail-closed на auth endpoints |
| I3 | Нет спецсимвола в пароле | `schemas.py` | Добавить требование спецсимвола |
| I4 | Hardcoded owner email | `audit.py` | Перенести в конфиг или role |
| I5 | `allow_methods=["*"]` в CORS | `main.py` | Ограничить методы |
| I6 | Удаление аккаунта неполное | `tenant_settings.py` | Добавить role check + полное удаление |
| I7 | WebSocket JWT без audience | `main.py` | Добавить audience validation |

## Минорные проблемы (6)

| ID | Проблема | Файл |
|----|----------|------|
| M1 | API key preview только 8 символов | `tenant_settings.py` |
| M2 | Undefined variable `tables` в system_info | `system.py` |
| M3 | Encryption no-op без ключа | `crypto.py` |
| M4 | Temp password в plaintext через email | `auth.py` |
| M5 | `hmac.new` вместо `hmac.HMAC` | `system.py` |
| M6 | Нет CSP заголовка | `main.py` |

## OWASP Top 10

- A01 Broken Access Control: ✅ Хорошо
- A02 Cryptographic Failures: ✅ Хорошо
- A03 Injection: ✅ Хорошо (parameterized queries)
- A04 Insecure Design: ✅ Хорошо
- A05 Security Misconfiguration: ✅ Хорошо
- A06 Vulnerable Components: ⚠️ Проверить npm audit
- A07 Auth Failures: ✅ Хорошо
- A08 Data Integrity: ✅ Хорошо (webhook signatures)
- A09 Logging Failures: ✅ Хорошо
- A10 SSRF: ✅ Хорошо

## GDPR Compliance

- Privacy Policy: ✅ Полная (12 секций)
- Cookie Consent: ✅ Работает
- Data Export: ✅ Реализован
- Data Deletion: ⚠️ Неполное (нет audit_log, billing_transactions)
- Consent Recording: ❌ Не реализовано
- DPA с third-party: ⚠️ Не проверено

## Payment Security

- Stripe: ✅ Безопасно (webhook signature, server-side amounts)
- YooKassa: ✅ Безопасно (callback verification)
- Idempotency: ✅ Реализовано
- Refund Flow: ❌ Не реализован
- File Upload: ⚠️ Нет size limit на bulk-import

## Итого

| Категория | Количество |
|-----------|------------|
| Критические | 4 |
| Важные | 7 |
| Минорные | 6 |
| **Всего** | **17** |

## Приоритеты исправления

1. **Немедленно:** C1 (ротация ключей), C4 (RLS policies)
2. **На этой неделе:** C2 (refresh tokens), C3 (RLS), I2 (fail-closed)
3. **В этом месяце:** I1, I3, I4, I5, I6, I7
4. **Когда будет время:** M1-M6
