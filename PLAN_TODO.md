# PLAN_TODO.md — Что нужно сделать

> Обновлено: 2026-08-28
> Блокер: Telegram API credentials (TG_API_ID + TG_API_HASH)
> Файл: `C:\Code\GeneratorAD\PLAN_TODO.md`

---

## 🔴 BLOCKER: Без этого ничего не работает

### Telegram API Credentials
- [ ] Получить `TG_API_ID` + `TG_API_HASH` на [my.telegram.org](https://my.telegram.org) → API Development Tools
- [ ] Добавить в `.env` VPS

---

## Фаза 1: Telethon Session Manager (общая инфраструктура)

> Оба модуля (A и B) используют одни и те же аккаунты и session-файлы.

### 1.1 Session Storage
- [ ] **DB: таблица `account_sessions`** — хранит encrypted Telethon session strings (или file paths)
  ```
  account_id UUID → session_data TEXT (encrypted)
  ```
- [ ] **Crypto: encrypt/decrypt session strings** — уже есть `crypto.py` (Fernet), использовать его
- [ ] **Volume mount** для `.session` файлов в docker-compose (`/app/sessions`)

### 1.2 Telethon Client Factory
- [ ] **`services/worker/app/telegram_client.py`** — общий модуль:
  - `get_client(account_id, tenant_id) → TelegramClient` — загружает session, создаёт клиент
  - `create_session(phone, api_id, api_hash) → session_string` — новый аккаунт
  - `save_session(account_id, session_string)` — сохраняет в DB
  - Обработка `AuthKeyError`, `FloodWaitError`, `UserBannedInChannelError`
- [ ] **Dependencies**: `telethon==1.37.0` добавить в `requirements.txt`

### 1.3 Account Lifecycle API
- [ ] **`POST /api/v1/accounts/`** — уже работает, но:
  - [ ] Добавить endpoint `POST /api/v1/accounts/{id}/connect` — инициирует первичную авторизацию (принимает phone_code от пользователя)
  - [ ] Добавить endpoint `POST /api/v1/accounts/{id}/disconnect` — закрывает session
  - [ ] Добавить endpoint `GET /api/v1/accounts/{id}/status` — реальный статус (подключён/оффлайн/ошибка)

---

## Фаза 2A: Telegram Listener (DM Interception)

> Слушаем входящие личные сообщения на аккаунтах → классифицируем → лид

### 2A.1 Listener Daemon
- [ ] **`services/worker/app/tasks/listener.py`** — переписать текущий stub:
  - [ ] Загружать session через `get_client()` (factory из Фазы 1)
  - [ ] `@client.on(events.NewMessage(incoming=True, func=lambda e: e.is_private))` — обработчик
  - [ ] Извлекать: `sender.username`, `sender.first_name + last_name`, `message.text`
  - [ ] Дедупликация: не обрабатывать одно и то же сообщение дважды (ID или timestamp)
  - [ ] Минимальная длина сообщения: >3 символов (фильтр шума)
  - [ ] Вызывать `process_incoming_message()` из `lead_pipeline.py` (уже работает)
  - [ ] Обработка ошибок: `try/except` с логированием, не крашить worker

### 2A.2 Listener Lifecycle
- [ ] **Start**: `POST /api/v1/listeners/{account_id}/start` — уже есть, но:
  - [ ] Запускать как daemon (Celery task с `queue=listener`, `acks_late=True`, `reject_on_worker_lost=True`)
  - [ ] Привязка: 1 аккаунт = 1 listener worker
  - [ ] Таймаут: infinite (long-polling)
- [ ] **Stop**: `POST /api/v1/listeners/{account_id}/stop` — уже есть, но:
  - [ ] Graceful shutdown через `client.disconnect()`
  - [ ] Очистка Redis lock
- [ ] **Status**: `GET /api/v1/listeners/status` — уже есть:
  - [ ] Добавить реальный статус из Redis (active_workers + last_heartbeat)
  - [ ] Отображать: подключён/оффлайн/ошибка/ожидание

### 2A.3 Listener Monitoring
- [ ] **Heartbeat**: listener отправляет `heartbeat` в Redis каждые 30 сек
- [ ] **Auto-restart**: если listener упал — Celery retry с exponential backoff
- [ ] **Dashboard**: на странице Accounts — кнопка Start/Stop для listener, статус-индикатор

---

## Фаза 2B: Comment Scraper (Post Comment Interception)

> Публикуем пост → парсим комментарии → классифицируем как лиды

### 2B.1 Comment Parser Task
- [ ] **`services/worker/app/tasks/comment_scraper.py`** — новый модуль:
  - [ ] `scrape_comments(tenant_id, post_id, account_id)` — Celery task
  - [ ] `TelethonClient.get_messages(channel, ids=[post_id])` → получаем пост
  - [ ] `client.get_messages(channel, reply_to=post_id)` → комментарии
  - [ ] Для каждого комментария:
    - [ ] `sender.username`, `sender.first_name`, `message.text`
    - [ ] `process_incoming_message()` — тот же pipeline что и Listener
    - [ ] Метка: `source="comment"` (отличить от DM)
  - [ ] Фильтр: пропускать комментарии аккаунта-автора поста
  - [ ] Дедупликация: не парсить уже обработанные комментарии

### 2B.2 Post-to-Comment Link
- [ ] **DB: поле `source` в таблице `leads`**:
  ```sql
  ALTER TABLE leads ADD COLUMN source VARCHAR(50) DEFAULT 'dm';
  -- 'dm' | 'comment' | 'manual' | 'import' | 'webhook'
  ```
- [ ] **DB: поле `post_id` в таблице `leads`** — ссылка на пост в группе
  ```sql
  ALTER TABLE leads ADD COLUMN post_id VARCHAR(255);
  ```

### 2B.3 Auto-Scrape After Posting
- [ ] **Trigger**: после каждого успешного `publish_post` в poster worker:
  - [ ] Сохранять `post_id` (message ID) в `posting_logs`
  - [ ] Через 2 минуты запускать `scrape_comments.delay(post_id, account_id, target_channel)`
  - [ ] Повторный scrape через 10 минут ( комментарии приходят волной)
  - [ ] Последний scrape через 24 часа (финальный)
- [ ] **Periodic scrape**: Beat scheduler каждые 2 часа скрейпит комментарии на недавних постах

### 2B.4 Comment Scraper API
- [ ] **`POST /api/v1/targets/{target_id}/scrape-comments`** — ручной запуск скрейпа для конкретного поста
- [ ] **Response**: `{ comments_found: N, leads_created: M }`

---

## Фаза 3: Account Warmup (реальный)

> Текущий warmup — заглушка. Нужна реальная логика.

### 3.1 Warmup Stages
- [ ] **Stage 1 (passive)**: `get_dialogs()`, `read messages`, reactions на посты
  - Лимит: 5-10 действий/день
  - Длительность: 3-5 дней
- [ ] **Stage 2 (soft engagement)**: `join_channel()`, `send_message()` в нейтральные группы
  - Лимит: 10-20 действий/день
  - Длительность: 3-5 дней
- [ ] **Stage 3 (production)**: готов к posting + listening
  - Лимит: 30-50 действий/день

### 3.2 Warmup Worker
- [ ] **`services/worker/app/tasks/warmup.py`** — переписать:
  - [ ] Загружать реальный `TelegramClient` через factory
  - [ ] Stage 1: `client.get_dialogs(limit=10)` + `client.send_reaction()`
  - [ ] Stage 2: `client.join_channel(target)` + `client.send_message(neutral_group, "👍")`
  - [ ] Stage 3: no-op (poster берёт на себя)
  - [ ] `handle_flood_wait()`: UPDATE account_pool SET status='cooldown', cooldown_until=...
  - [ ] `trigger_daily_warmup()`: реальный DB scan + dispatch

### 3.3 Warmup Dashboard
- [ ] Страница Accounts: progress bar 3 стадий (Stage 1 → 2 → 3)
- [ ] Кнопка "Skip warmup" для владельца (для тестов)

---

## Фаза 4: Campaign Poster (реальный)

> Текущий poster — 80% кода, нет реальной отправки в Telegram.

### 4.1 Poster Worker
- [ ] **`services/worker/app/tasks/poster.py`** — дополнить:
  - [ ] Загружать `TelegramClient` через factory
  - [ ] `client.send_message(target_channel, rendered_text)` после spintax render
  - [ ] Обработка `FloodWaitError` → `handle_flood_wait()` (установить cooldown)
  - [ ] Обработка `UserBannedInChannelError` → пометить аккаунт как `banned`
  - [ ] Сохранять `message_id` (post ID) в `posting_logs` — нужен для comment scraper

### 4.2 Post-to-Lead Pipeline
- [ ] После успешного поста:
  - [ ] Сохранить `post_id` в `posting_logs.message_id`
  - [ ] Запланировать `scrape_comments` через 2 мин, 10 мин, 24 ч

---

## Фаза 5: Dashboard UI дополнения

### 5.1 Accounts Page
- [ ] Кнопка "Connect Account" → modal с phone + code (первичная авторизация Telethon)
- [ ] Кнопка "Start Listener" / "Stop Listener" (массовая для всех аккаунтов)
- [ ] Warmup progress bar (Stage 1→2→3)
- [ ] Статус: Online/Offline/Cooldown/Banned

### 5.2 Leads Page
- [ ] Фильтр по `source` (DM / Comment / Manual / Import)
- [ ] Показывать来源 иконкой рядом с каждым лидом
- [ ] Комментарии: показывать `post_id` (ссылка на пост)

### 5.3 Targets Page
- [ ] Кнопка "Scrape Comments" — ручной запуск для конкретного target
- [ ] Показывать `last_parsed_at` и количество комментариев

### 5.4 Listener Monitoring
- [ ] Страница Accounts — реальный статус listener'ов (online/offline/error)
- [ ] Auto-refresh каждые 10 сек через WebSocket

---

## Фаза 6: Environment & Deployment

### 6.1 VPS Environment
- [ ] Добавить `TG_API_ID` + `TG_API_HASH` в `.env`
- [ ] Добавить `telethon` в `requirements.txt`
- [ ] Volume mount для sessions: `/app/sessions:/app/sessions`
- [ ] Restart workers: `docker compose up -d --force-recreate worker-listener worker-parser worker-poster worker-warmup`

### 6.2 Security
- [ ] Session files: encrypted on disk (Fernet)
- [ ] Session strings в DB: encrypted (уже есть в `crypto.py`)
- [ ] Account phone numbers: не хранить в открытом виде (mask в UI)

---

## Оценка трудозатрат

| Фаза | Описание | Оценка |
|------|----------|--------|
| **1** | Session Manager + Client Factory | 2-3 часа |
| **2A** | Listener Daemon | 2-3 часа |
| **2B** | Comment Scraper | 2-3 часа |
| **3** | Account Warmup (реальный) | 1-2 часа |
| **4** | Poster (реальная отправка) | 1-2 часа |
| **5** | Dashboard UI | 2-3 часа |
| **6** | Environment & Deploy | 30 мин |
| **ИТОГО** | | **10-14 часов** |

---

## Порядок выполнения

```
1. Фаза 1 (Session Manager) — общая инфраструктура
   ↓
2. Фаза 2A (Listener) — первый реальный источник лидов
   ↓
3. Фаза 4 (Poster) — нужен для Фазы 2B
   ↓
4. Фаза 2B (Comment Scraper) — второй источник лидов
   ↓
5. Фаза 3 (Warmup) — параллельно с 2B
   ↓
6. Фаза 5 (Dashboard UI) — параллельно с 3
   ↓
7. Фаза 6 (Deploy) — итоговый деплой
```

---

## Что уже работает (не трогать)

- Auth (JWT, register, login, RLS)
- Leads CRUD + qualify + export/import + Kanban
- Campaigns CRUD + spintax
- Targets CRUD
- Accounts CRUD (API готов, нужна Telethon интеграция)
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
- Caddy reverse proxy
- Vercel deployment
