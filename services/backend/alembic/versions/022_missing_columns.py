"""add 4 model-only columns (never in any migration)

Revision ID: 022
Revises: 021
Create Date: 2026-10-13

Same drift class as 018-020, found by the delete-account test seed:
targets.is_joined and monitored_groups.is_joined are WRITTEN by
POST /targets/{id}/check-membership — that endpoint 500s wherever the
columns are missing. campaigns.description/emoji are read by campaign
serializers. ADD COLUMN IF NOT EXISTS: existing DBs untouched.
"""
from alembic import op

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE targets ADD COLUMN IF NOT EXISTS is_joined boolean DEFAULT false")
    op.execute("ALTER TABLE monitored_groups ADD COLUMN IF NOT EXISTS is_joined boolean DEFAULT false")
    op.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS description text")
    op.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emoji varchar(100)")


def downgrade() -> None:
    for tbl, col in (("targets", "is_joined"), ("monitored_groups", "is_joined"),
                     ("campaigns", "description"), ("campaigns", "emoji")):
        op.execute(f"ALTER TABLE {tbl} DROP COLUMN IF EXISTS {col}")
