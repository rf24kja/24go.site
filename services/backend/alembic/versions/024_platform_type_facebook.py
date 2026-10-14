"""add facebook to platform_type enum

Revision ID: 024
Revises: 023
Create Date: 2026-10-14

FB service module (groups monitoring + marketplace search). Same pattern
as 021: ADD VALUE can't run in a transaction, hence autocommit_block().
"""
from alembic import op

revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ponytail: ALTER TYPE ... ADD VALUE is banned inside transactions
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'facebook'")


def downgrade() -> None:
    # ponytail: PG can't drop enum labels
    pass
