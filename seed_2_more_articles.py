"""Seed 2 more blog articles: account warming + n8n automation."""
import asyncio
import uuid

DATABASE_URL = "postgresql://app_user:B6XRri3ev458GMUPyfOk@postgres:5432/app_db"
TENANT_ID = uuid.UUID("98893daf-6cce-4a24-9b1a-495dcd23e8a4")

ARTICLES = [
    {
        "slug": "progrev-akkauntov-telegram",
        "title_en": "Telegram Account Warming: Complete Guide to Avoid Bans in 2026",
        "title_ru": "Прогрев аккаунтов Telegram: полное руководство по избеганию банов в 2026",
        "excerpt_en": "Step-by-step guide to warming up Telegram accounts for outreach. Daily action limits, content schedule, proxy rotation, and anti-ban strategies that work.",
        "excerpt_ru": "Пошаговое руководство по прогреву аккаунтов Telegram для outreach. Дневные лимиты действий, расписание контента, ротация прокси и стратегии защиты от банов.",
        "meta_description_en": "How to warm up Telegram accounts for outreach without getting banned. Daily limits, timeline, and anti-ban strategies for 2026.",
        "meta_description_ru": "Как прогреть аккаунты Telegram для outreach без бана. Дневные лимиты, таймлайн и стратегии защиты от банов в 2026.",
        "tags": ["telegram warming", "anti-ban", "account safety", "outreach", "telegram limits"],
        "content_en": """# Telegram Account Warming: Complete Guide to Avoid Bans in 2026

New Telegram accounts get banned within hours if you start mass messaging immediately. Account warming is the process of gradually increasing activity to build trust with Telegram's anti-spam system.

This guide gives you the exact timeline, daily limits, and strategies used by teams sending 500+ messages/day without bans.

## Why Accounts Get Banned

Telegram bans accounts for:

1. **Too many actions too fast** — sending 50+ messages on day 1
2. **Spam patterns** — identical messages to many users
3. **No profile setup** — empty bio, no photo, no name
4. **VPN/free proxy usage** — datacenter IPs flag accounts
5. **Reported by users** — even 2-3 reports can ban

## The 21-Day Warming Timeline

### Days 1-3: Setup Phase

**Actions per day: 5-10**

| Day | Actions | Details |
|-----|---------|---------|
| Day 1 | 5-8 | Set up profile (name, bio, photo). Join 3-5 groups. Send 2-3 messages in groups. |
| Day 2 | 8-10 | Send 3-5 DMs to known contacts. Reply to group messages. Browse channels. |
| Day 3 | 10-15 | Send 5-8 DMs. Post 1-2 messages in groups. React to messages. |

**Profile requirements:**
- Real name (or realistic business name)
- Profile photo (professional headshot or logo)
- Bio with 2-3 sentences about who you are
- Username (optional but recommended)

### Days 4-7: Slow Growth

**Actions per day: 15-25**

| Day | Actions | Details |
|-----|---------|---------|
| Day 4 | 15-20 | Send 10-12 DMs. Post in 3-5 groups. Add 2-3 contacts. |
| Day 5 | 18-22 | Send 12-15 DMs. Create 1 group post. Join 2 new groups. |
| Day 6 | 20-25 | Send 15-18 DMs. Forward 2-3 messages. Browse channels 10+ min. |
| Day 7 | 22-25 | Send 15-20 DMs. Post in groups. Voice message to 1-2 contacts. |

**Key rules:**
- Vary message times (don't send 20 messages in 5 minutes)
- Use different message lengths (some short, some long)
- Include links occasionally (not in every message)
- Reply to existing conversations

### Days 8-14: Medium Growth

**Actions per day: 30-60**

| Day | Actions | Details |
|-----|---------|---------|
| Day 8-10 | 30-40 | Send 25-30 DMs. Post daily in groups. Add 5-10 contacts. |
| Day 11-12 | 40-50 | Send 35-40 DMs. Create channel post. Voice messages. |
| Day 13-14 | 50-60 | Send 40-50 DMs. Full engagement pattern. |

**Content mix:**
- 60% DMs (varied content, personalized)
- 20% group posts (valuable, not promotional)
- 10% reactions and replies
- 10% channel browsing

### Days 15-21: Full Speed

**Actions per day: 60-100+**

| Day | Actions | Details |
|-----|---------|---------|
| Day 15-17 | 60-80 | Send 50-65 DMs. Full posting schedule. |
| Day 18-19 | 80-100 | Send 65-80 DMs. Scale to target volume. |
| Day 20-21 | 100+ | Full production volume. |

**At this point, your account has:**
- 3 weeks of activity history
- Diverse action patterns
- Established messaging rhythm
- Trust score from Telegram

## Daily Action Limits by Stage

| Stage | DMs/day | Group posts/day | Add contacts/day | Total actions |
|-------|---------|-----------------|------------------|---------------|
| Days 1-3 | 5-10 | 3-5 | 0-2 | 10-20 |
| Days 4-7 | 15-25 | 5-8 | 3-5 | 25-40 |
| Days 8-14 | 30-50 | 8-12 | 5-10 | 50-80 |
| Days 15-21 | 50-100+ | 10-15 | 10-15 | 80-130 |

## The Anti-Ban Checklist

### Before Sending

- [ ] Profile fully set up (name, photo, bio)
- [ ] Account is 7+ days old
- [ ] Joined 10-20 relevant groups
- [ ] Sent 50+ messages already
- [ ] No violations in history

### While Sending

- [ ] Random delays between messages (15-45 seconds)
- [ ] Vary message content (spintax or manual)
- [ ] Don't send identical messages back-to-back
- [ ] Mix DMs with group activity
- [ ] Take breaks (10 min every 30 messages)
- [ ] Use residential/mobile proxies

### Red Flags to Avoid

- [ ] Sending 50+ messages in first hour
- [ ] Identical message to 10+ users
- [ ] No profile photo
- [ ] Using datacenter VPN
- [ ] Sending at 3 AM local time
- [ ] No group activity (DM-only account)
- [ ] Message contains only links

## Proxy Strategy

### Types of Proxies

| Type | Cost | Ban Risk | Recommended |
|------|------|----------|-------------|
| Datacenter | $0.50-2/mo | High | No |
| Residential | $3-8/mo | Low | Yes |
| Mobile (4G/5G) | $10-30/mo | Lowest | Best |
| Rotating residential | $5-15/mo | Low | Yes |

### Proxy Rules

1. **1 proxy per account** — don't share
2. **Same city/region** — don't jump geolocations
3. **Residential or mobile** — never datacenter
4. **Static IP preferred** — rotating IPs look suspicious
5. **Check proxy health** — rotate if IP gets flagged

## Spintax for Message Variation

Instead of sending identical messages, use spintax:

```
Hey {first_name}! {How's it going|How are you|Hope you're doing well}!

{I noticed|Saw| Came across} your {post|message|comment} in {group_name}.

{We help companies like yours|Our platform helps businesses|We work with similar companies} {save time|reduce costs|automate processes}.

{Would a quick demo help?|Interested in seeing how?|Free to chat for 10 min?}
```

This generates unique message variations automatically.

## Recovery: What to Do If Banned

### Soft Ban (Temporary)
- **Symptom:** Can't send messages for 24-72 hours
- **Action:** Wait it out. Don't try to send.
- **Prevention:** Reduce activity, check for user reports

### Hard Ban (Permanent)
- **Symptom:** Account deleted, can't log in
- **Action:** Appeal via @SpamBot or Telegram support
- **Prevention:** Follow warming guide strictly

### Phone Number Ban
- **Symptom:** Number can't register new accounts
- **Action:** Use different number after 30+ days
- **Prevention:** Don't use same number for multiple accounts

## How 24GO Handles Warming

24GO automates the entire warming process:

1. **Automatic limits** — respects daily action caps per account stage
2. **Random delays** — 15-45 second jitter between messages
3. **Content variation** — spintax built-in
4. **Account rotation** — distributes load across accounts
5. **Flood detection** — pauses on FloodWaitError
6. **Progress tracking** — shows warming stage per account

You just set the target volume and let 24GO handle the rest.

## Monitoring: Warning Signs

Stop immediately if you see:

| Warning Sign | Action |
|--------------|--------|
| FloodWaitError | Pause 24-48 hours |
| "Too many requests" | Reduce to 50% volume |
| Messages not delivering | Check account status |
| Users blocking you | Review message quality |
| Account restricted | Wait 72 hours, reduce volume |

## Multi-Account Strategy

For serious outreach, use 3-5 accounts:

| Account | Warming | Daily Limit | Purpose |
|---------|---------|-------------|---------|
| Account 1 | 21+ days | 80-100 | Primary outreach |
| Account 2 | 21+ days | 80-100 | Secondary outreach |
| Account 3 | 14+ days | 50-60 | Backup + groups |
| Account 4 | 7+ days | 30-40 | Warming up |
| Account 5 | 0-7 days | 10-15 | Just started |

Rotate accounts weekly. Never use all accounts at max capacity.

## Conclusion

Account warming is not optional — it's the foundation of sustainable Telegram outreach. Follow the 21-day timeline, respect daily limits, and never skip the setup phase. The accounts that survive are the ones that look human.""",
        "content_ru": """# Прогрев аккаунтов Telegram: полное руководство по избеганию банов в 2026

Новые аккаунты Telegram банятся в течение часов, если сразу начать массовую рассылку. Прогрев — это процесс постепенного увеличения активности для создания доверия к антиспам-системе Telegram.

Это руководство даёт точный таймлайн, дневные лимиты и стратегии, которые используют команды, отправляющие 500+ сообщений в день без банов.

## Почему банят аккаунты

Telegram банит за:

1. **Слишком много действий слишком быстро** — 50+ сообщений в первый день
2. **Спам-паттерны** — одинаковые сообщения многим пользователям
3. **Нет настройки профиля** — пустое био, нет фото, нет имени
4. **VPN/бесплатные прокси** — датацентр-IP помечают аккаунты
5. **Жалобы пользователей** — даже 2-3 жалобы могут привести к бану

## Таймлайн прогрева: 21 день

### Дни 1-3: Этап настройки

**Действий в день: 5-10**

| День | Действия | Детали |
|------|----------|--------|
| День 1 | 5-8 | Настроить профиль (имя, био, фото). Вступить в 3-5 групп. Написать 2-3 сообщения в группах. |
| День 2 | 8-10 | Отправить 3-5 DM знакомым. Ответить на сообщения в группах. Смотреть каналы. |
| День 3 | 10-15 | Отправить 5-8 DM. Создать 1-2 поста в группах. Реагировать на сообщения. |

**Требования к профилю:**
- Настоящее имя (или реалистичное бизнес-имя)
- Фото профиля (профессиональное фото или логотип)
- Био из 2-3 предложений
- Юзернейм (опционально, но рекомендуется)

### Дни 4-7: Медленный рост

**Действий в день: 15-25**

| День | Действия | Детали |
|------|----------|--------|
| День 4 | 15-20 | Отправить 10-12 DM. Постить в 3-5 групп. Добавить 2-3 контакта. |
| День 5 | 18-22 | Отправить 12-15 DM. Создать 1 пост. Вступить в 2 новые группы. |
| День 6 | 20-25 | Отправить 15-18 DM. Переслать 2-3 сообщения. Смотреть каналы 10+ минут. |
| День 7 | 22-25 | Отправить 15-20 DM. Постить в группах. Голосовое сообщение 1-2 контактам. |

**Ключевые правила:**
- Варьируй время отправки (не 20 сообщений за 5 минут)
- Используй разную длину сообщений (короткие и длинные)
- Включай ссылки иногда (не в каждом сообщении)
- Отвечай на существующие разговоры

### Дни 8-14: Средний рост

**Действий в день: 30-60**

| День | Действия | Детали |
|------|----------|--------|
| День 8-10 | 30-40 | Отправить 25-30 DM. Постить ежедневно. Добавить 5-10 контактов. |
| День 11-12 | 40-50 | Отправить 35-40 DM. Создать пост канала. Голосовые. |
| День 13-14 | 50-60 | Отправить 40-50 DM. Полный паттерн активности. |

**Смесь контента:**
- 60% DM (разнообразный, персонализированный)
- 20% постов в группах (полезные, не продающие)
- 10% реакций и ответов
- 10% просмотра каналов

### Дни 15-21: Полная скорость

**Действий в день: 60-100+**

| День | Действия | Детали |
|------|----------|--------|
| День 15-17 | 60-80 | Отправить 50-65 DM. Полное расписание постов. |
| День 18-19 | 80-100 | Отправить 65-80 DM. Масштабирование до целевого объёма. |
| День 20-21 | 100+ | Полный рабочий объём. |

**К этому моменту аккаунт имеет:**
- 3 недели истории активности
- Разнообразные паттерны действий
- Установленный ритм отправки
- Оценку доверия от Telegram

## Дневные лимиты по этапам

| Этап | DM/день | Посты в группах/день | Добавление контактов/день | Всего действий |
|------|---------|---------------------|--------------------------|----------------|
| Дни 1-3 | 5-10 | 3-5 | 0-2 | 10-20 |
| Дни 4-7 | 15-25 | 5-8 | 3-5 | 25-40 |
| Дни 8-14 | 30-50 | 8-12 | 5-10 | 50-80 |
| Дни 15-21 | 50-100+ | 10-15 | 10-15 | 80-130 |

## Чек-лист защиты от банов

### Перед отправкой

- [ ] Профиль полностью настроен (имя, фото, био)
- [ ] Аккаунту 7+ дней
- [ ] Вступил в 10-20 релевантных групп
- [ ] Уже отправил 50+ сообщений
- [ ] Нет нарушений в истории

### Во время отправки

- [ ] Случайные задержки между сообщениями (15-45 секунд)
- [ ] Варьируй контент сообщений (спинтакс или ручной)
- [ ] Не отправляй одинаковые сообщения подряд
- [ ] Чередуй DM с активностью в группах
- [ ] Делай перерывы (10 минут каждые 30 сообщений)
- [ ] Используй резидентные/мобильные прокси

### Красные флаги, которых стоит избегать

- [ ] 50+ сообщений в первый час
- [ ] Одинаковое сообщение 10+ пользователям
- [ ] Нет фото профиля
- [ ] Использование датацентр VPN
- [ ] Отправка в 3 ночи по местному времени
- [ ] Нет активности в группах (только DM)
- [ ] Сообщение содержит только ссылки

## Стратегия прокси

### Типы прокси

| Тип | Стоимость | Риск бана | Рекомендация |
|-----|-----------|-----------|--------------|
| Датацентр | $0.50-2/мес | Высокий | Нет |
| Резидентный | $3-8/мес | Низкий | Да |
| Мобильный (4G/5G) | $10-30/мес | Самый низкий | Лучший |
| Ротирующий резидентный | $5-15/мес | Низкий | Да |

### Правила прокси

1. **1 прокси на аккаунт** — не разделяй
2. **Тот же город/регион** — не перескакивай геолокации
3. **Резидентный или мобильный** — никогда датацентр
4. **Статический IP предпочтителен** — ротирующиеся IP выглядят подозрительно
5. **Проверяй здоровье прокси** — ротируй при блокировке

## Спинтакс для вариации сообщений

Вместо одинаковых сообщений используй спинтакс:

```
Привет, {first_name}! {Как дела|Как ты|Надеюсь, у тебя всё хорошо}!

{Я заметил|Увидел|Наткнулся} на твоё {сообщение|пост|комментарий} в {group_name}.

{Мы помогаем таким компаниям|Наша платформа помогает бизнесу|Мы работаем с похожими компаниями} {экономить время|снижать расходы|автоматизировать процессы}.

{Показать как это работает?|Интересно посмотреть?|Свободен на 10 минут?}
```

Это автоматически генерирует уникальные варианты сообщений.

## Восстановление: что делать при бане

### Мягкий бан (временный)
- **Симптом:** Не могу отправлять сообщения 24-72 часа
- **Действие:** Ждать. Не пытаться отправлять.
- **Профилактика:** Снизить активность, проверить жалобы пользователей

### Жёсткий бан (постоянный)
- **Симптом:** Аккаунт удалён, не могу войти
- **Действие:** Подать апелляцию через @SpamBot или поддержку Telegram
- **Профилактика:** Строго следовать руководству по прогреву

### Бан номера телефона
- **Симптом:** Номер нельзя использовать для новых аккаунтов
- **Действие:** Использовать другой номер через 30+ дней
- **Профилактика:** Не использовать один номер для нескольких аккаунтов

## Как 24GO автоматизирует прогрев

24GO автоматизирует весь процесс:

1. **Автоматические лимиты** — соблюдает дневные ограничения по этапам
2. **Случайные задержки** — 15-45 секунд джиттера между сообщениями
3. **Вариация контента** — спинтакс встроен
4. **Ротация аккаунтов** — распределяет нагрузку
5. **Детекция flood** — стоп на FloodWaitError
6. **Отслеживание прогресса** — показывает этап прогрева

Просто задай целевой объём и дай 24GO делать остальное.

## Мониторинг: признаки опасности

Остановись сразу, если видишь:

| Признак | Действие |
|---------|----------|
| FloodWaitError | Пауза 24-48 часов |
| "Too many requests" | Снизить на 50% |
| Сообщения не доставляются | Проверить статус аккаунта |
| Пользователи блокируют | Пересмотреть качество сообщений |
| Аккаунт ограничен | Подождать 72 часа, снизить объём |

## Мульти-аккаунт стратегия

Для серьёзного outreach используй 3-5 аккаунтов:

| Аккаунт | Прогрев | Дневной лимит | Назначение |
|---------|---------|---------------|------------|
| Аккаунт 1 | 21+ дней | 80-100 | Основной outreach |
| Аккаунт 2 | 21+ дней | 80-100 | Вторичный outreach |
| Аккаунт 3 | 14+ дней | 50-60 | Резерв + группы |
| Аккаунт 4 | 7+ дней | 30-40 | Прогревается |
| Аккаунт 5 | 0-7 дней | 10-15 | Только начал |

Ротируй аккаунты еженедельно. Никогда не используй все на максимуме.

## Вывод

Прогрев аккаунтов — не опция, а фундамент устойчивого outreach в Telegram. Следуй 21-дневному таймлайну, соблюдай дневные лимиты и никогда не пропускай этап настройки. Выживают те аккаунты, которые выглядят как человек.""",
    },
    {
        "slug": "avtomatizatsiya-lidogeneratsii-s-n8n",
        "title_en": "Lead Generation Automation with n8n: Complete Guide 2026",
        "title_ru": "Автоматизация лидогенерации с n8n: полное руководство 2026",
        "excerpt_en": "How to automate lead generation with n8n workflow automation. Connect Telegram, CRM, email, and AI classifiers into one automated pipeline.",
        "excerpt_ru": "Как автоматизировать лидогенерацию с помощью n8n. Соедини Telegram, CRM, email и AI-классификаторы в один автоматизированный пайплайн.",
        "meta_description_en": "Automate lead generation with n8n. Step-by-step guide to building Telegram → CRM → Email automation workflows.",
        "meta_description_ru": "Автоматизация лидогенерации с n8n. Пошаговое руководство по созданию workflow Telegram → CRM → Email.",
        "tags": ["n8n", "workflow automation", "lead generation", "no-code", "integration"],
        "content_en": """# Lead Generation Automation with n8n: Complete Guide 2026

n8n is an open-source workflow automation tool that connects your lead generation stack without code. This guide shows you how to build automated pipelines from Telegram scraping to CRM sync to email follow-ups.

## What is n8n?

n8n (pronounced "nodemation") is a self-hosted workflow automation platform. Think Zapier, but:
- **Free** (self-hosted)
- **Unlimited executions** (no per-task pricing)
- **Custom code** (JavaScript/Python in workflows)
- **Self-hosted** (your data stays yours)

## Why n8n for Lead Generation?

| Feature | n8n | Zapier | Make |
|---------|-----|--------|------|
| Price | Free (self-hosted) | $20-50/mo | $9-29/mo |
| Executions | Unlimited | 750-2000/mo | 1000-10000/mo |
| Self-hosted | Yes | No | No |
| Custom code | Full JS/Python | Limited | Limited |
| Telegram integration | Official node | Limited | Good |
| AI nodes | Built-in | Basic | Good |
| Webhooks | Unlimited | Limited | Limited |

## Architecture: The Lead Generation Stack

Here's the complete pipeline we'll build:

```
1. Telegram Group Scanner
   ↓ (new messages)
2. AI Lead Classifier
   ↓ (qualified leads)
3. CRM Pipeline
   ↓ (new lead)
4. Email Sequence
   ↓ (follow-up)
5. Slack/Discord Notification
```

## Step 1: Telegram Message Scanner

### Workflow: New Messages from Groups

```json
{
  "nodes": [
    {
      "name": "Telegram Trigger",
      "type": "n8n-nodes-base.telegramTrigger",
      "parameters": {
        "updates": ["message"]
      }
    },
    {
      "name": "Filter Group Messages",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "string": [{
            "value": "={{ $json.message.chat.type }}",
            "operation": "equals",
            "value2": "supergroup"
          }]
        }
      }
    }
  ]
}
```

**What this does:**
- Triggers on every new Telegram message
- Filters for group messages only
- Passes message data to next step

## Step 2: AI Lead Classification

### Workflow: Score the Lead

```json
{
  "nodes": [
    {
      "name": "AI Classifier",
      "type": "n8n-nodes-base.openAi",
      "parameters": {
        "model": "gpt-4o-mini",
        "messages": {
          "values": [{
            "content": "Classify this Telegram message as HOT, WARM, or COLD lead for our B2B SaaS product. Message: {{ $json.message.text }}"
          }]
        }
      }
    },
    {
      "name": "Filter Hot Leads",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "string": [{
            "value": "={{ $json.choices[0].message.content }}",
            "operation": "contains",
            "value2": "HOT"
          }]
        }
      }
    }
  ]
}
```

**What this does:**
- Sends message to GPT-4o-mini for classification
- Filters only HOT leads
- Passes to CRM step

## Step 3: CRM Pipeline

### Workflow: Create Lead in CRM

```json
{
  "nodes": [
    {
      "name": "Create Lead",
      "type": "n8n-nodes-base.hubspot",
      "parameters": {
        "resource": "contact",
        "operation": "create",
        "additionalFields": {
          "email": "={{ $json.message.from.username }}@telegram.user",
          "firstName": "={{ $json.message.from.first_name }}",
          "telegramHandle": "={{ $json.message.from.username }}",
          "leadScore": "HOT",
          "source": "Telegram"
        }
      }
    }
  ]
}
```

**Alternative CRM integrations:**
- HubSpot (official node)
- Salesforce (official node)
- Pipedrive (community node)
- Airtable (official node)
- Google Sheets (for simple setups)

## Step 4: Email Follow-up

### Workflow: Send Welcome Email

```json
{
  "nodes": [
    {
      "name": "Send Email",
      "type": "n8n-nodes-base.emailSend",
      "parameters": {
        "fromEmail": "hello@yourcompany.com",
        "toEmail": "={{ $json.email }}",
        "subject": "Thanks for your interest, {{ $json.firstName }}!",
        "text": "Hi {{ $json.firstName }},\n\nI noticed your message in {{ $json.groupName }}. We help companies like yours automate lead generation.\n\nWould you like a quick demo?\n\nBest,\nYour Name"
      }
    }
  ]
}
```

## Step 5: Notification

### Workflow: Slack Notification

```json
{
  "nodes": [
    {
      "name": "Slack Notification",
      "type": "n8n-nodes-base.slack",
      "parameters": {
        "channel": "#leads",
        "text": "🔥 New HOT lead!\n\nName: {{ $json.firstName }}\nTelegram: @{{ $json.telegramHandle }}\nGroup: {{ $json.groupName }}\nMessage: {{ $json.messageText }}"
      }
    }
  ]
}
```

## Complete Workflow Template

Here's the full pipeline in one workflow:

```json
{
  "name": "Telegram Lead Generation Pipeline",
  "nodes": [
    "Telegram Trigger",
    "Filter Group Messages",
    "AI Classifier",
    "Filter Hot Leads",
    "Create CRM Lead",
    "Send Welcome Email",
    "Slack Notification"
  ],
  "connections": [
    "Telegram Trigger → Filter Group Messages",
    "Filter Group Messages → AI Classifier",
    "AI Classifier → Filter Hot Leads",
    "Filter Hot Leads → Create CRM Lead",
    "Create CRM Lead → Send Welcome Email",
    "Send Welcome Email → Slack Notification"
  ]
}
```

## Advanced Workflows

### Multi-Source Lead Aggregation

Combine leads from multiple sources:

```
Telegram Scanner ──┐
                   ├──→ Lead Aggregator → Deduplicate → CRM
VK Scanner ────────┤
                   │
Website Form ──────┘
```

### Lead Scoring Pipeline

```
New Lead → AI Score → Enrich (Clearbit/Apollo) → Score Adjustment → CRM
```

### Automated Follow-up Sequence

```
Day 0: Welcome email
Day 3: Case study email
Day 7: Product demo email
Day 14: Last chance email
```

## Self-Hosting n8n

### Docker Setup (5 minutes)

```bash
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=yourpassword \
  n8nio/n8n
```

### Docker Compose Setup

```yaml
version: '3'
services:
  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=yourpassword
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
```

### Cost Comparison

| Hosting | Monthly Cost | Best For |
|---------|-------------|----------|
| Self-hosted (VPS) | $5-10 |个人项目 |
| Self-hosted (cloud) | $20-50 | Teams |
| n8n Cloud | $20-50 | No maintenance |

## Integration Examples

### Telegram + 24GO + n8n

```
24GO (lead capture) → Webhook → n8n → CRM + Email + Slack
```

### Telegram + Make + Airtable

```
Telegram Bot → Make.com → Airtable → Email Sequence
```

### Telegram + Custom API + PostgreSQL

```
Telegram Listener → FastAPI → PostgreSQL → n8n → Notifications
```

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Rate limits on Telegram API | Add delays between messages |
| AI classification errors | Fine-tune prompts, add human review |
| CRM sync failures | Add retry logic, error notifications |
| Duplicate leads | Add deduplication step |
| Email deliverability | Use proper SPF/DKIM, warm up domain |

## Monitoring Your Workflows

### n8n Built-in Monitoring
- Execution history
- Error logs
- Execution time tracking

### External Monitoring
- Uptime monitoring (UptimeRobot)
- Webhook health checks
- CRM sync status

## Conclusion

n8n gives you full control over your lead generation pipeline without code. Start with the basic workflow, then add complexity as you scale. The combination of Telegram + AI + CRM + Email creates a fully automated lead machine.""",
        "content_ru": """# Автоматизация лидогенерации с n8n: полное руководство 2026

n8n — это инструмент автоматизации workflow с открытым исходным кодом, который соединяет стек лидогенерации без кода. Это руководство покажет, как строить автоматизированные пайплайны от парсинга Telegram до синхронизации с CRM до email-фоллоу-апов.

## Что такое n8n?

n8n (читается «нодемейшн») — это платформа автоматизации workflow с самостоятельным хостингом. Как Zapier, но:
- **Бесплатно** (самостоятельный хостинг)
- **Неограниченные выполнения** (без оплаты за таск)
- **Пользовательский код** (JavaScript/Python в workflow)
- **Самостоятельный хостинг** (твои данные остаются твоими)

## Почему n8n для лидогенерации?

| Функция | n8n | Zapier | Make |
|---------|-----|--------|------|
| Стоимость | Бесплатно (self-hosted) | $20-50/мес | $9-29/мес |
| Выполнения | Неограниченно | 750-2000/мес | 1000-10000/мес |
| Self-hosted | Да | Нет | Нет |
| Кастомный код | Полный JS/Python | Ограничен | Ограничен |
| Telegram интеграция | Официальный нода | Ограничен | Хороший |
| AI ноды | Встроенные | Базовые | Хорошие |
| Webhooks | Неограниченно | Ограничены | Ограничены |

## Архитектура: стек лидогенерации

Вот полный пайплайн, который мы построим:

```
1. Сканер Telegram-групп
   ↓ (новые сообщения)
2. AI-классификатор лидов
   ↓ (квалифицированные лиды)
3. CRM-пайплайн
   ↓ (новый лид)
4. Email-последовательность
   ↓ (фоллоу-ап)
5. Уведомление в Slack/Discord
```

## Шаг 1: Сканер сообщений Telegram

### Workflow: Новые сообщения из групп

```json
{
  "nodes": [
    {
      "name": "Telegram Trigger",
      "type": "n8n-nodes-base.telegramTrigger",
      "parameters": {
        "updates": ["message"]
      }
    },
    {
      "name": "Filter Group Messages",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "string": [{
            "value": "={{ $json.message.chat.type }}",
            "operation": "equals",
            "value2": "supergroup"
          }]
        }
      }
    }
  ]
}
```

**Что делает:**
- Триггерится на каждое новое сообщение в Telegram
- Фильтрует только сообщения из групп
- Передаёт данные сообщения на следующий шаг

## Шаг 2: AI-классификация лидов

### Workflow: Оценка лида

```json
{
  "nodes": [
    {
      "name": "AI Classifier",
      "type": "n8n-nodes-base.openAi",
      "parameters": {
        "model": "gpt-4o-mini",
        "messages": {
          "values": [{
            "content": "Classify this Telegram message as HOT, WARM, or COLD lead for our B2B SaaS product. Message: {{ $json.message.text }}"
          }]
        }
      }
    },
    {
      "name": "Filter Hot Leads",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "string": [{
            "value": "={{ $json.choices[0].message.content }}",
            "operation": "contains",
            "value2": "HOT"
          }]
        }
      }
    }
  ]
}
```

**Что делает:**
- Отправляет сообщение в GPT-4o-mini для классификации
- Фильтрует только HOT-лиды
- Передаёт на шаг CRM

## Шаг 3: CRM-пайплайн

### Workflow: Создание лида в CRM

```json
{
  "nodes": [
    {
      "name": "Create Lead",
      "type": "n8n-nodes-base.hubspot",
      "parameters": {
        "resource": "contact",
        "operation": "create",
        "additionalFields": {
          "email": "={{ $json.message.from.username }}@telegram.user",
          "firstName": "={{ $json.message.from.first_name }}",
          "telegramHandle": "={{ $json.message.from.username }}",
          "leadScore": "HOT",
          "source": "Telegram"
        }
      }
    }
  ]
}
```

**Альтернативные CRM-интеграции:**
- HubSpot (официальный нода)
- Salesforce (официальный нода)
- Pipedrive (community нода)
- Airtable (официальный нода)
- Google Sheets (для простых настроек)

## Шаг 4: Email-фоллоу-ап

### Workflow: Отправка приветственного email

```json
{
  "nodes": [
    {
      "name": "Send Email",
      "type": "n8n-nodes-base.emailSend",
      "parameters": {
        "fromEmail": "hello@yourcompany.com",
        "toEmail": "={{ $json.email }}",
        "subject": "Thanks for your interest, {{ $json.firstName }}!",
        "text": "Hi {{ $json.firstName }},\n\nI noticed your message in {{ $json.groupName }}. We help companies like yours automate lead generation.\n\nWould you like a quick demo?\n\nBest,\nYour Name"
      }
    }
  ]
}
```

## Шаг 5: Уведомление

### Workflow: Уведомление в Slack

```json
{
  "nodes": [
    {
      "name": "Slack Notification",
      "type": "n8n-nodes-base.slack",
      "parameters": {
        "channel": "#leads",
        "text": "🔥 New HOT lead!\n\nName: {{ $json.firstName }}\nTelegram: @{{ $json.telegramHandle }}\nGroup: {{ $json.groupName }}\nMessage: {{ $json.messageText }}"
      }
    }
  ]
}
```

## Полный шаблон workflow

Вот полный пайплайн в одном workflow:

```json
{
  "name": "Telegram Lead Generation Pipeline",
  "nodes": [
    "Telegram Trigger",
    "Filter Group Messages",
    "AI Classifier",
    "Filter Hot Leads",
    "Create CRM Lead",
    "Send Welcome Email",
    "Slack Notification"
  ],
  "connections": [
    "Telegram Trigger → Filter Group Messages",
    "Filter Group Messages → AI Classifier",
    "AI Classifier → Filter Hot Leads",
    "Filter Hot Leads → Create CRM Lead",
    "Create CRM Lead → Send Welcome Email",
    "Send Welcome Email → Slack Notification"
  ]
}
```

## Продвинутые workflow

### Агрегация лидов из нескольких источников

```
Сканер Telegram ──┐
                  ├──→ Агрегатор лидов → Дедупликация → CRM
Сканер VK ────────┤
                  │
Форма сайта ──────┘
```

### Пайплайн скоринга лидов

```
Новый лид → AI-оценка → Обогащение (Clearbit/Apollo) → Корректировка оценки → CRM
```

### Автоматическая последовательность фоллоу-апов

```
День 0: Приветственный email
День 3: Email с кейсом
День 7: Email с демо продукта
День 14: Последний email
```

## Самостоятельный хостинг n8n

### Docker-установка (5 минут)

```bash
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=yourpassword \
  n8nio/n8n
```

### Docker Compose установка

```yaml
version: '3'
services:
  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=yourpassword
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
```

### Сравнение стоимости

| Хостинг | Стоимость/мес | Для кого |
|---------|---------------|----------|
| Self-hosted (VPS) | $5-10 | Личные проекты |
| Self-hosted (облако) | $20-50 | Команды |
| n8n Cloud | $20-50 | Без обслуживания |

## Примеры интеграций

### Telegram + 24GO + n8n

```
24GO (захват лидов) → Webhook → n8n → CRM + Email + Slack
```

### Telegram + Make + Airtable

```
Telegram Bot → Make.com → Airtable → Email-последовательность
```

### Telegram + Кастомный API + PostgreSQL

```
Telegram Listener → FastAPI → PostgreSQL → n8n → Уведомления
```

## Частые ошибки

| Ошибка | Решение |
|--------|---------|
| Лимиты Telegram API | Добавить задержки между сообщениями |
| Ошибки AI-классификации | Доработать промпты, добавить ручную проверку |
| Сбои синхронизации CRM | Добавить retry-логику, уведомления об ошибках |
| Дубли лидов | Добавить шаг дедупликации |
| Доставляемость email | Использовать SPF/DKIM, прогревать домен |

## Мониторинг workflow

### Встроенный мониторинг n8n
- История выполнений
- Логи ошибок
- Отслеживание времени выполнения

### Внешний мониторинг
- Мониторинг аптайма (UptimeRobot)
- Проверки здоровья webhook
- Статус синхронизации CRM

## Вывод

n8n даёт полный контроль над пайплайном лидогенерации без кода. Начни с базового workflow, затем добавляй сложность по мере масштабирования. Комбинация Telegram + AI + CRM + Email создаёт полностью автоматизированную машину лидов.""",
    },
]


async def seed():
    import asyncpg
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        for a in ARTICLES:
            exists = await conn.fetchval(
                "SELECT id FROM blog_posts WHERE slug = $1 AND tenant_id = $2",
                a["slug"], TENANT_ID,
            )
            if exists:
                print(f"Skip (exists): {a['slug']}")
                continue

            await conn.execute(
                """INSERT INTO blog_posts
                (id, tenant_id, slug, title_en, title_ru, content_en, content_ru,
                 excerpt_en, excerpt_ru, meta_description_en, meta_description_ru,
                 tags, published, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,TRUE,NOW(),NOW())""",
                uuid.uuid4(), TENANT_ID, a["slug"],
                a["title_en"], a["title_ru"],
                a["content_en"], a["content_ru"],
                a["excerpt_en"], a["excerpt_ru"],
                a["meta_description_en"], a["meta_description_ru"],
                __import__("json").dumps(a["tags"]),
            )
            print(f"Inserted: {a['slug']}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
