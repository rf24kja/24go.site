"""Initial schema — full DDL from ARCHITECTURE.md with RLS policies.

Revision ID: 001_initial
Revises: None
Create Date: 2026-08-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Extensions ─────────────────────────────────────────────────────
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # ── Enum Types ─────────────────────────────────────────────────────
    op.execute("CREATE TYPE tenant_plan_type AS ENUM ('trial', 'starter', 'pro', 'enterprise')")
    op.execute("CREATE TYPE platform_type AS ENUM ('telegram', 'vkontakte', 'forum')")
    op.execute("CREATE TYPE access_level AS ENUM ('open_wall', 'open_comments', 'suggested_news', 'admin_dm_only')")
    op.execute("CREATE TYPE account_status AS ENUM ('warming_up', 'active', 'cooldown', 'banned', 'paused')")
    op.execute("CREATE TYPE lead_intent_level AS ENUM ('HOT', 'WARM', 'COLD', 'SPAM')")
    op.execute("CREATE TYPE lead_status AS ENUM ('new', 'in_progress', 'converted', 'rejected')")

    # ── 1. tenants ─────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE tenants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_name VARCHAR(255) NOT NULL,
            plan tenant_plan_type NOT NULL DEFAULT 'trial',
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── 2. users ───────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(550) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'operator',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── 3. proxies ─────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE proxies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            proxy_url VARCHAR(550) NOT NULL,
            rotation_api_url VARCHAR(550),
            geo_location VARCHAR(100),
            is_active BOOLEAN DEFAULT true,
            last_rotated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── 4. targets ─────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE targets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            platform platform_type NOT NULL,
            target_id_code VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            geo_tag VARCHAR(100) NOT NULL,
            niche VARCHAR(100) NOT NULL,
            access access_level NOT NULL,
            members_count INT DEFAULT 0,
            engagement_rate NUMERIC(5,2) DEFAULT 0.0,
            is_active BOOLEAN DEFAULT true,
            last_parsed_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_tenant_target UNIQUE (tenant_id, platform, target_id_code)
        )
    """)
    op.execute("CREATE INDEX idx_targets_tenant_geo ON targets(tenant_id, geo_tag, is_active)")

    # ── 5. account_pool ────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE account_pool (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            platform platform_type NOT NULL,
            account_identifier VARCHAR(255) NOT NULL,
            session_data TEXT NOT NULL,
            device_fingerprint JSONB NOT NULL,
            proxy_id UUID REFERENCES proxies(id) ON DELETE SET NULL,
            status account_status NOT NULL DEFAULT 'warming_up',
            warmup_stage INT DEFAULT 1,
            daily_action_limit INT NOT NULL DEFAULT 15,
            actions_today INT NOT NULL DEFAULT 0,
            cooldown_until TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX idx_account_pool_status ON account_pool(tenant_id, status, actions_today)")

    # ── 6. campaigns ───────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE campaigns (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            base_text TEXT NOT NULL,
            target_geos JSONB NOT NULL,
            target_niches JSONB NOT NULL,
            media_urls JSONB DEFAULT '[]'::jsonb,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── 7. posting_logs ────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE posting_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
            target_id UUID REFERENCES targets(id) ON DELETE CASCADE,
            account_id UUID REFERENCES account_pool(id) ON DELETE SET NULL,
            rendered_text TEXT NOT NULL,
            utm_url VARCHAR(700) NOT NULL,
            status VARCHAR(50) NOT NULL,
            error_trace TEXT,
            executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX idx_posting_logs_tenant ON posting_logs(tenant_id, executed_at DESC)")

    # ── 8. leads ───────────────────────────────────────────────────────
    op.execute("""
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
        )
    """)
    op.execute("CREATE INDEX idx_leads_tenant_status ON leads(tenant_id, status, intent_score)")

    # ── 9. daily_analytics ─────────────────────────────────────────────
    op.execute("""
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
        )
    """)
    op.execute("CREATE INDEX idx_daily_analytics_lookup ON daily_analytics(tenant_id, date DESC)")

    # ── Row-Level Security Policies ────────────────────────────────────
    # Pattern: SET app.current_tenant = '<uuid>' at session start.
    # The policy filters every row so only the active tenant's data is visible.
    # tenants uses id (no tenant_id FK on the root table), all others use tenant_id.
    op.execute("ALTER TABLE tenants ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tenants FORCE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation_policy ON tenants
        USING (id::text = current_setting('app.current_tenant', true))
    """)

    child_tables = [
        "users", "proxies", "targets", "account_pool",
        "campaigns", "posting_logs", "leads", "daily_analytics",
    ]
    for table in child_tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY tenant_isolation_policy ON {table}
            USING (tenant_id::text = current_setting('app.current_tenant', true))
        """)


def downgrade() -> None:
    child_tables = [
        "daily_analytics", "leads", "posting_logs", "campaigns",
        "account_pool", "targets", "proxies", "users",
    ]
    for table in child_tables:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON tenants")
    op.execute("ALTER TABLE tenants DISABLE ROW LEVEL SECURITY")

    op.execute("DROP TABLE IF EXISTS daily_analytics CASCADE")
    op.execute("DROP TABLE IF EXISTS leads CASCADE")
    op.execute("DROP TABLE IF EXISTS posting_logs CASCADE")
    op.execute("DROP TABLE IF EXISTS campaigns CASCADE")
    op.execute("DROP TABLE IF EXISTS account_pool CASCADE")
    op.execute("DROP TABLE IF EXISTS targets CASCADE")
    op.execute("DROP TABLE IF EXISTS proxies CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")
    op.execute("DROP TABLE IF EXISTS tenants CASCADE")

    op.execute("DROP TYPE IF EXISTS lead_status CASCADE")
    op.execute("DROP TYPE IF EXISTS lead_intent_level CASCADE")
    op.execute("DROP TYPE IF EXISTS account_status CASCADE")
    op.execute("DROP TYPE IF EXISTS access_level CASCADE")
    op.execute("DROP TYPE IF EXISTS platform_type CASCADE")
    op.execute("DROP TYPE IF EXISTS tenant_plan_type CASCADE")
