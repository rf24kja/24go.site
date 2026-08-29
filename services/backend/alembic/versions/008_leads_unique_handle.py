"""008 — Add unique constraint on leads(tenant_id, user_handle) for safe upsert.

Revision ID: 008
"""
from alembic import op
import sqlalchemy as sa

revision = "008_leads_unique_handle"
down_revision = "007_tenant_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # First, deduplicate: keep only the latest lead per (tenant_id, user_handle)
    op.execute("""
        DELETE FROM leads
        WHERE id NOT IN (
            SELECT DISTINCT ON (tenant_id, user_handle) id
            FROM leads
            ORDER BY tenant_id, user_handle, created_at DESC
        )
    """)
    # Add unique constraint
    op.create_unique_constraint(
        "uq_leads_tenant_handle",
        "leads",
        ["tenant_id", "user_handle"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_leads_tenant_handle", "leads", type_="unique")
