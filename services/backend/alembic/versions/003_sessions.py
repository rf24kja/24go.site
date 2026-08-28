"""Add account_sessions table for encrypted Telethon session storage.

Revision ID: 003_sessions
Revises: 002_billing
Create Date: 2026-08-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003_sessions"
down_revision: Union[str, None] = "002_billing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── account_sessions: encrypted Telethon session storage ───────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS account_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id UUID NOT NULL REFERENCES account_pool(id) ON DELETE CASCADE,
            session_data TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT unique_account_session UNIQUE (account_id)
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_account_sessions_account
        ON account_sessions(account_id);
    """)

    # ── leads: source + post_id for comment scraper tracking ──────────
    op.execute("""
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'dm';
    """)
    op.execute("""
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS post_id VARCHAR(255);
    """)

    # ── posting_logs: message_id for post-to-comment link ─────────────
    op.execute("""
        ALTER TABLE posting_logs ADD COLUMN IF NOT EXISTS message_id VARCHAR(255);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS account_sessions;")
    op.execute("ALTER TABLE leads DROP COLUMN IF EXISTS source;")
    op.execute("ALTER TABLE leads DROP COLUMN IF EXISTS post_id;")
    op.execute("ALTER TABLE posting_logs DROP COLUMN IF EXISTS message_id;")
