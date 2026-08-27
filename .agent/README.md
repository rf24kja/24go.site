README.md
# ? Architecture Blueprint: B2B Multi-Tenant Social Lead Generation Platform (v5.0 Enterprise SaaS)

## 1. System Overview & Core Capabilities

This project implements a high-throughput, multi-tenant B2B SaaS platform for automated social media lead discovery, stealth engagement, real-time message interception, and CRM lead routing. 

Engineered for extreme reliability and operational anti-detection, the platform operates across major social networks (Telegram, VKontakte) using dedicated proxy networks, dynamic device fingerprinting, and automated account warmup protocols.

### Key Features
* **Multi-Tenant Isolation**: Row-Level Security (RLS) in PostgreSQL ensures absolute data segregation across all workspaces.
* **Stealth & Anti-Detection Engine**: Integrated fingerprint spoofing, dynamic device profiling, and dedicated mobile proxies.
* **AI-Powered Lead Qualification**: Real-time zero-shot intent scoring (`HOT`, `WARM`, `COLD`, `SPAM`) powered by DeepSeek-V3 / OpenAI LLM APIs.
* **Decoupled Asynchronous Architecture**: Heavy parsing, browser rendering, posting, and warmup tasks are completely offloaded to Celery workers, keeping FastAPI and n8n responsive.
* **Interactive B2B Dashboard**: Single-page Next.js dashboard providing interactive analytics, lead Kanban boards, channel scanners, and proxy health monitors.
* **Multi-Gateway Billing System**: Metered token usage tracking, plan tier enforcement, and payment gateway webhooks (Stripe, YooKassa, Crypto).

---

## 2. Platform Architecture & Service Map


+----------------------------------+ | Tenant Web Dashboard | | (Next.js App Router / UI) | +----------------+-----------------+ | v +----------------------------------+ | FastAPI Control Plane | | (API Core & Gateway) | +----------------+-----------------+ | +-------------------------+-------------------------+ | | v v +---------------------------+ +---------------------------+ | PostgreSQL 16 | | Redis 7 Stack | | (Relational DB & RLS) | | (Message Broker & Cache) | +---------------------------+ +-------------+-------------+ | +-----------------------------+-----------------------------+ | | | v v v +-------------------+ +-------------------+ +-------------------+ | Celery Worker | | Celery Worker | | Celery Worker | | (Parser Pool) | | (Poster Pool) | | (Warmup Pool) | +-------------------+ +-------------------+ +-------------------+ | | | +-----------------------------+-----------------------------+ | v +---------------------------+ | n8n Event Relay | | (Webhooks & Notifications)| +---------------------------+
---

## 3. Core System Specifications & Documentation Map

The entire system design is documented in modular specifications located within the `.agent/` directory:

| Document | Description |
| :--- | :--- |
| **`DATABASE_SCHEMA.md`** | PostgreSQL 16 DDL, Row-Level Security (RLS) policies, JSONB indexes, and audit logs. |
| **`TARGET_DISCOVERY.md`** | Target group/channel discovery engines, geo-matrix lookup rules, and qualification logic. |
| **`STEALTH_POSTING_WARMUP.md`** | Anti-detection protocols, human behavioral simulation, Spintax, and multi-stage account warmup. |
| **`ORCHESTRATION_ENGINE.md`** | Celery 5.x queue topology, Redis distributed locks (Redlock), and event-driven n8n relay setup. |
| **`DASHBOARD_UI.md`** | Frontend Next.js specification, interactive funnel charts, lead Kanban, and Tailwind component rules. |
| **`LEAD_MANAGEMENT.md`** | Real-time message interceptor, zero-shot LLM qualification prompt standard, and CRM router. |
| **`BILLING_AND_LIMITS.md`** | Multi-tenant billing DDL, LLM token metering decorators, plan tier allocations, and webhook interceptors. |

---

## 4. Quick Start & Deployment Guide

### Prerequisites
* Docker Engine 24.0+ & Docker Compose v2.20+
* Python 3.11+ & Node.js 20+
* PostgreSQL 16 (with PostGIS extensions)
* Redis 7.0+ Stack

### Environment Setup
Create a `.env` file in the root directory:
```bash
# Core Environment
NODE_ENV=production
DATABASE_URL=postgresql+asyncpg://app_user:secure_password@postgres:5432/app_db
REDIS_URL=redis://redis:6379/0

# LLM & API Keys
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
N8N_WEBHOOK_URL=[https://n8n.yourdomain.com/webhook/lead-captured](https://n8n.yourdomain.com/webhook/lead-captured)

# Security & JWT
JWT_SECRET=super-secret-jwt-key
ENCRYPTION_KEY=32-byte-long-secret-key-for-sessions

Running the Platform via Docker Compose
# 1. Clone the repository and navigate to root
git clone [https://github.com/your-org/social-leadgen-platform.git](https://github.com/your-org/social-leadgen-platform.git)
cd social-leadgen-platform

# 2. Build and launch all infrastructure services
docker-compose up -d --build

# 3. Apply PostgreSQL Schema Migrations
docker-compose exec fastapi alembic upgrade head

5. Directory Structure
??? .agent/                    # Enterprise System Specifications
?   ??? SYSTEM_OVERVIEW.md
?   ??? DATABASE_SCHEMA.md
?   ??? TARGET_DISCOVERY.md
?   ??? STEALTH_POSTING_WARMUP.md
?   ??? ORCHESTRATION_ENGINE.md
?   ??? DASHBOARD_UI.md
?   ??? LEAD_MANAGEMENT.md
?   ??? BILLING_AND_LIMITS.md
??? services/
?   ??? backend/               # FastAPI Control Plane & Core Business Logic
?   ??? worker/                # Distributed Celery Worker Tasks & Logic
?   ??? dashboard/             # Next.js App Router Web Interface
??? docker-compose.yml         # Container Orchestration Manifest
??? README.md                  # Project Root Documentation
