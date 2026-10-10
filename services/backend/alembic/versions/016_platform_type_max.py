"""add_max_to_platform_type

Revision ID: 016
Revises: 014
Create Date: 2026-10-09

Adds 'max' (MAX messenger bot platform) to the platform_type enum.
ALTER TYPE ... ADD VALUE cannot run inside a transaction block,
so this migration uses an autocommit block.
"""
from alembic import op

revision = "016"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ponytail: ADD VALUE cannot run in a txn; autocommit block required.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'max'")


def downgrade() -> None:
    # PG cannot drop enum values in use; no-op by design.
    pass
