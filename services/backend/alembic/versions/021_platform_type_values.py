"""add whatsapp/max to platform_type enum

Revision ID: 021
Revises: 020
Create Date: 2026-10-12

The model PlatformType has 5 values but alembic 001 created the enum
with 3 — any fresh-DB insert with platform whatsapp/max dies with
'invalid input value for enum platform_type'. ADD VALUE can't run
inside a transaction block, hence autocommit_block(). IF NOT EXISTS
keeps it safe on DBs that already have the labels.
"""
from alembic import op

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ponytail: ALTER TYPE ... ADD VALUE is banned inside transactions;
    # alembic wraps migrations in one, so each statement autocommits.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'whatsapp'")
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'max'")


def downgrade() -> None:
    # ponytail: PG can't drop enum labels — recreate the type to roll back.
    pass
