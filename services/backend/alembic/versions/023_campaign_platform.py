"""add campaigns.platform (per-service campaigns)

Revision ID: 023
Revises: 022
Create Date: 2026-10-14

Campaigns had no platform column, so the campaign list, leaderboard and
scheduler treated TG/VK/WA/MAX as one pool while the dashboard toggle
promised per-service views. Plain varchar (not the platform_type enum):
CampaignResponse uses from_attributes and an Enum member fails str
validation; values are guarded by the CampaignCreate pattern.
Existing rows default to telegram (the dominant pre-split traffic).
"""
from alembic import op

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "
        "platform varchar(20) NOT NULL DEFAULT 'telegram'"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE campaigns DROP COLUMN IF EXISTS platform")
