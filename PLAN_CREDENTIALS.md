# 3. Что нужно для полной роботоспособности

## 🔴 Обязательно (без этого система не заработает реально)

| Что | Где получить | Зачем |
|-----|-------------|-------|
| `TG_API_ID` + `TG_API_HASH` | [my.telegram.org](https://my.telegram.org) → "API development tools" | Telethon: слушать чаты, публиковать посты, греть аккаунты |
| Аккаунты-доноры | Реальные Telegram аккаунты (номера телефонов) | warmup, posting, listening |

## 🟡 Важно (fallback работает, но полноценный функционал ограничен)

| Что | Где получить | Зачем |
|-----|-------------|-------|
| `DEEPSEEK_API_KEY` или `OPENAI_API_KEY` | [platform.deepseek.com](https://platform.deepseek.com) / [platform.openai.com](https://platform.openai.com) | Классификация лидов через LLM (сейчас keyword heuristic — работает, но хуже) |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | [dashboard.stripe.com](https://dashboard.stripe.com) | Реальные платежи (сейчас mock — план апгрейдится, но деньги не списываются) |

## 🟢 Опционально (nice-to-have)

| Что | Зачем |
|-----|-------|
| `YOOKASSA_SHOP_ID` + `YOOKASSA_SECRET_KEY` | Альтернативные платежи (Stripe не работает в РФ) |
| `WEBHOOK_SECRET` + URL n8n | Автоматическая обработка HOT/WARM лидов в n8n |
| `NEXT_PUBLIC_API_URL` | Если дашборд и API на разных доменах |

## Минимальный старт (без всего)
Система уже работает — keyword heuristic классифицирует, mock billing апгрейдит планы, дашборд отображает данные. Но реальные лиды не придут без Telegram API.
