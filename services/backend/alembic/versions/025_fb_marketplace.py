"""fb_marketplace_snapshots: FB Marketplace search results per tenant+query.

Revision ID: 025
Revises: 024
Create Date: 2026-10-14

Supports the FB module's marketplace monitoring: repeated searches upsert
by (tenant, query, link), so "new since last scan" is first_seen diffs.
"""
from alembic import op

revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "CREATE TABLE IF NOT EXISTS fb_marketplace_snapshots ("
        "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "
        "tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, "
        "query text NOT NULL, "
        "title text NOT NULL DEFAULT '', "
        "price numeric(12, 2), "
        "link text NOT NULL, "
        "image text, "
        "bedrooms integer, "
        "first_seen timestamptz DEFAULT now(), "
        "last_seen timestamptz DEFAULT now(), "
        "created_at timestamptz DEFAULT now(), "
        "CONSTRAINT fb_mp_unique UNIQUE (tenant_id, query, link))"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_fb_mp_tenant_query "
        "ON fb_marketplace_snapshots(tenant_id, query, last_seen DESC)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS fb_marketplace_snapshots")
