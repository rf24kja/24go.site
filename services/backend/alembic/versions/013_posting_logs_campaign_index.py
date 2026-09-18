"""add_campaign_id_index_to_posting_logs

Revision ID: 013
Revises: 012
Create Date: 2026-09-19
"""
from alembic import op

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_posting_logs_campaign_id "
        "ON posting_logs(campaign_id)"
    )


def downgrade() -> None:
    op.drop_index("ix_posting_logs_campaign_id", table_name="posting_logs")
