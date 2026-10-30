# Деплой 24GO — Пошаговая инструкция

> **Исторический документ, не текущий production runbook.** Указанные ниже Vercel/DNS и статусы готовности относятся к прежней схеме. Действующий frontend размещён на VPS; не повторяйте старый cutover, массовый `git add` или публикацию в main по этой инструкции. Актуальные границы и состояние: [README](README.md), [аудит](docs/RELEASE_READINESS_AUDIT.md), [план релиза](RELEASE_PLAN.md). Перед любым развёртыванием отдельно установите фактический target, полный набор Compose overrides и разрешённый scope.

## Статус проекта

| Компонент | Статус | Где работает |
|-----------|--------|--------------|
| Backend (FastAPI) | ✅ Готов | VPS (Docker) |
| Worker (Celery x5 + Beat) | ✅ Готов | VPS (Docker) |
| Bot (Telegram) | ✅ Готов | VPS (Docker) |
| Dashboard (Next.js) | ✅ Готов | Vercel |
| PostgreSQL 16 | ✅ Работает | VPS (Docker, порт 5434) |
| Redis 7 | ✅ Работает | VPS (Docker) |

---

## ЧАСТЬ 1: GitHub репозиторий

### Шаг 1: Создать/проверить репозиторий

Репозиторий: `https://github.com/rf24kja/24go.site`

Если репо ещё нет — создать на GitHub (приватный или публичный).

### Шаг 2: Запушить код

```bash
# Перейти в папку проекта
cd C:\Code\GeneratorAD

# Инициализировать git (если ещё не сделан)
git init
git remote add origin https://github.com/rf24kja/24go.site.git

# Добавить всё
git add .

# Коммит
git commit -m "feat: 24GO platform v0.3.0 — full stack"

# Пуш
git branch -M main
git push -u origin main
```

---

## ЧАСТЬ 2: Vercel (Dashboard на 24go.site)

### Шаг 3: Подключить Vercel к GitHub

