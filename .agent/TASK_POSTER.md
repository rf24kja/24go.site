.agent/TASK_POSTER.md
# Specification: Content Distribution & Anti-Detection Execution Engine (v5.0 Enterprise SaaS)

## 1. System Role & Autonomous Scope
The Content Distribution & Anti-Detection Engine (`worker-poster`) is an asynchronous microservice responsible for taking campaign blueprints, performing dynamic LLM text rewrites, appending UTM links, mapping active social accounts with sticky mobile proxies, and executing publications across Telegram and VKontakte. 

The service emulates human input behavior and strictly adheres to platform rate limits to protect account pools from detection and bans.

---

## 2. Multi-Tenant Posting Architecture


+-----------------------------------------------------------------------------------+ | Posting Task Workflow (Per Tenant) | +-----------------------------------------------------------------------------------+ | v +-----------------------------------------------------------------------------------+ | 1. Fetch Task Payload & Assigned Account from Redis Queue | | (Scoped by tenant_id, account_id, target_id, campaign_id) | +-----------------------------------------+-----------------------------------------+ | v +-----------------------------------------------------------------------------------+ | 2. Dynamic LLM Rewriting & Spintax Generation | | - Inject Regional GEO context (e.g. Moscow, SPb, Kamchatka, Novosibirsk) | | - Append Unique UTM Trackable Short Link | +-----------------------------------------+-----------------------------------------+ | v +-----------------------------------------------------------------------------------+ | 3. Anti-Detection & Human Emulation Execution | | - Attach Assigned Mobile Proxy (Sticky Session) | | - Execute Patchright Stealth (VK) or Telethon UserBot (Telegram) | | - Human Typing Simulation (30-80 wpm jitter) + Pre-Action Random Delays | +-----------------------------------------+-----------------------------------------+ | v +-----------------------------------------------------------------------------------+ | 4. Update Database Logs & Account Limits | | - Record in posting_logs & Increment actions_today | +-----------------------------------------------------------------------------------+
---

## 3. Dynamic AI Rewriting & Regional Context Engine

Every single published post MUST be unique. Raw campaign templates are passed through an LLM endpoint (DeepSeek / OpenAI) with strict regional customization rules.

### Prompt Template for System Engine

[System Context] You are an expert SMM copywriter specializing in travel to Thailand and Phuket real estate/tours. Your goal is to rewrite the provided BASE_TEXT into a highly natural, engaging forum or group comment.
[Constraints]
    1. Do NOT sound like an aggressive ad. Use a conversational, helpful tone.
    2. Adapt the opening sentence to reflect the user's regional origin based on GEO_TAG:
        ? GEO_TAG "Kamchatka": Mention convenient connecting flights, escaping long cold winters, or direct Pacific routes.
        ? GEO_TAG "Novosibirsk": Mention direct flights from Tolmachevo (OVB), winter escapes to warm seas.
        ? GEO_TAG "Moscow": Mention flight options from SVO/DME/VKO, quick getaway packages.
        ? GEO_TAG "SPb": Mention departures from Pulkovo (LED) or travel planning from the North-West.
    3. Keep the core call-to-action intact, placing the provided TRACKING_URL naturally at the end.
    4. Maximum length: 450 characters.
BASE_TEXT: "{{campaign.base_text}}" GEO_TAG: "{{target.geo_tag}}" TRACKING_URL: "{{unique_utm_url}}"
---

## 4. Human Emulation & Anti-Detection Protocol

To bypass platform anti-spam algorithms (Telegram FloodWait and VK Anti-Spam), the worker MUST execute the following sequence:

### A. Pre-Action Warmup & Navigation Jitter
- **Random Pause**: Sleep for a random interval ($t \in [15, 45]$ seconds) before initiating target connection.
- **Read Emulation**: 
  - Telegram: Send `read_history` event on the channel before posting a comment.
  - VK (Patchright): Scroll the target page down by $200-500$ px, wait $2.5$ seconds, scroll back up before clicking reply.

### B. Human Input Speed Simulation
When populating text inputs, do NOT paste entire text blocks instantly. Emulate keystroke timing using Gaussian distribution:
- **Keystroke Delay**: Between $50\text{ ms}$ and $180\text{ ms}$ per character.
- **Typing Pauses**: Inject a $1.5\text{s} - 3.5\text{s}$ pause at punctuation marks (`.`, `,`, `!`, `?`).

### C. Sticky Proxy Binding
- Every account in `account_pool` is bound to a specific `proxy_id`.
- Connections MUST originate from the assigned mobile proxy IP. 
- If proxy connection fails, do NOT fallback to direct host IP. Abort task and flag account status as `cooldown`.

---

## 5. Daily Execution Limits & Cooldown Rules

| Platform | Max Actions / Day (New Acc) | Max Actions / Day (Warmed Acc) | Delay Between Posts |
| :--- | :--- | :--- | :--- |
| **Telegram (Comments)** | 10 actions | 25 actions | $20 - 45\text{ minutes}$ |
| **Telegram (Direct DM)** | 5 DMs | 15 DMs | $45 - 90\text{ minutes}$ |
| **VKontakte (Wall Post)** | 8 posts | 20 posts | $15 - 30\text{ minutes}$ |
| **VKontakte (Comments)** | 15 comments | 40 comments | $10 - 25\text{ minutes}$ |

---

## 6. Execution Payload Schema (`posting_queue`)

```json
{
  "tenant_id": "cfa84489-0b42-4e89-9a0c-7b707412fa01",
  "task_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "campaign_id": "e3012921-70e2-45a8-89c0-9d2a67e0e7a2",
  "target_id": "f58d99d1-0164-4e2b-bb3b-9a48bb5e45a1",
  "account_id": "78a10123-55b2-4cd8-8901-1b2c3d4e5f6a",
  "platform": "telegram",
  "access_level": "open_comments",
  "target_code": "@phuket_chat_moscow",
  "base_text": "????? ???????? ??? ?????? ?? ??????? ???? ?????? ??????? ?????? ??????????? ?? ?????? ? ??????????.",
  "geo_tag": "Moscow",
  "utm_url": "[https://service-domain.com/l/v5?t=cfa84489&g=moscow](https://service-domain.com/l/v5?t=cfa84489&g=moscow)"
}

