"""Include the existing purpose-scoped VK discovery schema in fresh installs.

Revision ID: 026
Revises: 025

This packages the separate vk_discovery_credentials.sql contract; it does not
repurpose account_pool credentials or authorize a production migration run.
"""
from alembic import op

revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "CREATE TABLE IF NOT EXISTS tenant_vk_discovery_credentials ("
        "tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE, "
        "token_ciphertext TEXT NOT NULL, "
        "vk_user_id BIGINT NOT NULL CHECK (vk_user_id > 0), "
        "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS tenant_vk_discovery_credentials")
