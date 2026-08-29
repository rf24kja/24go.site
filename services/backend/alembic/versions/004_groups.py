"""Add monitored_groups table for group monitoring feature.

Revision ID: 004_groups
Create Date: 2026-08-28
"""
from alembic import op
import sqlalchemy as sa

revision = "004_groups"
down_revision = "003_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "monitored_groups",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("account_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("account_pool.id", ondelete="SET NULL"), nullable=True),
        sa.Column("platform", sa.String(50), nullable=False),
        sa.Column("group_identifier", sa.String(255), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("members_count", sa.Integer, server_default="0"),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
        sa.Column("status", sa.String(50), server_default="idle"),
        sa.Column("last_scan_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.UniqueConstraint("tenant_id", "platform", "group_identifier", name="uq_tenant_platform_group"),
    )
    op.create_index("idx_monitored_groups_tenant", "monitored_groups", ["tenant_id", "is_active"])


def downgrade() -> None:
    op.drop_index("idx_monitored_groups_tenant")
    op.drop_table("monitored_groups")
