"""Add campaign scheduling fields: schedule_cron, posts_per_day, timezone, last_posted_at.

Revision ID: 005_campaign_scheduling
Create Date: 2026-08-29
"""
from alembic import op
import sqlalchemy as sa

revision = "005_campaign_scheduling"
down_revision = "004_groups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("campaigns", sa.Column("schedule_cron", sa.String(100), nullable=True))
    op.add_column("campaigns", sa.Column("posts_per_day", sa.Integer, server_default="1"))
    op.add_column("campaigns", sa.Column("timezone", sa.String(50), server_default="UTC"))
    op.add_column("campaigns", sa.Column("last_posted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("campaigns", "last_posted_at")
    op.drop_column("campaigns", "timezone")
    op.drop_column("campaigns", "posts_per_day")
    op.drop_column("campaigns", "schedule_cron")
