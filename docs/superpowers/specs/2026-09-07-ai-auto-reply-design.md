# AI Auto-Reply — Unified Settings Design

## Problem

Current system has two separate settings sections (`llm` + `auto_reply`) that work independently:
- `llm`: provider, model, classification prompt, keywords, thresholds
- `auto_reply`: enabled, min_intent, reply_mode, replies[], delay, rate_limit

Additionally, `auto_replies` page exists with CRUD for keyword/ai_agent/rotation rules but is **dead code** — the worker never reads from it. Fields like `blacklist_usernames` and `work_hours` exist in UI but are not consumed by the worker.

## Goal

Merge everything into **one section: "AI Auto-Reply"** in Settings. One LLM config, one place to configure, no duplication.

## New Section Structure

### Block 1: LLM Provider
Shared for classification + reply generation.

```yaml
provider: auto | openrouter | deepseek | openai | keyword_only
api_key: ""           # encrypted
model: "deepseek-chat"
```

### Block 2: Classification
How incoming messages are scored.

```yaml
system_prompt: "You are an expert sales analyst..."  # current LLM prompt
hot_keywords: ["сколько стоит", "цена", ...]
warm_keywords: ["подскажите", "какие есть", ...]
spam_keywords: ["casino", "crypto", ...]
hot_threshold: 2
warm_threshold: 1
confidence_threshold: 0.5
```

### Block 3: AI Reply Generation
How HOT leads get unique AI responses.

```yaml
reply_prompt: "Ты — вежливый менеджер по продажам. Отвечай на русском кратко и по делу. Используй информацию из сообщения клиента."
reply_temperature: 0.7
reply_max_tokens: 500
```

### Block 4: Reply Rules
What triggers a reply and how.

```yaml
ai_reply_for: "HOT"          # "HOT" | "HOT+WARM" | "OFF"
template_reply_for: "WARM"   # "WARM" | "OFF" (only shown when ai_reply_for != OFF)
reply_mode: "random"         # "random" | "cyclic"
templates: [                  # used for template replies
  "Спасибо за интерес! Менеджер свяжется с вами. 🙏",
  "Здравствуйте! Мы скоро ответим. 😊"
]
```

Logic:
- Lead intent >= `ai_reply_for` threshold → LLM generates unique reply
- Lead intent matches `template_reply_for` → random/cyclic from templates
- Below both thresholds → no reply

### Block 5: Schedule & Limits
```yaml
reply_enabled: true
channels:
  telegram: true
  vkontakte: true
reply_delay_seconds: 5
max_replies_per_hour: 10
work_hours_start: 9
work_hours_end: 21
blacklist_usernames: ""
```

## Files to Change

### Backend
1. **`services/backend/app/tenant_settings.py`** — merge `llm` + `auto_reply` defaults into `ai_auto_reply`
2. **`services/worker/app/tenant_settings.py`** — same merge
3. **`services/worker/app/auto_reply.py`** — rewrite: support AI generation mode (call LLM) + template mode, add work-hours + per-channel checks
4. **`services/worker/app/lead_pipeline.py`** — read from `ai_auto_reply` instead of separate `llm` + `auto_reply`
5. **`services/worker/app/llm_classifier.py`** — accept `ai_auto_reply` config instead of flat `tenant_cfg`
6. **`services/backend/app/routers/tenant_settings.py`** — add `ai_auto_reply` to DEFAULTS, keep backward compat for migration

### Frontend
7. **`services/dashboard/src/app/(dashboard)/settings/page.tsx`** — replace "AI & Classification" + "Auto-Reply Bot" sections with single "AI Auto-Reply" section
8. **`services/dashboard/src/lib/i18n/en.json`** — add new keys
9. **`services/dashboard/src/lib/i18n/ru.json`** — add new keys

### Cleanup
10. **Delete** `services/dashboard/src/app/(dashboard)/auto-replies/` page (dead code)
11. **Remove** auto-replies API calls from `api.ts`

## Migration

On first load of settings, if old `llm` or `auto_reply` sections exist in tenant_settings:
1. Merge into new `ai_auto_reply` structure
2. Save merged result
3. Remove old keys

This can be done in the backend `getTenantSettings` endpoint or in a one-time migration script.

## Worker Flow (after changes)

```
Incoming DM
  → classify_message(text, ai_auto_reply_cfg)
  → upsert lead with intent_score
  → if ai_auto_reply.reply_enabled:
      → check channel (TG/VK toggle)
      → check work hours
      → check rate limit
      → if intent >= ai_reply_for threshold:
          → call LLM with reply_prompt + message context → send unique reply
      → elif intent >= template_reply_for threshold:
          → pick template (random/cyclic) → send template reply
```
