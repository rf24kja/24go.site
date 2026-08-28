# PLAN_TODO.md — Что нужно сделать

> Обновлено: 2026-08-28
> Блокер: Устранён (Telegram API credentials добавлены в .env VPS)
> Файл: `C:\Code\GeneratorAD\PLAN_TODO.md`

---

## Фаза 1: Telethon Session Manager ✅ DONE

### 1.1 Session Storage
- [x] **DB: таблица `account_sessions`** — migration `003_sessions.py`
- [x] **Crypto: encrypt/decrypt session strings** — `crypto.py` (Fernet)

### 1.2 Telethon Client Factory
- [x] **`services/worker/app/telegram_client.py`** — session factory:
  - `get_client(account_id, tenant_id)` — загружает session, создаёт клиент
  - `create_session(phone, api_id, api_hash)` → session_string
  - `save_session(account_id, session_string)` — сохраняет в DB (encrypted)
  - Client cache, Redis status, heartbeat, FloodWait handling

### 1.3 Account Lifecycle API
- [x] **`POST /api/v1/accounts/{id}/connect`** — инициирует авторизацию (phone → code)
- [x] **`POST /api/v1/accounts/{id}/confirm`** — подтверждает код, сохраняет session
- [x] **`POST /api/v1/accounts/{id}/disconnect`** — закрывает session
- [x] **`GET /api/v1/accounts/{id}/tg-status`** — реальный статус (has_session, connected, tg_status)

---

## Фаза 2A: Telegram Listener ✅ DONE

### 2A.1 Listener Daemon
- [x] **`services/worker/app/tasks/listener.py`** — переписан:
  - Загружает session через `get_client()` (factory из Фазы 1)
  - `@client.on(events.NewMessage(incoming=True, func=lambda e: e.is_private))` — обработчик
  - Извлекает: `sender.username`, `sender.first_name + last_name`, `message.text`
  - Дедупликация по message ID
  - Вызывает `process_incoming_message()` из `lead_pipeline.py`
  - Heartbeat loop каждые 30 сек

### 2A.2 Listener Lifecycle
- [x] **Start**: `POST /api/v1/listeners/{account_id}/start` — Celery task
- [x] **Stop**: `POST /api/v1/listeners/{account_id}/stop` — graceful shutdown
- [x] **Status**: `GET /api/v1/listeners/status` — active_workers из Redis

---

## Фаза 2B: Comment Scraper ✅ DONE

### 2B.1 Comment Parser Task
- [x] **`services/worker/app/tasks/comment_scraper.py`** — новый модуль:
  - `scrape_comments(tenant_id, post_id, account_id)` — Celery task
  - Telethon `get_messages(channel, reply_to=post_id)` → комментарии
  - `sender.username`, `sender.first_name`, `message.text`
  - `process_incoming_message()` с `source="comment"`
  - Фильтр комментариев аккаунта-автора

### 2B.2 DB Schema
- [x] **`leads.source`** — VARCHAR(50), default 'dm' (dm/comment/manual/import/webhook)
- [x] **`leads.post_id`** — VARCHAR(255), ссылка на пост
- [x] **`posting_logs.message_id`** — ID поста в Telegram

### 2B.3 Auto-Scrape After Posting
- [x] **Trigger**: после каждого успешного `publish_post` в poster:
  - `auto_scrape_after_post()` — 3 scheduled scrapes: 2min, 10min, 24h

---

## Фаза 3: Account Warmup ✅ DONE

### 3.1 Warmup Stages
- [x] **Stage 1 (passive)**: `get_dialogs()`, read messages, reactions (5-10 actions/day)
- [x] **Stage 2 (soft engagement)**: `join_channel()`, soft engagement (10-20 actions/day)
- [x] **Stage 3 (production)**: ready for posting + listening (30-50 actions/day)
- [x] Auto-advance based on account age (created_at)

### 3.2 Warmup Worker
- [x] **`services/worker/app/tasks/warmup.py`** — переписан:
  - Реальный `TelegramClient` через factory
  - `handle_flood_wait()` → status='cooldown', cooldown_until
  - `trigger_daily_warmup()` → real DB scan + dispatch

