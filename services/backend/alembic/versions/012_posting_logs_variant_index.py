"""add_variant_index_to_posting_logs

Revision ID: 012
Revises: 011
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "posting_logs",
        sa.Column("variant_index", sa.SmallInteger(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("posting_logs", "variant_index")
