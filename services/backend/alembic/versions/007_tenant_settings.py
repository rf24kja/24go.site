"""007 — tenant_settings: per-tenant JSONB configuration store.

Revision ID: 007
Create Date: 2026-08-29
"""
from alembic import op
import sqlalchemy as sa

revision = "007_tenant_settings"
down_revision = "006_lead_source"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenant_settings",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", sa.dialects.postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("settings", sa.dialects.postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_tenant_settings_tenant", "tenant_settings", ["tenant_id"])


def downgrade() -> None:
    op.drop_table("tenant_settings")
