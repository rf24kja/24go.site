"""create 8 legacy-only tables (never in alembic chain)

Revision ID: 020
Revises: 019
Create Date: 2026-10-12

Same drift class as 018/019: api_keys, mailings, mailing_recipients,
user_balances, search_query_logs, search_cache, auto_replies and
auto_reply_answers exist in production (via migrations/*.sql) but were
never added to the alembic chain — fresh DBs 500 on settings api-keys,
mailings and auto-reply endpoints. Mirrors the models, IF NOT EXISTS
so existing DBs are untouched.
"""
from alembic import op

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ponytail: PG has no CREATE TYPE IF NOT EXISTS — DO-block guard instead
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE mailing_status AS ENUM ('draft', 'running', 'paused', 'completed'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE mailing_recipient_status AS ENUM "
        "('pending', 'sent', 'read', 'failed', 'blocked'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$"
    )

    op.execute(
        "CREATE TABLE IF NOT EXISTS api_keys ("
        "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "
        "tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, "
        "user_id uuid REFERENCES users(id) ON DELETE SET NULL, "
        "name varchar(255) NOT NULL, "
        "key_hash varchar(255) NOT NULL UNIQUE, "
        "key_preview varchar(20) NOT NULL, "
        "is_active boolean NOT NULL DEFAULT true, "
        "created_at timestamptz DEFAULT now(), "
        "last_used_at timestamptz)"
    )
    op.execute(
        "CREATE TABLE IF NOT EXISTS mailings ("
        "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "
        "tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, "
        "name varchar(255) NOT NULL, "
        "message_text text NOT NULL, "
        "platform platform_type NOT NULL, "
        "status mailing_status NOT NULL DEFAULT 'draft', "
        "total_count integer NOT NULL DEFAULT 0, "
        "sent_count integer NOT NULL DEFAULT 0, "
        "read_count integer NOT NULL DEFAULT 0, "
        "failed_count integer NOT NULL DEFAULT 0, "
        "delay_seconds integer NOT NULL DEFAULT 30, "
        "created_at timestamptz DEFAULT now(), "
        "started_at timestamptz)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_mailings_tenant "
        "ON mailings(tenant_id, status)"
    )
    op.execute(
        "CREATE TABLE IF NOT EXISTS mailing_recipients ("
        "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "
        "mailing_id uuid NOT NULL REFERENCES mailings(id) ON DELETE CASCADE, "
        "username varchar(255) NOT NULL, "
        "first_name varchar(255), "
        "status mailing_recipient_status NOT NULL DEFAULT 'pending', "
        "error_message text, "
        "message_id varchar(64), "
        "sent_at timestamptz)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_mailing_recipients_mailing "
        "ON mailing_recipients(mailing_id, status)"
    )
    op.execute(
        "CREATE TABLE IF NOT EXISTS user_balances ("
        "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "
        "tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id), "
        "balance_kopeks bigint NOT NULL DEFAULT 0, "
        "total_spent_kopeks bigint NOT NULL DEFAULT 0, "
        "total_queries integer NOT NULL DEFAULT 0, "
        "created_at timestamptz DEFAULT now(), "
        "updated_at timestamptz)"
    )
    op.execute(
        "CREATE TABLE IF NOT EXISTS search_query_logs ("
        "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "
        "tenant_id uuid NOT NULL REFERENCES tenants(id), "
        "query text NOT NULL, "
        "query_type varchar(20) NOT NULL DEFAULT 'keyword', "
        "cost_kopeks integer NOT NULL DEFAULT 0, "
        "results_count integer NOT NULL DEFAULT 0, "
        "cache_hit boolean DEFAULT false, "
        "created_at timestamptz DEFAULT now())"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_query_logs_tenant "
        "ON search_query_logs(tenant_id, created_at)"
    )
    op.execute(
        "CREATE TABLE IF NOT EXISTS search_cache ("
        "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "
        "query_hash varchar(64) UNIQUE NOT NULL, "
        "results_json jsonb NOT NULL, "
        "expires_at timestamptz NOT NULL, "
        "created_at timestamptz DEFAULT now())"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_search_cache_hash "
        "ON search_cache(query_hash, expires_at)"
    )
    op.execute(
        "CREATE TABLE IF NOT EXISTS auto_replies ("
        "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "
        "tenant_id uuid NOT NULL REFERENCES tenants(id), "
        "name varchar(255) NOT NULL, "
        "mode varchar(20) NOT NULL DEFAULT 'keyword', "
        "keywords text DEFAULT '', "
        "prompt text DEFAULT '', "
        "model varchar(100) DEFAULT '', "
        "api_key_encrypted text DEFAULT '', "
        "is_active boolean DEFAULT true, "
        "created_at timestamptz DEFAULT now(), "
        "updated_at timestamptz)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_auto_replies_tenant "
        "ON auto_replies(tenant_id, is_active)"
    )
    op.execute(
        "CREATE TABLE IF NOT EXISTS auto_reply_answers ("
        "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "
        "auto_reply_id uuid NOT NULL REFERENCES auto_replies(id) ON DELETE CASCADE, "
        "text text NOT NULL, "
        "sort_order integer DEFAULT 0)"
    )


def downgrade() -> None:
    for t in ("auto_reply_answers", "auto_replies", "search_cache",
              "search_query_logs", "user_balances", "mailing_recipients",
              "mailings", "api_keys"):
        op.execute(f"DROP TABLE IF EXISTS {t}")
