"""add email_verified to users

Revision ID: 018
Revises: 017
Create Date: 2026-10-12

The User model and auth endpoints use users.email_verified, but no
migration ever created it (production got it via manual ALTER TABLE).
Fresh databases (tests, staging, restores) break on register/verify.
"""
from alembic import op

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
        "email_verified boolean NOT NULL DEFAULT FALSE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_verified")
