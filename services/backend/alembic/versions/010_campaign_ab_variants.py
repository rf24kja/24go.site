"""Add A/B testing variants to campaigns

Revision ID: 010
Revises: 009
Create Date: 2026-09-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Use raw SQL with IF NOT EXISTS since columns may already exist
    op.execute("""
        ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ab_variants JSONB DEFAULT '[]';
        ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ab_enabled BOOLEAN DEFAULT false;
    """)

def downgrade() -> None:
    op.execute("""
        ALTER TABLE campaigns DROP COLUMN IF EXISTS ab_variants;
        ALTER TABLE campaigns DROP COLUMN IF EXISTS ab_enabled;
    """)