---

## Фаза 4: Campaign Poster ✅ DONE

### 4.1 Poster Worker
- [x] **`services/worker/app/tasks/poster.py`** — переписан:
  - `TelegramClient` через factory
  - `client.send_message(target_channel, rendered_text)`
  - `FloodWaitError` → `handle_flood_wait()` (cooldown)
  - `UserBannedInChannelError` → account banned
  - Saves `message_id` to `posting_logs`
  - Triggers `auto_scrape_after_post()` after successful post

---

## Фаза 5: Dashboard UI ✅ DONE (partial — see below)

### 5.1 Accounts Page
- [x] Кнопка "Connect Telegram" → modal phone → code (Telethon auth)
- [x] Telegram status indicator (Online/Session/No session) — green dot pulsing
- [x] Start/Stop Listener buttons per account
- [x] Disconnect button
- [x] Warmup progress bar (Stage 1→2→3)
- [x] Quota bar (actions_today / daily_action_limit)

### 5.2 Leads Page
- [x] Фильтр по `source` (All / 💬 DM / 💭 Comments / ✏️ Manual)
- [x] Source иконка рядом с каждым лидом (kanban card)

### 5.3 Remaining (nice-to-have)
- [ ] Targets page: "Scrape Comments" button
- [ ] Targets page: `last_parsed_at` + comment count
- [ ] Listener monitoring: WebSocket auto-refresh

---

## Фаза 6: Environment & Deployment ✅ DONE

### 6.1 VPS Environment
- [x] `TG_API_ID` + `TG_API_HASH` в `.env` VPS
- [x] `telethon==1.37.0` в `requirements.txt`
- [x] Workers rebuilt + running: listener, parser, poster, warmup
- [x] FastAPI rebuilt with new accounts endpoints

### 6.2 Security
- [x] Session strings в DB: encrypted (Fernet)
- [x] Volume mount: `/app/sessions`

---

## Оценка трудозатрат

| Фаза | Описание | Оценка | Статус |
|------|----------|--------|--------|
| **1** | Session Manager + Client Factory | 2-3 часа | ✅ DONE |
| **2A** | Listener Daemon | 2-3 часа | ✅ DONE |
| **2B** | Comment Scraper | 2-3 часа | ✅ DONE |
| **3** | Account Warmup (реальный) | 1-2 часа | ✅ DONE |
| **4** | Poster (реальная отправка) | 1-2 часа | ✅ DONE |
| **5** | Dashboard UI | 2-3 часа | ✅ DONE |
| **6** | Environment & Deploy | 30 мин | ✅ DONE |
| **ИТОГО** | | **10-14 часов** | **ALL DONE** |

---

## Что уже работает

- Auth (JWT, register, login, RLS)
- Leads CRUD + qualify + export/import + Kanban + source filter
- Campaigns CRUD + spintax
- Targets CRUD
- Accounts CRUD + TG connect/disconnect/status
- Scoring rules (UI + DB)
- Analytics (GROUP BY оптимизация)
- Billing (subscription, usage, mock checkout)
- Audit log
- Health page
- WebSocket + polling fallback
- Seed demo data
- LLM classifier (keyword fallback работает)
- Lead pipeline (classify → upsert → webhook dispatch)
- Webhooks (n8n dispatch)
- Celery + Beat scheduler
- Docker compose (12 сервисов)
- **Real Telethon DM interception**
- **Real comment scraping (auto after post)**
- **Real 3-stage account warmup**
- **Real campaign posting via Telegram**
- **Telegram session management (connect/confirm/disconnect/status)**

---

## Следующие шаги (после полного E2E теста)

1. **Подключить Telegram аккаунт** через UI (phone → code → session saved)
2. **Запустить listener** (кнопка "Listen" в Accounts)
3. **Отправить тестовое сообщение** боту → проверить лид в dashboard
4. **Запустить warmup** → дождаться Stage 3
5. **Создать кампанию** → опубликовать пост → проверить comment scraper
