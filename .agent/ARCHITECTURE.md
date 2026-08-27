9 ???????????? (v5.0 Enterprise SaaS):
    1. ARCHITECTURE.md — Multi-Tenant DDL, RLS-???????? ????????, ???????, Redis/Celery ?????????.
    2. TASK_PARSER.md — ???????????? ????????, ???-???????, ?????????? ?????, ????????? ???????????? ??????????.
    3. TASK_POSTER.md — ???????????, AI-????????, ????? ?????????, ????????? ???????? ????? ? Fingerprint Telegram/VK.
    4. ACCOUNT_WARMUP.md — 3-?????? ???????? ??????????????? ???????? ????? .session ?????? ? VK-???????.
    5. ORCHESTRATION_ENGINE.md — ????? ?? ??????? ???????? ? n8n; ??????? ?? Celery/Redis Stack + n8n ???????.
    6. DASHBOARD_UI.md — UI/UX ?????? ??????? ? ????????????? ???????? ??????????, ????????? ????????? ? ?????????.
    7. LEAD_MANAGEMENT.md — ???????? ???????? ?????????, LLM-???????????? (Hot/Warm/Cold) ? ?????????? ?????????????.
    8. BILLING_AND_LIMITS.md — ???????? ?????, ????????, ???? ??????? LLM/??????, Stripe/YooKassa/Crypto ??????????.
    9. README.md — ???????? ??????, docker-compose.yml ? ??????-?????? ??? ??????????? ??????? ? Claude Code / Cursor.
????????? ? ??????. ???? ??????????? 1-? ????: ARCHITECTURE.md.
.agent/ARCHITECTURE.md
# Specification: Multi-Tenant Core Architecture & Data Base Topology (v5.0 Enterprise SaaS)

## 1. System Architecture & Tenant Isolation Standard
This document specifies the multi-tenant backend architecture for the SaaS Lead Generation Platform. The engine isolates data using a **Shared Database, Separate Schema / Tenant ID** pattern. Every database query, state transition, task execution, and analytical operation MUST be scoped strictly to a `tenant_id` to prevent cross-tenant data leaks.

---

## 2. Infrastructure Topology


+-----------------------------------------------------------------------------------+ | API Gateway / Load Balancer | | (Nginx / Traefik) | +-----------------------------------------+-----------------------------------------+ | v +-----------------------------------------------------------------------------------+ | Control Plane (FastAPI REST API) | | Auth, Tenant Isolation Middleware, Billing Checks | +---------------------+-------------------+-------------------+---------------------+ | | | v v v +------------------------+ +-------------------+ +--------------------------------+ | PostgreSQL 16 | | Redis 7 Stack | | Celery Task Workers | | (Multi-Tenant Data) | | (Queues & Lock) | | (Parser, Poster, Listener) | +------------------------+ +-------------------+ +--------------------------------+
---

## 3. PostgreSQL Database DDL Schema (v5.0)

```sql
-- Enable UUID extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum Types
CREATE TYPE tenant_plan_type AS ENUM ('trial', 'starter', 'pro', 'enterprise');
CREATE TYPE platform_type AS ENUM ('telegram', 'vkontakte', 'forum');
CREATE TYPE access_level AS ENUM ('open_wall', 'open_comments', 'suggested_news', 'admin_dm_only');
CREATE TYPE account_status AS ENUM ('warming_up', 'active', 'cooldown', 'banned', 'paused');
CREATE TYPE lead_intent_level AS ENUM ('HOT', 'WARM', 'COLD', 'SPAM');
CREATE TYPE lead_status AS ENUM ('new', 'in_progress', 'converted', 'rejected');

-- 1. Tenants (Clients / B2B Organizations)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    plan tenant_plan_type NOT NULL DEFAULT 'trial',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users (Accounts within Tenant)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(550) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'operator', -- 'owner', 'admin', 'operator'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Mobile Proxy Pools
CREATE TABLE proxies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    proxy_url VARCHAR(550) NOT NULL,
    rotation_api_url VARCHAR(550),
    geo_location VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_rotated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Target Acquisition Channels (Groups, Channels)
CREATE TABLE targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    target_id_code VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    geo_tag VARCHAR(100) NOT NULL, -- e.g. 'Moscow', 'SPb', 'Kamchatka', 'Novosibirsk'
    niche VARCHAR(100) NOT NULL,   -- e.g. 'thailand_travel', 'phuket_real_estate'
    access access_level NOT NULL,
    members_count INT DEFAULT 0,
    engagement_rate NUMERIC(5,2) DEFAULT 0.0,
    is_active BOOLEAN DEFAULT true,
    last_parsed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_target UNIQUE (tenant_id, platform, target_id_code)
);

-- 5. Social Accounts Pool (Telegram / VK Userbots)
CREATE TABLE account_pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    account_identifier VARCHAR(255) NOT NULL, -- Phone number or VK User ID
    session_data TEXT NOT NULL,                -- Telethon string session or VK Token
    device_fingerprint JSONB NOT NULL,         -- App ID, Device Model, OS Version
    proxy_id UUID REFERENCES proxies(id) ON DELETE SET NULL,
    status account_status NOT NULL DEFAULT 'warming_up',
    warmup_stage INT DEFAULT 1,                -- 1 to 3 stages of warmup
    daily_action_limit INT NOT NULL DEFAULT 15,
    actions_today INT NOT NULL DEFAULT 0,
    cooldown_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Marketing Campaigns & Content Blueprints
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    base_text TEXT NOT NULL,
    target_geos JSONB NOT NULL,    -- Array of GEO strings
    target_niches JSONB NOT NULL,  -- Array of Niche strings
    media_urls JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Posting Execution Logs & Traceability
CREATE TABLE posting_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    target_id UUID REFERENCES targets(id) ON DELETE CASCADE,
    account_id UUID REFERENCES account_pool(id) ON DELETE SET NULL,
    rendered_text TEXT NOT NULL,
    utm_url VARCHAR(700) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'published', 'moderation_pending', 'failed'
    error_trace TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Incoming Sales Leads
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    target_id UUID REFERENCES targets(id) ON DELETE SET NULL,
    account_id UUID REFERENCES account_pool(id) ON DELETE SET NULL,
    user_handle VARCHAR(255) NOT NULL,
    user_full_name VARCHAR(255),
    geo_tag VARCHAR(100),
    message_text TEXT NOT NULL,
    intent_score lead_intent_level NOT NULL DEFAULT 'WARM',
    status lead_status NOT NULL DEFAULT 'new',
    dialog_url VARCHAR(550) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Analytical Aggregates for Dashboard Visuals
CREATE TABLE daily_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_parsed_targets INT DEFAULT 0,
    total_posts_published INT DEFAULT 0,
    total_clicks INT DEFAULT 0,
    total_leads_captured INT DEFAULT 0,
    total_hot_leads INT DEFAULT 0,
    llm_tokens_spent INT DEFAULT 0,
    proxy_bytes_used BIGINT DEFAULT 0,
    CONSTRAINT unique_tenant_daily UNIQUE (tenant_id, date)
);

-- Database Indexes for High Performance Querying
CREATE INDEX idx_targets_tenant_geo ON targets(tenant_id, geo_tag, is_active);
CREATE INDEX idx_account_pool_status ON account_pool(tenant_id, status, actions_today);
CREATE INDEX idx_posting_logs_tenant ON posting_logs(tenant_id, executed_at DESC);
CREATE INDEX idx_leads_tenant_status ON leads(tenant_id, status, intent_score);
CREATE INDEX idx_daily_analytics_lookup ON daily_analytics(tenant_id, date DESC);


