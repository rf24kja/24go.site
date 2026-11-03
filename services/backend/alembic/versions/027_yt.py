"""Add YT persistence after accepted repo-only026 (025 -> 026 -> 027_yt).
Graph preparation only; never auto-apply to production during API startup.
"""
from pathlib import Path
from alembic import op
revision = '027_yt'
down_revision = '026'
branch_labels = None
depends_on = None

def upgrade():
    for statement in Path(__file__).with_name('yt_schema.sql').read_text().split(';'):
        if statement.strip(): op.execute(statement)

def downgrade():
    op.drop_table('yt_oauth')
    op.drop_table('yt_objects')
