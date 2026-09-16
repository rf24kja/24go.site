# Architecture

## Overview

24GO is a multi-tenant B2B SaaS platform for automated lead generation in Telegram and VK.

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Dashboard   │────▶│   Backend    │────▶│  PostgreSQL   │
│  (Next.js)   │     │  (FastAPI)   │     │  (RLS)        │
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
                    ┌──────┴───────┐
                    │    Redis      │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴─────┐ ┌───┴───┐ ┌─────┴─────┐
        │  Worker    │ │  Bot  │ │  Celery   │
        │ (Celery)   │ │(TG/VK)│ │  Beat     │
        └───────────┘ └───────┘ └───────────┘
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| `backend` | 8000 | FastAPI REST API + WebSocket |
| `worker` | — | Celery workers (listener, poster, warmup, parser, billing) |
| `bot` | — | Telegram + VK bot |
| `dashboard` | 3001 | Next.js dashboard (Vercel in prod) |
| `postgres` | 5432 | PostgreSQL 16 |
| `redis` | 6379 | Redis 7 |
| `celery-beat` | — | Periodic task scheduler |

## Multi-tenancy

- **Row-Level Security (RLS)**: every query scoped to `current_tenant`
- **JWT carries tenant_id**: middleware sets `app.current_tenant` per request
- **Isolation**: tenant A never sees tenant B data

## Data flow

1. **Lead collection**: Listener monitors TG/VK groups → raw messages → Redis queue
2. **Classification**: Worker pulls from queue → LLM classify → store lead
3. **Campaign execution**: Scheduler triggers → poster sends messages via TG/VK API
4. **Analytics**: Aggregated in real-time via PostgreSQL views

## Security

- Fernet encryption for TG/VK tokens
- PBKDF2 for API keys (100k iterations)
- bcrypt for passwords
- CORS restricted to known origins
- Security headers (HSTS, CSP, X-Frame-Options)
- Rate limiting on auth endpoints
