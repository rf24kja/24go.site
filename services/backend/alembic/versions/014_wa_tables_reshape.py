"""reshape_wa_tables_to_redesign_models

Revision ID: 014
Revises: 013
Create Date: 2026-09-27

The WA redesign (models WaAccount/WaGroup) never shipped a migration:
production wa_accounts/wa_groups still have the old 006_phone_parser
schema. All three WA tables are empty (feature never worked), so
drop + recreate to match the models. No data loss possible.
"""
from alembic import op

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS wa_groups")
    op.execute("DROP TABLE IF EXISTS wa_accounts")
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE wa_account_status AS ENUM "
        "('warming_up', 'connected', 'disconnected', 'paused'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$"
    )
    op.execute(
        "CREATE TABLE wa_accounts ("
        "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "
        "tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, "
        "phone_number varchar(20) NOT NULL, "
        "wa_id varchar(255), "
        "status wa_account_status NOT NULL DEFAULT 'warming_up', "
        "daily_action_limit integer NOT NULL DEFAULT 15, "
        "actions_today integer NOT NULL DEFAULT 0, "
        "cooldown_until timestamptz, "
        "is_active boolean DEFAULT true, "
        "created_at timestamptz DEFAULT now())"
    )
    op.execute(
        "CREATE INDEX idx_wa_accounts_tenant ON wa_accounts(tenant_id, status)"
    )
    op.execute(
        "CREATE TABLE wa_groups ("
        "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "
        "tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, "
        "group_id varchar(255) NOT NULL, "
        "name varchar(255), "
        "members_count integer DEFAULT 0, "
        "is_active boolean DEFAULT true, "
        "last_scan_at timestamptz, "
        "created_at timestamptz DEFAULT now(), "
        "UNIQUE(tenant_id, group_id))"
    )
    op.execute(
        "CREATE INDEX idx_wa_groups_tenant ON wa_groups(tenant_id, is_active)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS wa_groups")
    op.execute("DROP TABLE IF EXISTS wa_accounts")
    op.execute("DROP TYPE IF EXISTS wa_account_status")