1. Зайти на [vercel.com](https://vercel.com)
2. Нажать **"Add New Project"**
3. Выбрать репозиторий `rf24kja/24go.site`
4. Framework preset: **Next.js**
5. Root directory: `services/dashboard`
6. Нажать **Deploy**

### Шаг 4: Настроить переменные окружения в Vercel

В проекте Vercel → **Settings** → **Environment Variables**:

| Переменная | Значение | Где взять |
|------------|----------|-----------|
| `NEXT_PUBLIC_API_URL` | `https://api.24go.site` | Адрес твоего VPS |

Нажать **Save**, затем **Redeploy**.

### Шаг 5: Настроить домен

1. В Vercel → **Settings** → **Domains**
2. Добавить `24go.site`
3. Vercel покажет DNS записи — скопировать их

### Шаг 6: Настроить DNS

У своего регистратора домена (где куплен 24go.site):

| Тип | Имя | Значение |
|-----|-----|----------|
| A | @ | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |

DNS пропишется за 5–30 минут.

---

## ЧАСТЬ 3: VPS (Backend + Workers + Bot)

### Шаг 7: Подключиться к VPS

```bash
ssh root@IP_ТВОЕГО_VPS
```

### Шаг 8: Установить Docker и Docker Compose

```bash
# Установить Docker
curl -fsSL https://get.docker.com | sh

# Установить Docker Compose плагин
apt install docker-compose-plugin -y

# Проверить
docker --version
docker compose version
```

### Шаг 9: Склонировать репозиторий на VPS

```bash
cd /opt
git clone https://github.com/rf24kja/24go.site.git
cd 24go.site
```

### Шаг 10: Создать .env файл

```bash
nano .env
```

Вставить:

```env
# ── База данных ──────────────────────────────────────
POSTGRES_USER=leadgen
POSTGRES_PASSWORD=СГЕНЕРИРУЙ_СЛОЖНЫЙ_ПАРОЛЬ
POSTGRES_DB=leadgen

# ── JWT ──────────────────────────────────────────────
JWT_SECRET=СГЕНЕРИРУЙ_ЕЩЁ_ОДИН_СЛОЖНЫЙ_ПАРОЛЬ

# ── Telegram API (нужно получить на my.telegram.org) ─
TG_API_ID=
TG_API_HASH=

# ── Telegram Bot Token (от @BotFather) ──────────────
BOT_TOKEN=
OWNER_CHAT_ID=

# ── LLM API (опционально, без него работает keyword fallback) ─
DEEPSEEK_API_KEY=
OPENAI_API_KEY=

# ── Billing (опционально, без него mock режим) ─────
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=

# ── Домен (для CORS) ────────────────────────────────
APP_URL=https://24go.site
```

### Шаг 11: Сгенерировать пароли

```bash
# Сгенерировать случайные пароли
openssl rand -base64 32
# Скопировать результат в POSTGRES_PASSWORD
openssl rand -base64 32
# Скопировать результат в JWT_SECRET
```

### Шаг 12: Настроить порты (если 5432 занят)

В `docker-compose.yml` PostgreSQL уже на порту **5434** (чтобы не конфликтовать с существующим `preyi_db`).

Если нужно поменять — отредактировать `docker-compose.yml`:

```bash
nano docker-compose.yml
```

Найти секцию `postgres` и поменять порт:

```yaml
ports:
  - "5434:5432"  # внешний:внутренний
```

### Шаг 13: Запустить всё

```bash
cd /opt/24go.site
docker compose up -d --build
```

### Шаг 14: Проверить статус

```bash
# Все контейнеры должны быть Up
docker compose ps

# Проверить логи backend
docker compose logs fastapi --tail 20

# Проверить API
curl http://localhost:8000/health
```

Ожидаемый ответ:
```json
{"status": "ok", "ws_connections": 0}
```

---

## ЧАСТЬ 4: Nginx (Reverse Proxy на VPS)

### Шаг 15: Установить Nginx

```bash
apt install nginx -y
```

### Шаг 16: Создать конфиг

```bash
nano /etc/nginx/sites-available/24go-api
```

Вставить:

```nginx
server {
    listen 80;
    server_name api.24go.site;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

### Шаг 17: Активировать конфиг

```bash
ln -s /etc/nginx/sites-available/24go-api /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
```

### Шаг 18: Настроить DNS для API

У регистратора домена:

| Тип | Имя | Значение |
|-----|-----|----------|
| A | api | IP_ТВОЕГО_VPS |

---

## ЧАСТЬ 5: SSL (Let's Encrypt)

### Шаг 19: Установить Certbot

```bash
apt install certbot python3-certbot-nginx -y
```

### Шаг 20: Выпустить сертификат

```bash
certbot --nginx -d api.24go.site --non-interactive --agree-tos -m ТВОЙ_EMAIL
```

### Шаг 21: Автообновление

```bash
systemctl enable certbot.timer
certbot renew --dry-run
```

---

## ЧАСТЬ 6: Telegram API ключи

### Шаг 22: Получить TG_API_ID и TG_API_HASH

1. Зайти на [my.telegram.org](https://my.telegram.org)
2. Войти через номер телефона
3. **API development tools** → **Create new application**
4. Заполнить форму:
   - App title: `24GO`
   - Short name: `24go`
   - Platform: `Desktop`
   - Description: `Lead Generation Bot`
5. Скопировать `App api_id` и `App api_hash`

### Шаг 23: Обновить .env на VPS

```bash
nano /opt/24go.site/.env
```

Вписать:

```env
TG_API_ID=12345678
TG_API_HASH=abcdef1234567890abcdef
```

### Шаг 24: Перезапустить воркеры

```bash
cd /opt/24go.site
docker compose restart worker-pool
```

---

## ЧАСТЬ 7: Telegram Bot

### Шаг 25: Получить BOT_TOKEN

1. Написать [@BotFather](https://t.me/BotFather) в Telegram
2. Отправить `/newbot`
3. Имя: `24GO LeadGen Bot`
4. Username: `your_24go_bot`
5. Скопировать токен

### Шаг 26: Узнать OWNER_CHAT_ID

1. Написать боту `/start`
2. Открыть: `https://api.telegram.org/botТВОЙ_ТОКЕН/getUpdates`
3. Найти `"chat":{"id": 123456789}` — это OWNER_CHAT_ID

### Шаг 27: Обновить .env

```bash
nano /opt/24go.site/.env
```

Вписать:

```env
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
OWNER_CHAT_ID=123456789
```

### Шаг 28: Перезапустить бота

```bash
cd /opt/24go.site
docker compose restart bot
```

---

## ЧАСТЬ 8: Проверка после деплоя

### Шаг 29: Проверить Dashboard

Открыть в браузере:

```
https://24go.site
```

Должна отобразиться лендинг-страница 24GO.

### Шаг 30: Зарегистрироваться

1. Нажать **Get Started** или **Sign In** → переключиться на **Register**
2. Ввести email, пароль, название компании
3. Должен перекинуть на dashboard

### Шаг 31: Проверить API

```bash
# С VPS
curl https://api.24go.site/health

# Ответ должен быть:
# {"status":"ok","ws_connections":0}
```

### Шаг 32: Проверить Bot

Написать боту `/start` в Telegram — должен ответить приветствием.

---

## ЧАСТЬ 9: Автообновление (опционально)

### Шаг 33: Настроить автообновление на VPS

```bash
nano /opt/24go-site/update.sh
```

Вставить:

```bash
#!/bin/bash
cd /opt/24go.site
git pull
docker compose up -d --build
docker system prune -f
```

```bash
chmod +x /opt/24go-site/update.sh

# Добавить в crontab (обновление каждый день в 4 утра)
crontab -e
```

Добавить строку:

```
0 4 * * * /opt/24go-site/update.sh >> /var/log/24go-update.log 2>&1
```

---

## Чеклист перед деплоем

- [ ] GitHub репозиторий создан и код запушен
- [ ] Vercel подключен к репозиторию
- [ ] Переменная `NEXT_PUBLIC_API_URL` задана в Vercel
- [ ] DNS для `24go.site` → Vercel (A record + CNAME)
- [ ] DNS для `api.24go.site` → VPS IP
- [ ] VPS: Docker установлен
- [ ] VPS: `.env` файл создан с паролями
- [ ] VPS: `docker compose up -d --build` — все контейнеры Up
- [ ] VPS: Nginx настроен для `api.24go.site`
- [ ] VPS: SSL сертификат выпущен
- [ ] `TG_API_ID` + `TG_API_HASH` получены на my.telegram.org
- [ ] `BOT_TOKEN` получен от @BotFather
- [ ] `OWNER_CHAT_ID` получен из getUpdates
- [ ] Backend: `curl localhost:8000/health` отвечает OK
- [ ] Dashboard: `https://24go.site` открывается
- [ ] Регистрация на дашборде работает
- [ ] Bot отвечает на /start

---

## Контакты / Ссылки

| Ресурс | URL |
|--------|-----|
| Dashboard (production) | https://24go.site |
| API (production) | https://api.24go.site |
| GitHub | https://github.com/rf24kja/24go.site |
| Vercel Dashboard | https://vercel.com/dashboard |
| Telegram API | https://my.telegram.org |
| BotFather | https://t.me/BotFather |
| Docker Compose файл | `C:\Code\GeneratorAD\docker-compose.yml` |
| Backend код | `C:\Code\GeneratorAD\services\backend\` |
| Dashboard код | `C:\Code\GeneratorAD\services\dashboard\` |
| Bot код | `C:\Code\GeneratorAD\services\bot\` |
