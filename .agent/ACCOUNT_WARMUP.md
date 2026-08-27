.agent/ACCOUNT_WARMUP.md
# Specification: Account Warm-Up & Anti-Ban Lifecycle Engine (v5.0 Enterprise SaaS)

## 1. System Role & Lifecycle Scope
The Account Warm-Up & Anti-Ban Subsystem is responsible for taking fresh Telegram `.session` credentials and VKontakte API tokens, generating unique device fingerprints, and guiding each account through a mandatory 3-stage automated warm-up lifecycle. 

Without complete warm-up, social accounts risk immediate chain-freezes and mass bans upon joining target hubs or posting commercial content.

---

## 2. Automated Warm-Up Lifecycle Matrix


+-----------------------------------------------------------------------------------+ | 3-Stage Account Progression Matrix | +-----------------------------------------------------------------------------------+ | v +-----------------------------------------------------------------------------------+ | STAGE 1: Passive Trust Building (Days 1 - 3) | | - Read channel feeds, react to posts, emulate human activity. | | - Commercial Actions Allowed: 0 | +-----------------------------------------+-----------------------------------------+ | v +-----------------------------------------------------------------------------------+ | STAGE 2: Soft Engagement & Natural Interactions (Days 4 - 7) | | - Join neutral public groups, post non-commercial comments in general topics. | | - Commercial Actions Allowed: Max 3 - 5 / day | +-----------------------------------------+-----------------------------------------+ | v +-----------------------------------------------------------------------------------+ | STAGE 3: Production Active Status (Day 8+) | | - Full commercial campaign execution unlocked. | | - Commercial Actions Allowed: 15 - 25 / day (Staggered Execution) | +-----------------------------------------------------------------------------------+
---

## 3. Hardware Fingerprinting & Identity Binding Standard

To prevent cross-account contamination, every account created within or imported into a tenant's pool MUST be bound to a static hardware identity (`device_fingerprint`).

### A. Telegram Hardware Fingerprint Schema (`device_fingerprint`)
```json
{
  "app_id": 2040,
  "app_hash": "b18441a1ed60db414ed8570212e34123",
  "device_model": "Samsung Galaxy S23 Ultra",
  "system_version": "Android 14 (API 34)",
  "app_version": "10.6.2",
  "lang_code": "ru",
  "system_lang_code": "ru-RU",
  "timezone": "Asia/Bangkok"
}

B. Binding Rules
    1. Static Mobile Proxy Mapping: An account is assigned a dedicated mobile proxy endpoint (proxy_id). The IP address may rotate on time triggers, but geographic location (e.g., Moscow / SPb / Novosibirsk mobile subnet) MUST remain consistent with the account's operational GEO.
    2. Session Persistence: Re-authenticating or generating new Telethon session strings for an active account from different subnets is strictly forbidden.
4. Stage-by-Stage Warm-Up Execution Protocols
Stage 1: Passive Trust Building (Days 1 to 3)
    • Objective: Establish baseline telemetry with Telegram/VK servers.
    • Daily Actions Routine:
        ? Connect to account via assigned proxy.
        ? Fetch 5 neutral news channels (e.g., regional news, weather channels).
        ? Emulate reading: Send read_history events at random intervals (45\text{s} - 120\text{s}).
        ? Leave 2 - 4 random emoji reactions (\text{?}, \text{??}, \text{?}) on recent posts.
    • Limits: daily_action_limit = 0 (Zero commercial posts or DMs).
Stage 2: Soft Engagement (Days 4 to 7)
    • Objective: Simulate active human social participant.
    • Daily Actions Routine:
        ? Join 2 neutral public chats related to travel or general chat topics.
        ? Generate non-commercial comments using LLM soft prompt:"Write a brief, friendly comment agreeing with a post about weather or general travel advice. Do NOT include links, prices, or services."
        ? Receive and scroll incoming private messages if any arrive.
    • Limits: daily_action_limit = 5 actions/day.
Stage 3: Production Readiness (Day 8 Onward)
    • Objective: Execute commercial lead generation and posting tasks.
    • Database Status Update:
UPDATE account_pool 
SET status = 'active', warmup_stage = 3, daily_action_limit = 20 
WHERE id = :account_id AND tenant_id = :tenant_id;

5. Automated Cooldown & Ban Circuit Breaker
The system continuously monitors error responses from social platform APIs.
+-----------------------------------------------------------------------------------+
|                        Circuit Breaker State Machine                              |
+-----------------------------------------------------------------------------------+
                                          |
        +---------------------------------+---------------------------------+
        |                                                                   |
        v                                                                   v
[HTTP 429 / FloodWait Triggered]                                   [ACCOUNT_REVOKED / BANNED]
        |                                                                   |
        v                                                                   v
Set Status to 'cooldown'                                           Set Status to 'banned'
cooldown_until = NOW() + INTERVAL '4 hours'                         Send Telegram Notification to Tenant Admin
Trigger Mobile Proxy IP Rotation                                    Quarantine Session Credentials

Circuit Breaker Code Protocol (Python Example)
async def handle_account_exception(tenant_id: str, account_id: str, exc: Exception, db_session):
    if "FLOOD_WAIT" in str(exc) or "429" in str(exc):
        # Extract wait seconds or fallback to 4 hours
        cooldown_hours = 4
        await db_session.execute(
            text("""
                UPDATE account_pool 
                SET status = 'cooldown', cooldown_until = NOW() + INTERVAL ':hours hours'
                WHERE id = :account_id AND tenant_id = :tenant_id
            """),
            {"account_id": account_id, "tenant_id": tenant_id, "hours": cooldown_hours}
        )
    elif "SESSION_REVOKED" in str(exc) or "USER_BANNED" in str(exc):
        await db_session.execute(
            text("""
                UPDATE account_pool 
                SET status = 'banned' 
                WHERE id = :account_id AND tenant_id = :tenant_id
            """),
            {"account_id": account_id, "tenant_id": tenant_id}
        )
