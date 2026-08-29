"""Add source, post_id columns to leads.

Revision ID: 006_lead_source
Create Date: 2026-08-29
"""
from alembic import op
import sqlalchemy as sa

revision = "006_lead_source"
down_revision = "005_campaign_scheduling"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("source", sa.String(50), server_default="dm", nullable=False))
    op.add_column("leads", sa.Column("post_id", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("leads", "post_id")
    op.drop_column("leads", "source")
