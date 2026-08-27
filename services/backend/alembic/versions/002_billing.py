"""Add billing tables: subscriptions, usage_logs, billing_transactions.

Revision ID: 002_billing
Revises: 001_initial
Create Date: 2026-08-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002_billing"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 10. subscriptions ──────────────────────────────────────────────
    op.execute("""
        CREATE TABLE subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            plan tenant_plan_type NOT NULL DEFAULT 'trial',
            status VARCHAR(50) NOT NULL DEFAULT 'active',
            current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
            current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
            monthly_posts_limit INT NOT NULL DEFAULT 500,
            monthly_posts_used INT NOT NULL DEFAULT 0,
            token_credits_balance INT NOT NULL DEFAULT 200000,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_tenant_subscription UNIQUE (tenant_id)
        )
    """)
    op.execute("CREATE INDEX idx_subscriptions_lookup ON subscriptions(tenant_id, status)")

    # ── 11. usage_logs ─────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE usage_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            service_type VARCHAR(50) NOT NULL,
            quantity_used INT NOT NULL,
            estimated_cost_usd NUMERIC(10, 6) NOT NULL,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX idx_usage_logs_tenant_date ON usage_logs(tenant_id, created_at DESC)")

    # ── 12. billing_transactions ───────────────────────────────────────
    op.execute("""
        CREATE TABLE billing_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            amount_usd NUMERIC(10, 2) NOT NULL,
            payment_provider VARCHAR(50) NOT NULL,
            provider_transaction_id VARCHAR(255) UNIQUE NOT NULL,
            status VARCHAR(50) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── RLS for billing tables ─────────────────────────────────────────
    for table in ["subscriptions", "usage_logs", "billing_transactions"]:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY tenant_isolation_policy ON {table}
            USING (tenant_id::text = current_setting('app.current_tenant', true))
        """)


def downgrade() -> None:
    for table in ["billing_transactions", "usage_logs", "subscriptions"]:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    op.execute("DROP TABLE IF EXISTS billing_transactions CASCADE")
    op.execute("DROP TABLE IF EXISTS usage_logs CASCADE")
    op.execute("DROP TABLE IF EXISTS subscriptions CASCADE")
