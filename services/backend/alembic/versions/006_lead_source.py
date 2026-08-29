"""Add source, post_id columns to leads.

Revision ID: 006_lead_source
Create Date: 2026-08-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "006_lead_source"
down_revision = "005_campaign_scheduling"
branch_labels = None
depends_on = None


def column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = inspect(bind)
    return column in [c["name"] for c in insp.get_columns(table)]


def upgrade() -> None:
    if not column_exists("leads", "source"):
        op.add_column("leads", sa.Column("source", sa.String(50), server_default="dm", nullable=False))
    if not column_exists("leads", "post_id"):
        op.add_column("leads", sa.Column("post_id", sa.String(255), nullable=True))


def downgrade() -> None:
    if column_exists("leads", "post_id"):
        op.drop_column("leads", "post_id")
    if column_exists("leads", "source"):
        op.drop_column("leads", "source")
