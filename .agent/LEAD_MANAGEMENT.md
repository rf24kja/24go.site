\# `.agent/LEAD\_MANAGEMENT.md`



```markdown

\# Specification: Real-Time Lead Interception, LLM Qualification \& CRM Router (v5.0 Enterprise SaaS)



\## 1. System Role \& Scope

The Lead Interception \& Management System (`worker-listener`) is an asynchronous microservice responsible for real-time monitoring of incoming private messages, comment replies, and group mentions directed at accounts in `account\_pool`. 



Upon detecting an incoming message, the service executes dynamic zero-shot LLM qualification to assign intent levels (`HOT`, `WARM`, `COLD`, `SPAM`), extracts regional and contact parameters, creates lead records in PostgreSQL scoped to `tenant\_id`, and immediately routes high-priority leads to client webhooks and mobile notifications.



\---



\## 2. Real-Time Lead Processing Pipeline





```



+-----------------------------------------------------------------------------------+

|                        Lead Interception Pipeline (Per Tenant)                    |

+-----------------------------------------------------------------------------------+

|

v

+-----------------------------------------------------------------------------------+

| 1. Intercept Incoming Message / Private DM / Comment Mention                      |

|    (Telethon Event.NewMessage / VK Callback Server / Polling Daemon)               |

+-----------------------------------------+-----------------------------------------+

|

v

+-----------------------------------------------------------------------------------+

| 2. Zero-Shot LLM Intent Classification \& Extract Parameters                        |

|    - Classify: HOT (High purchase intent), WARM, COLD, SPAM                      |

|    - Extract: Contact Handle, Budget Range, Target Dates, GEO Origin              |

+-----------------------------------------+-----------------------------------------+

|

v

+-----------------------------------------------------------------------------------+

| 3. Database Upsert (`leads`) \& Deduplication Check                                |

|    - Lock by `tenant\_id` + `user\_handle`                                          |

+-----------------------------------------+-----------------------------------------+

|

v

+-----------------------------------------------------------------------------------+

| 4. Instant Multi-Channel Dispatch Router                                           |

|    - If HOT/WARM: Dispatch Webhook to Client CRM (AmoCRM / Bitrix24 / Custom)     |

|    - Dispatch n8n Event Relay for Instant Mobile Push Notification                 |

+-----------------------------------------------------------------------------------+



```



\---



\## 3. LLM Intent Qualification Taxonomy \& Scoring Protocol



Every incoming message body is evaluated by an LLM classification prompt (DeepSeek-V3 / OpenAI GPT-4o-mini).



\### Intent Classification Matrix



| Score Level | Description | Example Message Criteria | Automated System Action |

| :--- | :--- | :--- | :--- |

| `HOT` | Immediate purchase intent, specific pricing requests, urgent travel or real estate inquiries. | \*"Здравствуйте! Сколько стоит вилла на Банг Тао с 10 ноября на 2 недели? Готовы забронировать."\* | \*\*Instant Mobile Alert + Push to CRM Webhook\*\*. |

| `WARM` | General interest, asking for options, catalog requests, long-term planning. | \*"Подскажите, какие есть экскурсии на Пхукете с детьми? И где лучше менять валюту?"\* | Add to Lead Kanban (`Status: New`), Notify Operator. |

| `COLD` | Obscure questions, single-word responses, casual reactions without clear commercial goal. | \*"Спасибо за информацию"\*, \*"А где это?"\* | Log lead in database without mobile escalation. |

| `SPAM` | Automated bots, spam offers, competitor promos, abusive language. | \*"Заработок от 1000$ в день без вложений! Жми..."\* | Auto-flag as `SPAM`, ignore notification, mute user. |



\---



\## 4. LLM Classification System Prompt Standard





```



\[System Role]

You are an expert sales analyst for a B2B travel and real estate lead generation system in Thailand (Phuket).

Your task is to analyze an incoming private message or comment reply and extract key qualification parameters.



\[Input Data]



\* SENDER\_HANDLE: "{{incoming\_msg.user\_handle}}"

\* MESSAGE\_TEXT: "{{incoming\_msg.message\_text}}"

\* CHANNEL\_GEO\_TAG: "{{target.geo\_tag}}"



\[Output Requirement]

Return strictly a valid JSON object with the following fields:

{

"intent\_score": "HOT" | "WARM" | "COLD" | "SPAM",

"confidence": 0.00 to 1.00,

"summary": "Brief 1-sentence summary of the buyer request in Russian",

"extracted\_parameters": {

"geo\_origin": "Extracted city/region or null if unknown",

"budget\_mentioned": "Extracted budget string or null",

"dates\_mentioned": "Extracted dates string or null",

"service\_category": "villas" | "tours" | "real\_estate\_buy" | "currency" | "general"

}

}



\[Constraint]

Return ONLY the JSON string. Do NOT include markdown code fences or conversational text.



```



\---



\## 5. Automated CRM Webhook Dispatch Standard



When a lead is saved with `intent\_score = 'HOT'` or `'WARM'`, the system dispatches an outbound JSON payload to the client's configured CRM integration endpoint (`POST /api/v1/integrations/crm-webhook`).



\### Webhook Payload Schema

```json

{

&#x20; "event": "lead\_classified",

&#x20; "tenant\_id": "cfa84489-0b42-4e89-9a0c-7b707412fa01",

&#x20; "lead": {

&#x20;   "id": "8a32d194-e811-4712-ba55-94f4c28109aa",

&#x20;   "platform": "telegram",

&#x20;   "user\_handle": "@traveler\_2026",

&#x20;   "user\_full\_name": "Alexander M.",

&#x20;   "geo\_tag": "Novosibirsk",

&#x20;   "intent\_score": "HOT",

&#x20;   "confidence\_score": 0.96,

&#x20;   "summary": "Запрос стоимости аренды виллы на Банг Тао на 2 недели в ноябре.",

&#x20;   "extracted\_parameters": {

&#x20;     "geo\_origin": "Novosibirsk",

&#x20;     "budget\_mentioned": null,

&#x20;     "dates\_mentioned": "10-24 ноября",

&#x20;     "service\_category": "villas"

&#x20;   },

&#x20;   "message\_text": "Здравствуйте! Сколько стоит аренда виллы на Банг Тао на 2 недели в ноябре?",

&#x20;   "dialog\_url": "\[https://t.me/traveler\_2026](https://t.me/traveler\_2026)",

&#x20;   "created\_at": "2026-08-27T03:25:00Z"

&#x20; }

}



```



\---



\## 6. Database Upsert \& Deduplication Query



To handle repeat messages from the same lead without creating duplicate cards on the Kanban board:



```sql

INSERT INTO leads (

&#x20;   id, tenant\_id, platform, target\_id, account\_id, user\_handle, 

&#x20;   user\_full\_name, geo\_tag, message\_text, intent\_score, status, dialog\_url, created\_at

) VALUES (

&#x20;   gen\_random\_uuid(), :tenant\_id, :platform, :target\_id, :account\_id, :user\_handle,

&#x20;   :user\_full\_name, :geo\_tag, :message\_text, :intent\_score, 'new', :dialog\_url, NOW()

)

ON CONFLICT (id) DO UPDATE SET

&#x20;   message\_text = EXCLUDED.message\_text,

&#x20;   intent\_score = EXCLUDED.intent\_score,

&#x20;   created\_at = NOW();

