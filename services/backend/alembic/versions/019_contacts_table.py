"""create contacts table (was only in legacy 006 .sql, never in alembic)

Revision ID: 019
Revises: 018
Create Date: 2026-10-12

Production has contacts (created once via migrations/006_phone_parser.sql),
but the alembic chain never created it: fresh DBs (tests, staging,
restores) miss the table and every contacts endpoint 500s.
Mirrors the model exactly, IF NOT EXISTS so existing DBs are untouched.
"""
from alembic import op

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "CREATE TABLE IF NOT EXISTS contacts ("
        "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "
        "tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, "
        "phone varchar(20) NOT NULL, "
        "name varchar(255), "
        "wa_jid varchar(50), "
        "wa_group_source varchar(255), "
        "wa_group_jid varchar(50), "
        "wa_parsed_at timestamptz, "
        "has_tg boolean DEFAULT false, "
        "has_viber boolean DEFAULT false, "
        "tg_user_id bigint, "
        "tg_username varchar(255), "
        "viber_user_id varchar(100), "
        "last_mailing_at timestamptz, "
        "last_mailing_campaign_id uuid REFERENCES campaigns(id), "
        "mailing_count integer DEFAULT 0, "
        "tags jsonb DEFAULT '[]', "
        "notes text, "
        "created_at timestamptz DEFAULT now(), "
        "updated_at timestamptz DEFAULT now(), "
        "CONSTRAINT contacts_tenant_id_phone_key UNIQUE (tenant_id, phone))"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS contacts")
