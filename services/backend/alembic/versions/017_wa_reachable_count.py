"""add reachable_count to wa_groups

Revision ID: 017
Revises: 016
Create Date: 2026-10-10

Sidecar reports reachable (non-LID) members separately from total.
"""
from alembic import op

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE wa_groups ADD COLUMN IF NOT EXISTS "
        "reachable_count integer DEFAULT 0"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE wa_groups DROP COLUMN IF EXISTS reachable_count")
