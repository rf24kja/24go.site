.agent/ORCHESTRATION_ENGINE.md
# Specification: Asynchronous Task Orchestration & Queue Architecture (v5.0 Enterprise SaaS)

## 1. System Role & Architectural Shift
This document defines the high-concurrency background processing and queue orchestration layer (`orchestration-engine`). 

To prevent systemic performance bottlenecks and memory crashes under multi-tenant scale (e.g., 50+ clients running hundreds of simultaneous account actions), **core business logic, scraping, posting, and heavy worker loops are completely decoupled from n8n**.

n8n is utilized strictly as a lightweight, event-driven notification relay and CRM webhook integration layer. All distributed execution, state scheduling, proxy rotation, and queue handling are governed by **Celery 5.x**, **Redis 7 Stack**, and **FastAPI**.

---

## 2. Distributed Queue Topology


+-----------------------------------------------------------------------------------+ | FastAPI Control Plane (Producer) | +-----------------------------------------+-----------------------------------------+ | v +-----------------------------------------------------------------------------------+ | Redis 7 Queue Broker | | | | +-----------------------+ +-----------------------+ +-----------------------+ | | | Queue: parser_tasks | | Queue: poster_tasks | | Queue: warmup_tasks | | | +-----------------------+ +-----------------------+ +-----------------------+ | | +-----------------------+ +-----------------------+ | | | Queue: listener_tasks | | Queue: billing_events | | | +-----------------------+ +-----------------------+ | +-----------------------------------------+-----------------------------------------+ | +---------------------------------+---------------------------------+ | | | v v v +---------------+ +---------------+ +---------------+ | Celery Worker | | Celery Worker | | Celery Worker | | (Parser Pool) | | (Poster Pool) | | (Warmup Pool) | +---------------+ +---------------+ +---------------+ | | | +---------------------------------+---------------------------------+ | v +-----------------------------------------------------------------------------------+ | n8n Event Relay (Webhooks Only) | | - Telegram Owner Lead Alerts | | - External CRM Webhook Dispatch (Amocrm / Bitrix24) | +-----------------------------------------------------------------------------------+
---

## 3. Queue Definitions & Concurrency SLA

| Queue Name | Purpose | Concurrency Model | Retry Policy | Timeout |
| :--- | :--- | :--- | :--- | :--- |
| `parser_tasks` | Target discovery, channel scraping & engagement qualification | Gevent / AsyncIO (100 workers) | Exponential Backoff (3 retries) | 300 sec |
| `poster_tasks` | AI rewriting, stealth browser rendering, Telethon posting | Prefetch=1 per worker thread | Max 2 retries (Skip on Ban) | 120 sec |
| `warmup_tasks` | Daily trust-building actions for accounts in Stage 1 & 2 | Distributed Cron Batch | 1 Retry | 180 sec |
| `listener_tasks` | Long-polling / Webhook interceptors for incoming lead DMs | Persistent Daemon processes | Auto-restart on failure | Infinite |
| `billing_events` | Quota resets, token deduction checks, subscription sync | Solo Sync Worker | Strictly 5 retries | 30 sec |

---

## 4. Distributed Lock & Proxy Synchronization Standard

To prevent race conditions where multiple workers attempt to execute actions via the same account or proxy simultaneously, workers MUST acquire a Redis Distributed Lock (Redlock) before execution.

### Redis Lock Pattern (Python Celery Task Base)

```python
import redis
from contextlib import contextmanager

redis_client = redis.Redis(host='redis', port=6379, db=0)

@contextmanager
def acquire_account_lock(tenant_id: str, account_id: str, lock_timeout: int = 60):
    lock_key = f"lock:tenant:{tenant_id}:account:{account_id}"
    # Acquire lock using NX (Set if Not Exists) with expiration
    acquired = redis_client.set(lock_key, "locked", nx=True, ex=lock_timeout)
    try:
        yield acquired
    finally:
        if acquired:
            redis_client.delete(lock_key)

# Worker Task Implementation Example
@celery_app.task(bind=True, queue='poster_tasks')
def execute_posting_task(self, payload: dict):
    tenant_id = payload['tenant_id']
    account_id = payload['account_id']
    
    with acquire_account_lock(tenant_id, account_id) as locked:
        if not locked:
            # Requeue task if account is currently busy
            raise self.retry(countdown=30, exc=Exception("Account lock active by another worker"))
        
        # Execute actual posting business logic here...

5. Celery Beat Periodic Scheduler Configuration
Automatic execution schedules are declared globally in celery_config.py to trigger routine maintenance and posting routines across all active tenants.
CELERY_BEAT_SCHEDULE = {
    # Run account warmup daily routines at 08:00 AM UTC
    'daily-account-warmup-trigger': {
        'task': 'orchestrator.tasks.trigger_daily_warmup',
        'schedule': crontab(hour=8, minute=0),
        'options': {'queue': 'warmup_tasks'}
    },
    # Reset daily account action counters at midnight UTC
    'reset-daily-account-limits': {
        'task': 'orchestrator.tasks.reset_daily_limits',
        'schedule': crontab(hour=0, minute=0),
        'options': {'queue': 'billing_events'}
    },
    # Periodic target parser scan every 6 hours
    'periodic-target-discovery': {
        'task': 'orchestrator.tasks.discover_targets_job',
        'schedule': crontab(minute=0, hour='*/6'),
        'options': {'queue': 'parser_tasks'}
    }
}

6. Lightweight n8n Integration Webhook Schema
When a critical system event occurs (e.g., high-intent HOT lead captured), Celery dispatches a non-blocking HTTP POST payload to n8n to deliver instant mobile notifications.
Outbound Webhook Schema (POST /webhook/lead-captured)
{
  "event": "lead_captured",
  "tenant_id": "cfa84489-0b42-4e89-9a0c-7b707412fa01",
  "data": {
    "lead_id": "8a32d194-e811-4712-ba55-94f4c28109aa",
    "intent_score": "HOT",
    "user_handle": "@traveler_2026",
    "geo_tag": "Novosibirsk",
    "message_excerpt": "????????????! ??????? ????? ?????? ????? ?? ???? ??? ?? 2 ?????? ? ???????",
    "dialog_url": "[https://t.me/traveler_2026](https://t.me/traveler_2026)"
  },
  "timestamp": "2026-08-27T03:25:00Z"
}

